import { useState } from "react";
import { EmptyState, Modal } from "../ui.jsx";
import { btnGhost, btnPrimary, labelCls, panel, textareaCls } from "../styles.js";
import { PanelTitle } from "../portal.jsx";
import { decideReschedule, nextDay, useFailedDeliveries } from "../../store/failedDeliveries.js";
import { logAction } from "../../store/audit.js";
import { toast } from "../../store/toast.js";
import { formatDay } from "../../utils/format.js";
import { timeAgo } from "../../store/notifications.js";

// Coordinator: mga failed delivery na naghihintay ng desisyon, at mga naka-reschedule na.
export default function FailedDeliveryReview() {
  const all = useFailedDeliveries();
  const [declining, setDeclining] = useState(null);
  const [note, setNote] = useState("");

  const pending = all.filter((x) => x.status === "pending").sort((a, b) => b.failedAt - a.failedAt);
  const decided = all.filter((x) => x.status === "confirmed" || x.status === "declined").sort((a, b) => b.decidedAt - a.decidedAt).slice(0, 5);
  if (!pending.length && !decided.length) return null;

  const confirm = (e) => {
    const r = decideReschedule(e.id, true);
    if (!r) return;
    logAction({ category: "Deliveries", action: "Confirmed reschedule", target: e.transaction_number, detail: `${e.rider_name} · ${formatDay(r.scheduledFor)}` });
    toast(`${e.transaction_number} rescheduled for ${formatDay(r.scheduledFor)}. ${e.rider_name} was notified.`);
  };
  const decline = () => {
    const e = declining;
    decideReschedule(e.id, false, { note: note.trim() });
    logAction({ category: "Deliveries", action: "Declined reschedule", target: e.transaction_number, detail: note.trim() || e.reason });
    toast(`Reschedule declined. ${e.rider_name} was notified.`, "info");
    setDeclining(null);
    setNote("");
  };

  return (
    <section className={`${panel} mb-6 p-[26px] max-[600px]:p-5`} aria-label="Failed deliveries">
      <PanelTitle icon="fa-calendar-xmark">
        Failed Deliveries
        {pending.length > 0 && <span className="ml-2 rounded-full bg-[#fff0f0] px-2.5 py-0.5 align-middle text-[12px] font-bold text-[#d94747]">{pending.length} to review</span>}
      </PanelTitle>

      {pending.length === 0 ? (
        <EmptyState icon="fa-circle-check" title="Nothing to review" text="Failed deliveries will appear here for your decision." />
      ) : (
        <ul className="space-y-3">
          {pending.map((e) => (
            <li key={e.id} className="rounded-xl border border-[#ffe0d0] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block text-[15px]">{e.transaction_number}</strong>
                  <span className="text-[13px] text-[#888]">{e.receiver}{e.seller ? ` · ${e.seller}` : ""}</span>
                </div>
                <small className="text-[12px] text-[#aaa]">{timeAgo(e.failedAt)}</small>
              </div>
              <p className="mt-2 text-[13px]">
                <i className="fa-solid fa-motorcycle mr-1.5 text-[#aaa]" />{e.rider_name} reported: <strong className="text-[#d94747]">{e.reason}</strong>
                {e.note && <span className="text-[#888]"> — {e.note}</span>}
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <button onClick={() => confirm(e)} className={btnPrimary}>
                  <i className="fa-solid fa-calendar-check" /> Reschedule for tomorrow ({formatDay(nextDay(e.failedAt))})
                </button>
                <button onClick={() => { setDeclining(e); setNote(""); }} className={btnGhost}>Don't reschedule</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[13px] font-bold text-[#777] dark:text-[#d1c9c2]">Recent decisions</h3>
          <ul>
            {decided.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0f4] py-2.5 text-[13px] last:border-0 dark:border-night-line">
                <span><strong>{e.transaction_number}</strong> <span className="text-[#888]">· {e.rider_name}</span></span>
                {e.status === "confirmed" ? (
                  <span className="rounded-full bg-[#eaf8ef] px-3 py-1 text-[12px] font-semibold text-[#29945a]"><i className="fa-solid fa-calendar-check mr-1" />Rescheduled · {formatDay(e.scheduledFor)}</span>
                ) : (
                  <span className="rounded-full bg-[#f1f1f1] px-3 py-1 text-[12px] font-semibold text-[#777] dark:bg-night-line dark:text-[#d1c9c2]">Not rescheduled</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={!!declining} onClose={() => setDeclining(null)} z="z-[4000]" className="w-full max-w-[440px] p-7 dark:bg-night-panel">
        {declining && (
          <>
            <h3 className="mb-1 text-[17px] font-bold">Don't reschedule?</h3>
            <p className="mb-4 text-[13px] text-[#999]">{declining.transaction_number} · {declining.rider_name} will be notified.</p>
            <label className={labelCls} htmlFor="decline-note">Note for the rider (optional)</label>
            <textarea id="decline-note" rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className={textareaCls} placeholder="e.g. The recipient cancelled the order." />
            <div className="mt-5 flex justify-end gap-2.5">
              <button onClick={() => setDeclining(null)} className={btnGhost}>Cancel</button>
              <button onClick={decline} className={btnPrimary}>Confirm</button>
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
