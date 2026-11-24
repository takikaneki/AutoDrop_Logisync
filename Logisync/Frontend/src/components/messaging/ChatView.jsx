import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getRole, getUser } from "../../api.js";
import { listContacts, listMessages, markMessageRead, sendMessage } from "../../services/messageService.js";
import { initiateReturnToHub } from "../../services/parcelService.js";
import { getDeliveryRecordForParcel, initiateReturnToHubLocal } from "../../store/riderDeliveries.js";
import { toast } from "../../store/toast.js";
import { formatDate } from "../../utils/format.js";
import {
  isOnline,
  readViewCache,
  useNetworkStatus,
  useReconnectRefresh,
  writeViewCache,
} from "../../utils/network.js";
import {
  CachedDataNotice,
  ChatSkeleton,
  LoadErrorState,
  OfflineState,
} from "../Skeletons.jsx";
import CallUserModal from "./CallUserModal.jsx";
import Icon from "../Icon.jsx";
import { SearchInput } from "../SearchFilterBar.jsx";

const POLL_MS = 15000;

function parseRefusalReport(messageText) {
  if (!messageText) return null;
  const s = String(messageText);
  const isRefusal =
    s.includes("[FAILED DELIVERY REPORT") ||
    s.includes("RECIPIENT REFUSAL") ||
    (s.includes("Refusal Reason:") && (s.includes("Tracking / Txn:") || s.includes("Parcel / Txn:")));
  if (!isRefusal) return null;

  const txnMatch = s.match(/(?:Tracking \/ Txn|Parcel \/ Txn):\s*([^\n\r]+)/i);
  const parcelIdMatch = s.match(/Parcel ID:\s*([^\n\r]+)/i);
  const receiverMatch = s.match(/Receiver:\s*([^\n\r]+)/i);
  const reasonMatch = s.match(/Refusal Reason:\s*([^\n\r]+)/i);
  const riderMatch = s.match(/Rider:\s*([^\n\r]+)/i);
  const notesMatch = s.match(/(?:Notes|Rider Notes):\s*([^\n\r]+)/i);

  const txn = txnMatch?.[1]?.trim() || "";
  const parcelId = parcelIdMatch?.[1]?.trim() || txn;

  return {
    txn,
    parcelId,
    receiver: receiverMatch?.[1]?.trim() || "",
    reason: reasonMatch?.[1]?.trim() || "Recipient Refused Parcel",
    rider: riderMatch?.[1]?.trim() || "",
    notes: notesMatch?.[1]?.trim() || "",
    raw: s,
  };
}

