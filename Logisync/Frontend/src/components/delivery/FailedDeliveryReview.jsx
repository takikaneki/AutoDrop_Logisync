import { useState } from "react";
import { EmptyState, Modal } from "../ui.jsx";
import { btnGhost, btnPrimary, labelCls, panel, textareaCls } from "../styles.js";
import { PanelTitle } from "../portal.jsx";
import { coordinateReturn, decideReschedule, nextDay, useFailedDeliveries } from "../../store/failedDeliveries.js";
import { MAX_RESCHEDULES } from "../../store/riderDeliveries.js";
import { logAction } from "../../store/audit.js";
import { toast } from "../../store/toast.js";
import { formatDay } from "../../utils/format.js";
import { timeAgo } from "../../store/notifications.js";

// Coordinator: Return to Hub parcels (lampas sa 3-day rescheduling limit) at active rescheduled deliveries.
export default function FailedDeliveryReview() {
  const all = useFailedDeliveries();
  const [coordTarget, setCoordTarget] = useState(null);
  const [note, setNote] = useState("");

  const returnToHub = all
    .filter((x) => (x.returnToHub || x.status === "return_to_hub") && !x.returnCoordinated)
    .sort((a, b) => (b.failedAt || 0) - (a.failedAt || 0));

  const rescheduled = all
    .filter((x) => !x.returnToHub && (x.status === "rescheduled" || x.status === "pending"))
    .sort((a, b) => (b.failedAt || 0) - (a.failedAt || 0));

  const history = all
    .filter((x) => x.returnCoordinated || x.status === "return_coordinated" || x.status === "confirmed" || x.status === "declined")
    .sort((a, b) => (b.decidedAt || b.failedAt || 0) - (a.decidedAt || a.failedAt || 0))
    .slice(0, 6);

  if (!returnToHub.length && !rescheduled.length && !history.length) return null;

  const confirmReschedule = (e) => {
    if (Number(e.rescheduleCount || 0) >= MAX_RESCHEDULES || e.returnToHub) {
      toast("Maximum 3-day rescheduling limit reached. Please coordinate return to hub and seller.", "error");
      return;
    }
    const r = decideReschedule(e.id, true);
    if (!r) return;
    logAction({
      category: "Deliveries",
      action: "Confirmed reschedule",
      target: e.transaction_number,
      detail: `${e.rider_name} · ${formatDay(r.scheduledFor)} (Day ${r.rescheduleCount}/${MAX_RESCHEDULES})`,
    });
    toast(`${e.transaction_number} scheduled for ${formatDay(r.scheduledFor)}. ${e.rider_name} was notified.`);
  };

  const confirmCoordinateReturn = () => {
    const e = coordTarget;
    if (!e) return;
    coordinateReturn(e.parcel_id, { note: note.trim() });
    logAction({
      category: "Deliveries",
      action: "Coordinated Return to Seller",
      target: e.transaction_number,
      detail: `${e.seller || "Seller"} · ${note.trim() || "Reached 3-day rescheduling limit"}`,
    });
    toast(`Return to seller (${e.seller || "Seller"}) coordinated for ${e.transaction_number}.`);
    setCoordTarget(null);
    setNote("");
  };

  return (
    <section className={`${panel} mb-6 p-[26px] max-[600px]:p-5`} aria-label="Rescheduling & Return to Hub">
      <PanelTitle icon="fa-warehouse">
        Delivery Rescheduling & Return-to-Hub
        {returnToHub.length > 0 && (
          <span className="ml-2 rounded-full bg-[#f2ecff] px-2.5 py-0.5 align-middle text-[12px] font-bold text-[#7c3aed]">
            {returnToHub.length} Return to Hub
          </span>
        )}
        {rescheduled.length > 0 && (
          <span className="ml-2 rounded-full bg-[#fff4d8] px-2.5 py-0.5 align-middle text-[12px] font-bold text-[#c98200]">
            {rescheduled.length} Rescheduled
          </span>
        )}
      </PanelTitle>

      {/* 1. Return to Hub (Reached 3-Day Limit) */}
      {returnToHub.length > 0 && (
        <div className="mb-5">
          <h3 className="mb-2.5 flex items-center gap-2 text-[13.5px] font-bold text-[#7c3aed]">
            <i className="fa-solid fa-triangle-exclamation" /> Reached 3-Day Rescheduling Limit — Return to Hub Required
          </h3>
          <ul className="space-y-3">
            {returnToHub.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-[#d8b4fe] bg-[#faf7ff] p-4 dark:border-[#5b21b6] dark:bg-[#221933]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[15px]">{e.transaction_number}</strong>
                      <span className="rounded-full bg-[#f2ecff] px-2.5 py-0.5 text-[11px] font-bold text-[#7c3aed]">
                        Return to Hub ({MAX_RESCHEDULES}/{MAX_RESCHEDULES} Days)
                      </span>
                    </div>
                    <span className="mt-0.5 block text-[13px] text-[#777] dark:text-[#d1c9c2]">
                      Receiver: <strong>{e.receiver || "—"}</strong>
                      {e.seller ? ` · Seller: ${e.seller}` : ""}
                      {e.address ? ` · ${e.address}` : ""}
                    </span>
                  </div>
                  <small className="text-[12px] text-[#aaa]">{timeAgo(e.failedAt)}</small>
                </div>

                <p className="mt-2 text-[13px]">
                  <i className="fa-solid fa-motorcycle mr-1.5 text-[#aaa]" />
                  {e.rider_name || "Rider"} · Last failure: <strong className="text-[#d94747]">{e.reason}</strong>
                </p>

                {Array.isArray(e.attempts) && e.attempts.length > 0 && (
                  <div className="mt-2.5 rounded-lg border border-[#e9d5ff] bg-white/80 p-2.5 text-[12px] dark:border-night-line dark:bg-night-panel">
                    <strong className="block text-[11.5px] uppercase tracking-wide text-[#7c3aed]">
                      Delivery Attempt History ({e.attempts.length} attempts)
                    </strong>
                    <ul className="mt-1 space-y-1 text-[#555] dark:text-[#d1c9c2]">
                      {e.attempts.map((att, i) => (
                        <li key={att.id || i}>
                          • <strong>Attempt #{att.attempt || i + 1}</strong> ({formatDay(att.scheduledDate)}):{" "}
                          {att.reason}
                          {att.rescheduledTo
                            ? ` → Rescheduled to ${formatDay(att.rescheduledTo)} (Day ${att.rescheduleDay}/${MAX_RESCHEDULES})`
                            : " → Marked Return to Hub"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
                  <span className="text-[12px] font-semibold text-[#7c3aed]">
                    <i className="fa-solid fa-ban mr-1" /> Removed from rider&apos;s pending deliveries (cannot be rescheduled again)
                  </span>
                  <button
                    onClick={() => {
                      setCoordTarget(e);
                      setNote("");
                    }}
                    className={btnPrimary}
                  >
                    <i className="fa-solid fa-rotate-left" /> Coordinate Return to Seller
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Active Rescheduled Deliveries (Within 3-Day Window) */}
      {rescheduled.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2.5 flex items-center gap-2 text-[13.5px] font-bold text-[#c98200]">
            <i className="fa-solid fa-calendar-day" /> Active Rescheduled Deliveries (Max {MAX_RESCHEDULES} Days)
          </h3>
          <ul className="space-y-3">
            {rescheduled.map((e) => {
              const count = Number(e.rescheduleCount || 1);
              return (
                <li
                  key={e.id}
                  className="rounded-xl border border-[#ffe0d0] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-[15px]">{e.transaction_number}</strong>
                        <span className="rounded-full bg-[#fff4d8] px-2.5 py-0.5 text-[11px] font-bold text-[#c98200]">
                          Rescheduled (Day {count}/{MAX_RESCHEDULES}) · {formatDay(e.scheduledFor || nextDay(e.failedAt))}
                        </span>
                      </div>
                      <span className="mt-0.5 block text-[13px] text-[#888]">
                        {e.receiver}
                        {e.seller ? ` · ${e.seller}` : ""}
                      </span>
                    </div>
                    <small className="text-[12px] text-[#aaa]">{timeAgo(e.failedAt)}</small>
                  </div>
                  <p className="mt-2 text-[13px]">
                    <i className="fa-solid fa-motorcycle mr-1.5 text-[#aaa]" />
                    {e.rider_name} · Reason: <strong className="text-[#d94747]">{e.reason}</strong>
                    {e.note && <span className="text-[#888]"> — {e.note}</span>}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {e.status === "pending" && count < MAX_RESCHEDULES && (
                      <button onClick={() => confirmReschedule(e)} className={btnPrimary}>
                        <i className="fa-solid fa-calendar-check" /> Confirm Next Day ({formatDay(nextDay(e.failedAt))})
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setCoordTarget(e);
                        setNote("");
                      }}
                      className={btnGhost}
                    >
                      <i className="fa-solid fa-warehouse" /> Mark Return to Hub & Coordinate Seller Return
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {returnToHub.length === 0 && rescheduled.length === 0 && (
        <EmptyState
          icon="fa-circle-check"
          title="No pending Return-to-Hub or rescheduled items"
          text="Parcels that reach the 3-day rescheduling limit will appear here so you can coordinate their return to the seller."
        />
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[13px] font-bold text-[#777] dark:text-[#d1c9c2]">Recent Reschedule & Return History</h3>
          <ul>
            {history.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf0f4] py-2.5 text-[13px] last:border-0 dark:border-night-line"
              >
                <span>
                  <strong>{e.transaction_number}</strong>{" "}
                  <span className="text-[#888]">
                    · {e.receiver || "Customer"}
                    {e.seller ? ` (${e.seller})` : ""}
                  </span>
                </span>
                {e.returnCoordinated || e.status === "return_coordinated" ? (
                  <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-[12px] font-semibold text-[#4b78b5]">
                    <i className="fa-solid fa-rotate-left mr-1" />
                    Return to Seller Coordinated
                  </span>
                ) : e.status === "confirmed" ? (
                  <span className="rounded-full bg-[#eaf8ef] px-3 py-1 text-[12px] font-semibold text-[#29945a]">
                    <i className="fa-solid fa-calendar-check mr-1" />
                    Rescheduled · {formatDay(e.scheduledFor)}
                  </span>
                ) : (
                  <span className="rounded-full bg-[#f2ecff] px-3 py-1 text-[12px] font-semibold text-[#7c3aed]">
                    Return to Hub
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={!!coordTarget}
        onClose={() => setCoordTarget(null)}
        z="z-[4000]"
        className="w-full max-w-[440px] p-7 dark:bg-night-panel"
      >
        {coordTarget && (
          <>
            <h3 className="mb-1 text-[17px] font-bold">Coordinate Return to Seller</h3>
            <p className="mb-4 text-[13px] text-[#999]">
              {coordTarget.transaction_number} · Seller: <strong>{coordTarget.seller || "Seller"}</strong>
            </p>
            <label className={labelCls} htmlFor="return-note">
              Coordination instructions / note for Seller & Hub (optional)
            </label>
            <textarea
              id="return-note"
              rows={3}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={textareaCls}
              placeholder="e.g. Parcel received at hub after 3 failed delivery days. Returning to seller today."
            />
            <div className="mt-5 flex justify-end gap-2.5">
              <button onClick={() => setCoordTarget(null)} className={btnGhost}>
                Cancel
              </button>
              <button onClick={confirmCoordinateReturn} className={btnPrimary}>
                Confirm Return Coordination
              </button>
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
