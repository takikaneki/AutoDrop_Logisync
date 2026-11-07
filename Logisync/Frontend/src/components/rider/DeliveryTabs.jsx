import { STAGE, useMyDeliveries } from "../../store/riderDeliveries.js";

const TABS = [
  [STAGE.TO_DELIVER, "To Be Delivered"],
  [STAGE.DELIVERED, "Delivered"],
  [STAGE.FAILED, "Failed / Return to Hub"],
];

function countForStage(list, stage) {
  if (stage === STAGE.TO_DELIVER) {
    return list.filter((d) => d.stage === STAGE.TO_DELIVER && !d.returnToHub).length;
  }
  if (stage === STAGE.FAILED) {
    return list.filter((d) => d.stage === STAGE.FAILED || d.stage === STAGE.RETURN_TO_HUB || d.returnToHub).length;
  }
  return list.filter((d) => d.stage === stage).length;
}

// Tab bar ng Deliveries page (To Be Delivered / Delivered / Failed & Return to Hub), may bilang.
export default function DeliveryTabs({ value, onChange }) {
  const mine = useMyDeliveries();
  return (
    <div
      role="tablist"
      aria-label="Delivery lists"
      className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-[#eee] bg-white p-1.5 max-[800px]:grid-cols-1 max-[800px]:gap-2 max-[800px]:p-2 dark:border-night-line dark:bg-night-panel"
    >
      {TABS.map(([stage, label]) => {
        const active = value === stage;
        return (
          <button
            key={stage}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(stage)}
            className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-[14px] transition max-[800px]:w-full max-[800px]:justify-between max-[800px]:px-4 max-[800px]:py-3 max-[800px]:text-[14px] ${
              active
                ? "bg-brand font-bold text-white"
                : "font-semibold text-[#777] hover:bg-[#fff3eb] hover:text-brand max-[800px]:bg-[#fafafa] dark:text-[#d1c9c2] dark:hover:bg-night-line dark:max-[800px]:bg-night-head"
            }`}
          >
            <span className="truncate">{label}</span>
            <span className="shrink-0 rounded-full bg-black/10 px-2.5 py-0.5 text-[12px] font-bold">
              {countForStage(mine, stage)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
