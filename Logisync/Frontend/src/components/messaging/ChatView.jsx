import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getRole, getUser } from "../../api.js";
import { listContacts, listMessages, markMessageRead, sendMessage } from "../../services/messageService.js";
import { formatDate } from "../../utils/format.js";

const POLL_MS = 15000;

// Messaging para sa Seller, Rider at Coordinator (iisang component).
// Backend rule: coordinator <-> seller/rider lang. Ang listahan ng contacts ay galing sa /api/users/contacts.
// Props na pang-itsura lang:  btnClass (kulay ng button/bubble), surface (kulay ng panel)
export default function ChatView({
  btnClass = "bg-brand hover:bg-brand-dark",
  activeClass = "bg-brand-soft dark:bg-night-head",
  surface = "bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800",
}) {
  const me = Number(getUser()?.user_id);
  const myRole = getRole();
  const coordinatorOnly = myRole !== "coordinator"; // seller at rider: Coordinator lang ang pwedeng kausapin
  const [params, setParams] = useSearchParams();

  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const marking = useRef(new Set());
  const bottom = useRef(null);

  const load = useCallback(async (silent = false) => {
    try {
      const [c, m] = await Promise.all([listContacts(), listMessages()]);
      // Dobleng proteksyon: kahit ano ang ibalik ng API, coordinator lang ang ipapakita sa seller/rider
      setContacts(coordinatorOnly ? c.filter((x) => x.role === "coordinator") : c);
      setMessages(m);
      setError("");
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [coordinatorOnly]);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

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

  if (loading) return <p className="py-10 text-center text-sm text-slate-500">Loading messages…</p>;
  if (error)
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
        {error}{" "}
        <button onClick={() => { setLoading(true); load(); }} className="font-semibold underline">Try again</button>
      </div>
    );

  return (
    <div className={`grid h-[calc(100vh-15rem)] min-h-[420px] overflow-hidden rounded-2xl border md:grid-cols-[300px_1fr] ${surface}`}>
      {/* LISTAHAN NG USAPAN */}
      <aside className={`flex min-h-0 flex-col border-slate-200 dark:border-slate-700 md:border-r ${active ? "hidden md:flex" : "flex"}`}>
        <div className="space-y-3 border-b border-slate-200 p-3 dark:border-slate-700">
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
        className={`rounded-md px-2 py-2 text-xs font-semibold transition ${
          roleFilter === option.value
            ? `${btnClass} text-white`
            : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
  )}

  <input
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder="Search name"
    aria-label="Search contacts"
    className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none dark:border-slate-600"
  />
</div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {rows.length === 0 && <li className="p-6 text-center text-sm text-slate-500">{coordinatorOnly ? "No coordinator is available right now." : "No contacts available."}</li>}
          {rows.map(({ contact, last, unread }) => (
            <li key={contact.user_id}>
              <button
                onClick={() => setActiveId(contact.user_id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  Number(activeId) === Number(contact.user_id) ? activeClass : ""
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold dark:bg-slate-700">
                  {contact.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <strong className="truncate text-sm">{contact.name}</strong>
                    <span className="shrink-0 text-[11px] capitalize text-slate-400">{contact.role}</span>
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {last ? last.message : "No messages yet"}
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

      {/* USAPAN */}
      <section className={`min-h-0 flex-col ${active ? "flex" : "hidden md:flex"}`}>
        {!active ? (
          <div className="m-auto p-6 text-center text-slate-500">
            <i className="fa-regular fa-comments text-4xl opacity-50" />
            <p className="mt-3 text-sm">Select a conversation to start messaging.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <button onClick={() => setActiveId(null)} aria-label="Back" className="md:hidden">
                <i className="fa-solid fa-arrow-left" />
              </button>
              <strong>{active.name}</strong>
              <span className="text-xs capitalize text-slate-400">{active.role}</span>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {thread.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No messages yet. Say hello!</p>}
              {thread.map((m) => {
                const mine = Number(m.sender_id) === me;
                return (
                  <div key={m.message_id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                        mine ? `${btnClass.split(" ")[0]} text-white` : "bg-slate-100 dark:bg-slate-800"
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
    </div>
  );
}
