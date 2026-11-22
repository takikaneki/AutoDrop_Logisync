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
import Icon from "../Icon.jsx";

// Coordinator: Return to Hub parcels (lampas sa 3-day rescheduling limit) at active rescheduled deliveries.
export default function FailedDeliveryReview({ mode = "all" }) {
  const all = useFailedDeliveries();
  const [coordTarget, setCoordTarget] = useState(null);
  const [note, setNote] = useState("");

  const showReturnToHub = mode === "all" || mode === "return_to_hub";
  const showRescheduled = mode === "all" || mode === "rescheduled";

  const returnToHub = showReturnToHub
    ? all
        .filter((x) => (x.returnToHub || x.status === "return_to_hub") && !x.returnCoordinated)
        .sort((a, b) => (b.failedAt || 0) - (a.failedAt || 0))
    : [];

  const rescheduled = showRescheduled
    ? all
        .filter((x) => !x.returnToHub && (x.status === "rescheduled" || x.status === "pending"))
        .sort((a, b) => (b.failedAt || 0) - (a.failedAt || 0))
    : [];

  const history = all
    .filter((x) => x.returnCoordinated || x.status === "return_coordinated" || x.status === "confirmed" || x.status === "declined")
    .sort((a, b) => (b.decidedAt || b.failedAt || 0) - (a.decidedAt || a.failedAt || 0))
    .slice(0, 6);

  if (!returnToHub.length && !rescheduled.length && (mode !== "all" || !history.length)) return null;

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
      <PanelTitle icon="undo-2">
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

      {/* 1. Return to Hub (Reached 3-Day Limit) — Compact */}
      {returnToHub.length > 0 && (
        <div className="mb-4">
          <ul className="space-y-2.5">
            {returnToHub.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d8b4fe] bg-[#faf7ff] px-4 py-3 dark:border-[#5b21b6] dark:bg-[#221933]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[14.5px]">{e.transaction_number}</strong>
                    <span className="rounded-full bg-[#f2ecff] px-2.5 py-0.5 text-[11px] font-bold text-[#7c3aed]">
                      Return to Hub ({MAX_RESCHEDULES}/{MAX_RESCHEDULES} Days)
                    </span>
                    <small className="text-[11.5px] text-[#999]">{timeAgo(e.failedAt)}</small>
                  </div>
                  <span className="mt-1 block text-[12.5px] text-[#666] dark:text-[#d1c9c2]">
                    {e.receiver || "Customer"} · {e.rider_name || "Rider"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setCoordTarget(e);
                    setNote("");
                  }}
                  className={`${btnPrimary} !py-2 !px-3.5 text-[12.5px]`}
                >
                  <Icon name="undo-2" /> Coordinate Return to Seller
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Active Rescheduled Deliveries — Compact */}
      {rescheduled.length > 0 && (
        <div className="mb-2">
          <ul className="space-y-2.5">
            {rescheduled.map((e) => {
              const count = Number(e.rescheduleCount || 1);
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ffe0d0] bg-[#fffaf7] px-4 py-3 dark:border-night-line dark:bg-night-head"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[14.5px]">{e.transaction_number}</strong>
                      <span className="rounded-full bg-[#fff4d8] px-2.5 py-0.5 text-[11px] font-bold text-[#c98200]">
                        Reschedule next day · {formatDay(e.scheduledFor || nextDay(e.failedAt))} (Day {count}/{MAX_RESCHEDULES})
                      </span>
                      <small className="text-[11.5px] text-[#999]">{timeAgo(e.failedAt)}</small>
                    </div>
                    <span className="mt-1 block text-[12.5px] text-[#666] dark:text-[#d1c9c2]">
                      {e.receiver || "Customer"} · {e.rider_name || "Rider"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.status === "pending" && count < MAX_RESCHEDULES && (
                      <button onClick={() => confirmReschedule(e)} className={`${btnPrimary} !py-2 !px-3.5 text-[12.5px]`}>
                        <Icon name="calendar-check" /> Confirm ({formatDay(nextDay(e.failedAt))})
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setCoordTarget(e);
                        setNote("");
                      }}
                      className={`${btnGhost} !py-2 !px-3.5 text-[12.5px]`}
                    >
                      <Icon name="undo-2" /> Return to Hub
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
          icon="circle-check"
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
                    <Icon name="undo-2" className="mr-1" />
                    Return to Seller Coordinated
                  </span>
                ) : e.status === "confirmed" ? (
                  <span className="rounded-full bg-[#eaf8ef] px-3 py-1 text-[12px] font-semibold text-[#29945a]">
                    <Icon name="calendar-check" className="mr-1" />
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
