import { useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { EmptyState, Modal, TableSkeleton } from "../components/ui.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, td, textareaCls, th } from "../components/styles.js";
import Pagination from "../components/Pagination.jsx";
import { addComplaintNote, updateComplaint, useComplaints } from "../store/records.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";
import { useFakeLoading } from "../utils/useFakeLoading.js";

const statusTone = {
  Open: "bg-[#fff0f0] text-[#d94747]",
  "In Progress": "bg-[#fef3c7] text-[#d97706]",
  Resolved: "bg-[#eaf8ef] text-[#29945a]",
};
const prioTone = { High: "text-[#d94747]", Medium: "text-[#e99a00]", Low: "text-[#29945a]" };
const PAGE_SIZE = 6;

export default function Complaints() {
  const list = useComplaints();
  const loading = useFakeLoading();
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [note, setNote] = useState("");

  const rows = list.filter(
    (c) =>
      (status === "All" || c.status === status) &&
      (priority === "All" || c.priority === priority) &&
      (!search.trim() || [c.id, c.from, c.subject].some((v) => v.toLowerCase().includes(search.toLowerCase().trim())))
  );
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const current = openId && list.find((c) => c.id === openId);

  const setStatusFor = (c, next) => {
    // TODO: PATCH /api/complaints/:id
    updateComplaint(c.id, { status: next });
    logAction({ category: "Complaints", action: next === "Resolved" ? "Resolved complaint" : `Marked complaint ${next}`, target: c.id, detail: c.subject });
    toast(`${c.id} marked as ${next}.`);
  };

  const addNote = () => {
    if (!note.trim()) return toast("Please type a note first.", "error");
    addComplaintNote(current.id, note.trim());
    setNote("");
    toast("Note added.");
  };

  const counts = ["Open", "In Progress", "Resolved"].map((s) => [s, list.filter((c) => c.status === s).length]);

  return (
    <>
      <Topbar title="Complaints" subtitle="Tickets from sellers and riders that need a coordinator's attention." />

      <section className="grid grid-cols-3 gap-5 mb-7 max-[700px]:grid-cols-1">
        {counts.map(([s, n]) => (
          <button key={s} onClick={() => { setStatus(status === s ? "All" : s); setPage(1); }} className={`${panel} p-6 text-left transition hover:border-brand ${status === s ? "!border-brand" : ""}`}>
            <span className={`inline-block px-3 py-1 rounded-full text-[12px] font-semibold ${statusTone[s]}`}>{s}</span>
            <strong className="block text-[32px] mt-3 leading-none">{n}</strong>
          </button>
        ))}
      </section>

      <section className={`${panel} p-6`}>
        <div className="grid grid-cols-[1fr_170px_170px] gap-3 mb-5 max-[800px]:grid-cols-1">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search ticket, person or subject..." className={`${inputCls} pl-9`} />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={inputCls} aria-label="Filter by status">
            {["All", "Open", "In Progress", "Resolved"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className={inputCls} aria-label="Filter by priority">
            {["All", "High", "Medium", "Low"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="w-full overflow-x-auto border border-[#eee] rounded-[10px] dark:border-night-line">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head"><tr>{["Ticket", "From", "Subject", "Priority", "Date", "Status", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            {loading ? <TableSkeleton rows={6} cols={7} /> : (
              <tbody>
                {pageRows.map((c) => (
                  <tr key={c.id} className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                    <td className={`${td} font-bold text-[#333] dark:text-[#f1eeeb]`}>{c.id}</td>
                    <td className={td}>{c.from}<small className="block text-[11px] text-[#aaa]">{c.role}</small></td>
                    <td className={`${td} max-w-[280px]`}><span className="line-clamp-2">{c.subject}</span></td>
                    <td className={`${td} font-semibold ${prioTone[c.priority]}`}>{c.priority}</td>
                    <td className={`${td} whitespace-nowrap`}>{c.date}</td>
                    <td className={td}><span className={`px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap ${statusTone[c.status]}`}>{c.status}</span></td>
                    <td className={`${td} text-right`}><button onClick={() => setOpenId(c.id)} className="text-brand text-[13px] font-semibold hover:underline">Open</button></td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {!loading && rows.length === 0 && <EmptyState icon="fa-inbox" title="No complaints found" text="Nothing matches these filters." />}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
      </section>

      <Modal open={!!current} onClose={() => { setOpenId(null); setNote(""); }} z="z-[3500]" className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto p-7 dark:bg-night-panel">
        {current && (
          <>
            <button onClick={() => { setOpenId(null); setNote(""); }} aria-label="Close" className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"><i className="fa-solid fa-xmark" /></button>
            <div className="flex items-center gap-2 mb-2">
              <strong className="text-[14px] text-[#999]">{current.id}</strong>
              <span className={`px-3 py-1 rounded-full text-[12px] font-semibold ${statusTone[current.status]}`}>{current.status}</span>
              <span className={`text-[12px] font-bold ${prioTone[current.priority]}`}>{current.priority} priority</span>
            </div>
            <h3 className="text-[18px] font-bold mb-1 pr-8">{current.subject}</h3>
            <p className="text-[13px] text-[#999] mb-4">{current.from} ({current.role}) · {current.category} · {current.date}</p>
            <p className="text-[14px] leading-relaxed mb-5 p-4 rounded-xl bg-[#fffaf7] border border-[#ffe9dc] dark:bg-night-head dark:border-night-line">{current.description}</p>

            <h4 className="text-[14px] font-bold mb-2">Notes</h4>
            {current.notes.length === 0 ? <p className="text-[13px] text-[#999] mb-3">No notes yet.</p> : (
              <ul className="mb-3 space-y-2">{current.notes.map((n, i) => <li key={i} className="text-[13px] px-3 py-2 rounded-lg bg-[#f7f7f8] dark:bg-night-head"><i className="fa-regular fa-note-sticky mr-1.5 text-brand" />{n}</li>)}</ul>
            )}
            <label className={labelCls} htmlFor="cnote">Add a note</label>
            <textarea id="cnote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={textareaCls} placeholder="What was done or what is needed next?" />
            <div className="flex gap-2.5 flex-wrap mt-4">
              <button onClick={addNote} className={btnGhost}><i className="fa-solid fa-plus" /> Add note</button>
              {current.status === "Open" && <button onClick={() => setStatusFor(current, "In Progress")} className={btnGhost}>Start working</button>}
              {current.status !== "Resolved" && <button onClick={() => setStatusFor(current, "Resolved")} className={btnPrimary}><i className="fa-solid fa-check" /> Mark resolved</button>}
              {current.status === "Resolved" && <button onClick={() => setStatusFor(current, "Open")} className={btnGhost}>Reopen</button>}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