// Messaging para sa Seller, Rider at Coordinator (iisang component).
// Backend rule: coordinator <-> seller/rider lang. Ang listahan ng contacts ay galing sa /api/users/contacts.
// Props na pang-itsura lang:  btnClass (kulay ng button/bubble), surface (kulay ng panel)
export default function ChatView({
  btnClass = "bg-brand hover:bg-brand-dark",
  activeClass = "bg-brand-soft dark:bg-night-head",
  surface = "bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800",
  directMode = false,
}) {
  const me = Number(getUser()?.user_id);
  const myRole = getRole();
  const coordinatorOnly = myRole !== "coordinator"; // seller at rider: Coordinator lang ang pwedeng kausapin
  const [params, setParams] = useSearchParams();

  const { online } = useNetworkStatus();
  const cachedBundle = useMemo(() => readViewCache("messages-bundle"), []);
  const [contacts, setContacts] = useState(() =>
    Array.isArray(cachedBundle?.data?.contacts) ? cachedBundle.data.contacts : []
  );
  const [messages, setMessages] = useState(() =>
    Array.isArray(cachedBundle?.data?.messages) ? cachedBundle.data.messages : []
  );
  const [hasLoadedData, setHasLoadedData] = useState(() => Boolean(cachedBundle?.data));
  const [cachedAt, setCachedAt] = useState(() => cachedBundle?.updatedAt || null);
  const [loading, setLoading] = useState(() => isOnline() && !cachedBundle?.data);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [initiatingRthId, setInitiatingRthId] = useState(null);
  const [initiatedRthSet, setInitiatedRthSet] = useState(() => new Set());
  const marking = useRef(new Set());
  const bottom = useRef(null);

  const handleInitiateRth = async (report) => {
    const key = report.parcelId || report.txn;
    if (!key) return;
    setInitiatingRthId(key);
    try {
      // 1. Backend API call
      try {
        await initiateReturnToHub(key, report.reason || "Recipient Refusal");
      } catch (err) {
        console.warn("Backend initiateReturnToHub fallback:", err);
      }
      // 2. Local store synchronization
      initiateReturnToHubLocal(key, report.reason || "Recipient Refusal");

      // 3. Mark as initiated in local state so UI updates immediately
      setInitiatedRthSet((prev) => {
        const next = new Set(prev);
        if (report.txn) next.add(String(report.txn).trim());
        if (report.parcelId) next.add(String(report.parcelId).trim());
        return next;
      });

      // 4. Send confirmation message back to rider in chat thread if active contact is rider
      if (active && active.user_id) {
        try {
          await sendMessage(
            active.user_id,
            `[COORDINATOR ACTION · RETURN TO HUB APPROVED]\nTracking / Txn: ${report.txn || report.parcelId}\nReason: ${report.reason}\nStatus: Approved for Return to Hub. Please bring the sealed parcel back to the hub.`
          );
          await load(true);
        } catch (msgErr) {
          console.warn("Failed to send RTH confirmation message:", msgErr);
        }
      }

      toast.success(`Return to Hub approved for ${report.txn || report.parcelId}.`);
    } catch (err) {
      toast.error(err.message || "Failed to initiate Return to Hub.");
    } finally {
      setInitiatingRthId(null);
    }
  };

  const load = useCallback(async (silent = false) => {
    if (!isOnline()) {
      setLoading(false);
      return;
    }
    try {
      const [c, m] = await Promise.all([listContacts(), listMessages()]);
      // Dobleng proteksyon: kahit ano ang ibalik ng API, coordinator lang ang ipapakita sa seller/rider
      const nextContacts = coordinatorOnly ? c.filter((x) => x.role === "coordinator") : c;
      setContacts(nextContacts);
      setMessages(m);
      setHasLoadedData(true);
      setCachedAt(Date.now());
      writeViewCache("messages-bundle", { contacts: nextContacts, messages: m });
      setError("");
    } catch (err) {
      if (!silent && isOnline()) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [coordinatorOnly]);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useReconnectRefresh(() => load(true));

  // Buksan agad ang usapan kung may ?contact=<id o pangalan> sa URL
  useEffect(() => {
    const want = params.get("contact");
    if (!want || !contacts.length) return;
    const found = contacts.find((c) => String(c.user_id) === want || c.name.toLowerCase() === want.toLowerCase());
    if (found) setActiveId(found.user_id);
    params.delete("contact");
    setParams(params, { replace: true });
  }, [contacts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Buuin ang bawat usapan: huling mensahe at bilang ng hindi pa nababasa
  const rows = useMemo(() => {
    const byUser = new Map();
    for (const m of messages) {
      const other = Number(m.sender_id) === me ? Number(m.receiver_id) : Number(m.sender_id);
      const cur = byUser.get(other) || { last: null, unread: 0 };
      cur.last = m; // ascending ang order mula sa backend
      if (Number(m.receiver_id) === me && !m.is_read) cur.unread += 1;
      byUser.set(other, cur);
    }
    const q = search.trim().toLowerCase();
    return contacts
      .filter((c) => {
        const role = String(c.role || "").toLowerCase();
        const matchesRole = roleFilter === "all" || role === roleFilter;
        const matchesSearch = !q || c.name.toLowerCase().includes(q);
        return matchesRole && matchesSearch;
      })
      .map((c) => ({ contact: c, ...(byUser.get(Number(c.user_id)) || { last: null, unread: 0 }) }))
      .sort((a, b) => {
        const ta = a.last ? new Date(a.last.created_at).getTime() : 0;
        const tb = b.last ? new Date(b.last.created_at).getTime() : 0;
        return tb - ta || a.contact.name.localeCompare(b.contact.name);
      });
  }, [messages, contacts, me, search, roleFilter]);

  const active = contacts.find((c) => Number(c.user_id) === Number(activeId)) || null;

  useEffect(() => {
    if (directMode && !activeId && (rows.length > 0 || contacts.length > 0)) {
      const first = rows[0]?.contact || contacts[0];
      if (first?.user_id) setActiveId(first.user_id);
    }
  }, [directMode, activeId, rows, contacts]);

  const thread = useMemo(
    () =>
      messages.filter((m) => {
        const other = Number(m.sender_id) === me ? Number(m.receiver_id) : Number(m.sender_id);
        return other === Number(activeId);
      }),
    [messages, me, activeId]
  );

  // Markahan na "read" ang natanggap na mensahe kapag bukas ang usapan
  useEffect(() => {
    const unread = thread.filter((m) => Number(m.receiver_id) === me && !m.is_read && !marking.current.has(m.message_id));
    unread.forEach((m) => {
      marking.current.add(m.message_id);
      markMessageRead(m.message_id)
        .then(() => setMessages((list) => list.map((x) => (x.message_id === m.message_id ? { ...x, is_read: 1 } : x))))
        .catch(() => marking.current.delete(m.message_id));
    });
  }, [thread, me]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread.length, activeId]);

  const onSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !active) return;
    if (coordinatorOnly && active.role !== "coordinator") {
      setSendError("You can only send messages to the Coordinator.");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      await sendMessage(active.user_id, text);
      setDraft("");
      await load(true);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading && online && !hasLoadedData) {
    return <ChatSkeleton directMode={directMode} surface={surface} />;
  }
  if (!online && !hasLoadedData) {
    return (
      <OfflineState
        title="Messages unavailable offline"
        text="Reconnect to the internet to load your conversations and send messages."
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />
    );
  }
  if (error && !hasLoadedData) {
    return (
      <LoadErrorState
        title="Unable to load messages"
        message={error}
        onRetry={() => {
          setLoading(true);
          load();
        }}
      />
    );
  }

  return (
    <div className="min-w-0">
      {!online && hasLoadedData && <CachedDataNotice updatedAt={cachedAt} />}
      <div className={`grid w-full min-w-0 max-w-full grid-cols-1 h-[calc(100vh-170px)] min-h-[520px] max-[820px]:h-[calc(100dvh-160px)] max-[820px]:min-h-[420px] overflow-hidden rounded-2xl border ${directMode ? "" : "md:grid-cols-[205px_minmax(0,1fr)] lg:grid-cols-[235px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]"} ${surface}`}>
      {/* LISTAHAN NG USAPAN */}
      {!directMode && (
        <aside className={`min-w-0 w-full max-w-full min-h-0 flex-col overflow-hidden border-slate-200 dark:border-slate-700 md:border-r ${active ? "hidden md:flex" : "flex"}`}>
          <div className="space-y-2.5 border-b border-slate-200 p-2.5 dark:border-slate-700 xl:space-y-3 xl:p-3">
            {!coordinatorOnly && (
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-night-head">
                {[
                  { value: "all", label: "All" },
                  { value: "seller", label: "Sellers" },
                  { value: "rider", label: "Riders" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRoleFilter(option.value)}
                    className={`truncate rounded-md px-1.5 py-1.5 text-[11px] font-semibold transition xl:px-2 xl:py-2 xl:text-xs ${roleFilter === option.value
                        ? `${btnClass} text-white`
                        : "text-slate-600 hover:bg-[#0f172a] hover:text-white dark:text-slate-300 dark:hover:bg-[#0f172a] dark:hover:text-white"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            <SearchInput
              compact
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              ariaLabel="Search contacts"
            />
          </div>
          <ul className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            {rows.length === 0 && <li className="p-6 text-center text-sm text-slate-500">{coordinatorOnly ? "No coordinator is available right now." : "No contacts available."}</li>}
            {rows.map(({ contact, last, unread }) => (
              <li key={contact.user_id} className="min-w-0 overflow-hidden">
                <button
                  onClick={() => {
                    setActiveId(contact.user_id);
                    setCallModalOpen(false);
                  }}
                  className={`flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 xl:gap-3 xl:px-4 xl:py-3 ${Number(activeId) === Number(contact.user_id) ? activeClass : ""
                    }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold dark:bg-slate-700 xl:h-10 xl:w-10 xl:text-sm">
                    {contact.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-1.5">
                      <strong className="truncate text-[13px] xl:text-sm">{contact.name}</strong>
                      <span className="shrink-0 text-[10.5px] capitalize text-slate-400 xl:text-[11px]">{contact.role}</span>
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {(() => {
                        const rep = last ? parseRefusalReport(last.message) : null;
                        if (rep) {
                          return (
                            <span className="inline-flex max-w-full items-center gap-1 truncate font-semibold text-rose-600 dark:text-rose-400">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                              <span className="truncate">Refusal Report · {rep.txn || rep.reason}</span>
                            </span>
                          );
                        }
                        return last ? last.message : "No messages yet";
                      })()}
                    </span>
                  </span>
                  {unread > 0 && (
                    <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[12px] font-bold text-white ${btnClass.split(" ")[0]}`}>
                      {unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/* USAPAN */}
      <section className={`min-w-0 w-full min-h-0 flex-col overflow-hidden ${directMode || active ? "flex" : "hidden md:flex"}`}>
        {!active ? (
          <div className="m-auto p-6 text-center text-slate-500">
            <Icon name="message-circle" className="text-4xl opacity-50" />
            <p className="mt-3 text-sm">
              {directMode ? "No coordinator is available right now." : "Select a conversation to start messaging."}
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="flex items-center gap-3 min-w-0">
                {!directMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(null);
                      setCallModalOpen(false);
                    }}
                    aria-label="Back"
                    className="md:hidden text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    <Icon name="arrow-left" />
                  </button>
                )}
                <div className="min-w-0">
                  <strong className="block truncate text-slate-800 dark:text-slate-100">{active.name}</strong>
                  <span className="text-xs capitalize text-slate-400">{active.role}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCallModalOpen(true)}
                title={`Call ${active.name}`}
                aria-label={`Call ${active.name}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-brand hover:text-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand dark:hover:text-brand"
              >
                <Icon name="phone" className="text-brand text-xs" />
                <span>Call</span>
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {thread.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No messages yet. Say hello!</p>}
              {thread.map((m) => {
                const mine = Number(m.sender_id) === me;
                const refusalReport = parseRefusalReport(m.message);

                if (refusalReport) {
                  const isRthInitiated =
                    initiatedRthSet.has(String(refusalReport.txn).trim()) ||
                    initiatedRthSet.has(String(refusalReport.parcelId).trim()) ||
                    (() => {
                      const rec = getDeliveryRecordForParcel(refusalReport.parcelId || refusalReport.txn);
                      return rec?.status === "return_to_hub" || rec?.returnToHub;
                    })();

                  return (
                    <div
                      key={m.message_id}
                      className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`w-full max-w-[95%] sm:max-w-md rounded-2xl border p-4 shadow-sm ${mine
                            ? "border-amber-300 bg-amber-50/90 text-slate-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-slate-100"
                            : "border-rose-300 bg-rose-50/90 text-slate-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-slate-100"
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-rose-200/70 pb-2.5 dark:border-rose-900/40">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">
                              <Icon name="triangle-alert" className="text-sm" />
                            </span>
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                                Failed Delivery · Recipient Refusal
                              </h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Direct Rider Incident Report
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                            Refused
                          </span>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500 dark:text-slate-400">Tracking / Txn:</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {refusalReport.txn || refusalReport.parcelId}
                            </span>
                          </div>
                          {refusalReport.receiver && (
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500 dark:text-slate-400">Receiver:</span>
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {refusalReport.receiver}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-500 dark:text-slate-400">Refusal Reason:</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">
                              {refusalReport.reason}
                            </span>
                          </div>
                          {refusalReport.rider && (
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-500 dark:text-slate-400">Reporting Rider:</span>
                              <span className="text-slate-700 dark:text-slate-300">
                                {refusalReport.rider}
                              </span>
                            </div>
                          )}
                          {refusalReport.notes && (
                            <div className="mt-1.5 rounded-lg bg-white/70 p-2 text-[11px] italic text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                              "{refusalReport.notes}"
                            </div>
                          )}
                        </div>

                        {/* Coordinator action button */}
                        {myRole === "coordinator" && (
                          <div className="mt-4 border-t border-rose-200/70 pt-3 dark:border-rose-900/40">
                            {isRthInitiated ? (
                              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                <Icon name="circle-check" />
                                <span>Return to Hub Approved</span>
                              </div>
                            ) : (
                              <div>
                                <button
                                  type="button"
                                  disabled={initiatingRthId === (refusalReport.parcelId || refusalReport.txn)}
                                  onClick={() => handleInitiateRth(refusalReport)}
                                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.99] disabled:opacity-50"
                                >
                                  <Icon name="undo-2" />
                                  {initiatingRthId === (refusalReport.parcelId || refusalReport.txn)
                                    ? "Initiating Return to Hub…"
                                    : "Initiate Return to Hub"}
                                </button>
                                <p className="mt-1.5 text-center text-[10.5px] text-slate-500 dark:text-slate-400">
                                  Approve Return to Hub for this parcel.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <small className="mt-1 text-[11px] text-slate-400">
                        {formatDate(m.created_at)}
                        {mine && <> · {m.is_read ? "Read" : "Sent"}</>}
                      </small>
                    </div>
                  );
                }

                return (
                  <div key={m.message_id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${mine ? `${btnClass.split(" ")[0]} text-white` : "bg-slate-100 dark:bg-slate-800"
                        }`}
                    >
                      {m.message}
                    </div>
                    <small className="mt-1 text-[11px] text-slate-400">
                      {formatDate(m.created_at)}
                      {mine && <> · {m.is_read ? "Read" : "Sent"}</>}
                    </small>
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>

            <form onSubmit={onSend} className="border-t border-slate-200 p-3 dark:border-slate-700">
              {sendError && <p role="alert" className="mb-2 text-xs text-red-600 dark:text-red-400">{sendError}</p>}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={coordinatorOnly ? "Message the Coordinator" : "Type a message"}
                  aria-label="Message"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2.5 text-sm outline-none dark:border-slate-600"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${btnClass}`}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {/* Click-to-Call Modal */}
      {callModalOpen && active && (
        <CallUserModal
          active={active}
          onClose={() => setCallModalOpen(false)}
        />
      )}
    </div>
    </div>
  );
}
