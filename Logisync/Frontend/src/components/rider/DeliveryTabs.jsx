import { STAGE, useMyDeliveries } from "../../store/riderDeliveries.js";

const TABS = [
  [STAGE.TO_DELIVER, "To Be Delivered"],
  [STAGE.DELIVERED, "Delivered"],
  [STAGE.FAILED, "Failed"],
];

// Tab bar ng Deliveries page (To Be Delivered / Delivered / Failed), may bilang.
// value = kasalukuyang stage, onChange(stage) = lumipat ng tab.
export default function DeliveryTabs({ value, onChange }) {
  const mine = useMyDeliveries();
  return (
    <div role="tablist" aria-label="Delivery lists" className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-[#eee] bg-white p-1.5 dark:border-night-line dark:bg-night-panel">
      {TABS.map(([stage, label]) => {
        const active = value === stage;
        return (
          <button
            key={stage}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(stage)}
            className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-[14px] transition max-[420px]:flex-col max-[420px]:gap-0.5 max-[420px]:text-[13px] ${
              active ? "bg-brand font-bold text-white" : "font-semibold text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line"
            }`}
          >
            <span>{label}</span>
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-[12px] font-bold">{mine.filter((d) => d.stage === stage).length}</span>
          </button>
        );
      })}
    </div>
  );
}
