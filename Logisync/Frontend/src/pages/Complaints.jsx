import { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { EmptyState, Modal, TableSkeleton } from "../components/ui.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, td, textareaCls, th } from "../components/styles.js";
import Pagination from "../components/Pagination.jsx";
import {
  fetchComplaints,
  markComplaintsAsRead,
  updateComplaintStatus,
} from "../services/complaintService.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";

const statusTone = {
  Open: "bg-[#fff0f0] text-[#d94747]",
  "In Progress": "bg-[#fef3c7] text-[#d97706]",
  Resolved: "bg-[#eaf8ef] text-[#29945a]",
};

const prioTone = {
  High: "text-[#d94747]",
  Medium: "text-[#e99a00]",
  Low: "text-[#29945a]",
};

const PAGE_SIZE = 6;

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [note, setNote] = useState("");
  const hasMarkedReadRef = useRef(false);

  // Load complaints from database on mount & automatically mark viewed complaints as READ
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const list = await fetchComplaints();
        if (!mounted) return;
        setComplaints(list);

        // Automatic Mark as Read: When Coordinator views complaints, mark unread records in database
        if (!hasMarkedReadRef.current) {
          hasMarkedReadRef.current = true;
          const unreadIds = list
            .filter((c) => !c.is_read)
            .map((c) => c.complaint_id || c.id)
            .filter(Boolean);

          if (unreadIds.length > 0) {
            await markComplaintsAsRead(unreadIds);
            if (!mounted) return;
            // Update local state to reflect read status across viewed records
            setComplaints((prev) =>
              prev.map((c) => ({
                ...c,
                is_read: true,
                read_at: c.read_at || new Date().toISOString(),
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load complaints:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const normalizedComplaints = useMemo(() => {
    return complaints.map((c) => {
      const id = c.complaint_id ? `C-${c.complaint_id}` : c.id || "C-0";
      const from = c.complainant_name || c.from || "User";
      const role = c.complainant_role || c.role || "User";
      const category = c.category || "General";
      const subject = c.subject || "Untitled";
      const description = c.description || "";
      const prio = c.priority || "Medium";
      const stat = c.status || "Open";
      const date = formatDate(c.created_at || c.date);
      const isRead = Boolean(c.is_read);

      let notesList = [];
      if (Array.isArray(c.notes)) {
        notesList = c.notes;
      } else if (typeof c.notes === "string" && c.notes.trim()) {
        try {
          const parsed = JSON.parse(c.notes);
          if (Array.isArray(parsed)) notesList = parsed;
        } catch {
          notesList = [];
        }
      }

      return {
        ...c,
        rawId: c.complaint_id || c.id,
        id,
        from,
        role,
        category,
        subject,
        description,
        priority: prio,
        status: stat,
        date,
        isRead,
        notesList,
      };
    });
  }, [complaints]);

  const rows = useMemo(() => {
    return normalizedComplaints.filter(
      (c) =>
        (status === "All" || c.status === status) &&
        (priority === "All" || c.priority === priority) &&
        (!search.trim() ||
          [c.id, c.from, c.subject, c.category]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(search.toLowerCase().trim())))
    );
  }, [normalizedComplaints, status, priority, search]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const current = openId && normalizedComplaints.find((c) => c.rawId === openId || c.id === openId);

  const setStatusFor = async (c, nextStatus) => {
    try {
      await updateComplaintStatus(c.rawId, { status: nextStatus });
      setComplaints((prev) =>
        prev.map((item) =>
          (item.complaint_id || item.id) === c.rawId ? { ...item, status: nextStatus } : item
        )
      );
      logAction({
        category: "Complaints",
        action: nextStatus === "Resolved" ? "Resolved complaint" : `Marked complaint ${nextStatus}`,
        target: c.id,
        detail: c.subject,
      });
      toast(`${c.id} marked as ${nextStatus}.`);
    } catch {
      toast("Could not update status. Please try again.", "error");
    }
  };

  const addNote = async () => {
    if (!note.trim()) return toast("Please type a note first.", "error");
    try {
      await updateComplaintStatus(current.rawId, { note: note.trim() });
      const newNoteObj = {
        id: `cn_${Date.now()}`,
        by: "Coordinator",
        role: "coordinator",
        text: note.trim(),
        ts: Date.now(),
      };
      setComplaints((prev) =>
        prev.map((item) => {
          if ((item.complaint_id || item.id) === current.rawId) {
            const currentNotes = Array.isArray(item.notes)
              ? item.notes
              : typeof item.notes === "string"
              ? JSON.parse(item.notes || "[]")
              : [];
            return { ...item, notes: [...currentNotes, newNoteObj] };
          }
          return item;
        })
      );
      setNote("");
      toast("Note added.");
    } catch {
      toast("Could not save note. Please try again.", "error");
    }
  };

  const counts = ["Open", "In Progress", "Resolved"].map((s) => [
    s,
    normalizedComplaints.filter((c) => c.status === s).length,
  ]);

  return (
    <>
      <Topbar
        title="Complaints"
        subtitle="Tickets from sellers and riders that need a coordinator's attention."
      />

      {/* Summary KPI Cards */}
      <section className="grid grid-cols-3 gap-5 mb-7 max-[700px]:grid-cols-1">
        {counts.map(([s, n]) => (
          <button
            key={s}
            onClick={() => {
              setStatus(status === s ? "All" : s);
              setPage(1);
            }}
            className={`${panel} p-6 text-left transition hover:border-brand ${
              status === s ? "!border-brand ring-2 ring-brand/15" : ""
            }`}
          >
            <span className={`inline-block px-3 py-1 rounded-full text-[12px] font-semibold ${statusTone[s]}`}>
              {s}
            </span>
            <strong className="block text-[32px] mt-3 leading-none">{n}</strong>
          </button>
        ))}
      </section>

      <section className={`${panel} p-6 max-[600px]:p-4`}>
        {/* Filters */}
        <div className="grid grid-cols-[1fr_170px_170px] gap-3 mb-5 max-[800px]:grid-cols-1">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search ticket, person or subject..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={inputCls}
            aria-label="Filter by status"
          >
            {["All", "Open", "In Progress", "Resolved"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
            className={inputCls}
            aria-label="Filter by priority"
          >
            {["All", "High", "Medium", "Low"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Desktop & Tablet Table Layout */}
        <div className="hidden min-[768px]:block w-full overflow-x-auto border border-[#eee] rounded-[10px] dark:border-night-line">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head">
              <tr>
                {["Ticket", "From", "Category", "Subject", "Priority", "Date", "Status", ""].map((h, i) => (
                  <th key={i} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton rows={6} cols={8} />
            ) : (
              <tbody>
                {pageRows.map((c) => (
                  <tr
                    key={c.id}
                    className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head"
                  >
                    <td className={`${td} font-bold text-[#333] dark:text-[#f1eeeb]`}>
                      <div className="flex items-center gap-1.5">
                        <span>{c.id}</span>
                        {!c.isRead && (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-brand"
                            title="Unread complaint"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                    </td>
                    <td className={td}>
                      {c.from}
                      <small className="block text-[11px] text-[#aaa] capitalize">{c.role}</small>
                    </td>
                    <td className={td}>
                      <span className="inline-block rounded-md bg-[#f4f5f8] px-2 py-0.5 text-[11px] font-semibold text-[#555] dark:bg-night-line dark:text-[#ccc]">
                        {c.category}
                      </span>
                    </td>
                    <td className={`${td} max-w-[280px]`}>
                      <span className="line-clamp-2">{c.subject}</span>
                    </td>
                    <td className={`${td} font-semibold ${prioTone[c.priority]}`}>{c.priority}</td>
                    <td className={`${td} whitespace-nowrap`}>{c.date}</td>
                    <td className={td}>
                      <span
                        className={`px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap ${
                          statusTone[c.status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className={`${td} text-right`}>
                      <button
                        onClick={() => setOpenId(c.rawId)}
                        className="text-brand text-[13px] font-semibold hover:underline"
                      >
                        Open Ticket
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {!loading && rows.length === 0 && (
            <EmptyState
              icon="fa-inbox"
              title="No complaints found"
              text="No complaints match your active filters."
            />
          )}
        </div>

        {/* Mobile View: Dedicated Individual Cards */}
        <div className="min-[768px]:hidden space-y-3.5">
          {loading ? (
            <div className="py-10 text-center text-[13px] text-[#888]">
              <i className="fa-solid fa-spinner fa-spin mr-2 text-brand" />
              Loading complaints…
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon="fa-inbox"
              title="No complaints found"
              text="No complaints match your active filters."
            />
          ) : (
            pageRows.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-[#edf0f4] bg-white p-4 shadow-sm transition hover:shadow-md dark:border-night-line dark:bg-night-head"
              >
                {/* Header: Ticket ID + Badges */}
                <div className="flex items-center justify-between gap-2 border-b border-[#f4f6f8] pb-2.5 dark:border-night-line">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-extrabold text-brand tracking-wide">{c.id}</span>
                    {!c.isRead && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-brand">
                        New
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      statusTone[c.status] || "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                {/* Subject & Category */}
                <div className="mt-2.5">
                  <h3 className="text-[15px] font-bold text-[#1f2937] leading-snug break-words dark:text-[#f1eeeb]">
                    {c.subject}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-[#6b7280] dark:text-[#9ca3af]">
                    <span className="font-semibold text-[#374151] dark:text-[#e5e7eb]">{c.from}</span>
                    <span>·</span>
                    <span className="capitalize">{c.role}</span>
                    <span>·</span>
                    <span className="inline-block rounded-md bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-semibold text-[#4b5563] dark:bg-night-line dark:text-[#d1d5db]">
                      {c.category}
                    </span>
                  </div>
                </div>

                {/* Description snippet if available */}
                {c.description && (
                  <p className="mt-2 text-[13px] text-[#6b7280] line-clamp-2 leading-relaxed dark:text-[#9ca3af]">
                    {c.description}
                  </p>
                )}

                {/* Footer: Priority + Date + Action Button */}
                <div className="mt-3.5 flex items-center justify-between border-t border-[#f4f6f8] pt-3 text-[12px] dark:border-night-line">
                  <div className="flex items-center gap-2 text-[#9ca3af]">
                    <span className={`font-bold ${prioTone[c.priority]}`}>
                      <i className="fa-solid fa-circle text-[8px] mr-1" />
                      {c.priority} Priority
                    </span>
                    <span>·</span>
                    <span>{c.date}</span>
                  </div>
                  <button
                    onClick={() => setOpenId(c.rawId)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-brand-soft px-3.5 py-1.5 text-[12.5px] font-bold text-brand transition hover:bg-brand hover:text-white dark:bg-night-line dark:hover:bg-brand"
                  >
                    <span>Open Ticket</span>
                    <i className="fa-solid fa-arrow-right text-[11px]" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
      </section>

      {/* Ticket Details Modal */}
      <Modal
        open={!!current}
        onClose={() => {
          setOpenId(null);
          setNote("");
        }}
        z="z-[3500]"
        className="w-full max-w-[580px] max-h-[90vh] overflow-y-auto p-7 max-[600px]:p-5 dark:bg-night-panel"
      >
        {current && (
          <>
            <button
              onClick={() => {
                setOpenId(null);
                setNote("");
              }}
              aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] flex items-center justify-center dark:bg-night-line"
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <strong className="text-[14px] text-brand">{current.id}</strong>
              <span
                className={`px-3 py-1 rounded-full text-[12px] font-semibold ${
                  statusTone[current.status] || "bg-slate-100 text-slate-700"
                }`}
              >
                {current.status}
              </span>
              <span className={`text-[12px] font-bold ${prioTone[current.priority]}`}>
                {current.priority} priority
              </span>
            </div>
            <h3 className="text-[19px] font-bold mb-1 pr-8 text-[#1f2937] dark:text-[#f1eeeb]">
              {current.subject}
            </h3>
            <p className="text-[13px] text-[#999] mb-4">
              {current.from} ({current.role}) · {current.category} · {current.date}
            </p>
            <div className="text-[14px] leading-relaxed mb-5 p-4 rounded-xl bg-[#fffaf7] border border-[#ffe9dc] dark:bg-night-head dark:border-night-line whitespace-pre-wrap">
              {current.description}
            </div>

            <h4 className="text-[14px] font-bold mb-2">Notes</h4>
            {current.notesList.length === 0 ? (
              <p className="text-[13px] text-[#999] mb-3">No notes yet.</p>
            ) : (
              <ul className="mb-3 space-y-2">
                {current.notesList.map((n, i) => (
                  <li
                    key={n.id || i}
                    className="text-[13px] px-3.5 py-2.5 rounded-lg bg-[#f7f7f8] dark:bg-night-head"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#888] mb-1">
                      <span className="font-semibold text-[#444] dark:text-[#ccc]">{n.by || "Coordinator"}</span>
                      {n.ts && <span>{new Date(n.ts).toLocaleDateString()}</span>}
                    </div>
                    <p className="text-[#333] dark:text-[#f1eeeb]">{n.text || n}</p>
                  </li>
                ))}
              </ul>
            )}

            <label className={labelCls} htmlFor="cnote">
              Add internal note
            </label>
            <textarea
              id="cnote"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={textareaCls}
              placeholder="What was done or what is needed next?"
            />
            <div className="flex gap-2.5 flex-wrap mt-4">
              <button onClick={addNote} className={btnGhost}>
                <i className="fa-solid fa-plus mr-1" /> Add note
              </button>
              {current.status === "Open" && (
                <button onClick={() => setStatusFor(current, "In Progress")} className={btnGhost}>
                  Start working
                </button>
              )}
              {current.status !== "Resolved" && (
                <button onClick={() => setStatusFor(current, "Resolved")} className={btnPrimary}>
                  <i className="fa-solid fa-check mr-1" /> Mark resolved
                </button>
              )}
              {current.status === "Resolved" && (
                <button onClick={() => setStatusFor(current, "Open")} className={btnGhost}>
                  Reopen
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
