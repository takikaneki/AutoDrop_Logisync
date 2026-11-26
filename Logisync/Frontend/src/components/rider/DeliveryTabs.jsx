import { STAGE, useMyDeliveries } from "../../store/riderDeliveries.js";

const TABS = [
  {
    stage: STAGE.TO_DELIVER,
    desktopLabel: "To Be Delivered",
    mobileLabel: "To Deliver",
    textCls: "text-[#c84227] dark:text-[#fb923c]",
    badgeCls: "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-500/20 dark:text-[#fb923c]",
    barCls: "bg-[#d9482b]",
    desktopActiveCls: "bg-[#d9482b] text-white",
    desktopIdleCls: "text-[#c84227] hover:bg-[#fdeee9] dark:text-[#fb923c] dark:hover:bg-night-head",
  },
  {
    stage: STAGE.DELIVERED,
    desktopLabel: "Delivered",
    mobileLabel: "Delivered",
    textCls: "text-[#15803d] dark:text-[#4ade80]",
    badgeCls: "bg-[#dcfce7] text-[#15803d] dark:bg-green-500/20 dark:text-[#4ade80]",
    barCls: "bg-[#16a34a]",
    desktopActiveCls: "bg-[#16a34a] text-white",
    desktopIdleCls: "text-[#15803d] hover:bg-[#eaf8ef] dark:text-[#4ade80] dark:hover:bg-night-head",
  },
  {
    stage: STAGE.RESCHEDULED,
    desktopLabel: "Rescheduled",
    mobileLabel: "Rescheduled",
    textCls: "text-[#b45309] dark:text-[#fcd34d]",
    badgeCls: "bg-[#fef3c7] text-[#b45309] dark:bg-amber-500/20 dark:text-[#fcd34d]",
    barCls: "bg-[#d97706]",
    desktopActiveCls: "bg-[#d97706] text-white",
    desktopIdleCls: "text-[#b45309] hover:bg-[#fffbeb] dark:text-[#fcd34d] dark:hover:bg-night-head",
  },
  {
    stage: STAGE.FAILED,
    desktopLabel: "Failed / Return to Hub",
    mobileLabel: "Failed / Return",
    textCls: "text-[#dc2626] dark:text-[#ff7b7b]",
    badgeCls: "bg-[#fee2e2] text-[#dc2626] dark:bg-red-500/20 dark:text-[#ff7b7b]",
    barCls: "bg-[#dc2626]",
    desktopActiveCls: "bg-[#dc2626] text-white",
    desktopIdleCls: "text-[#dc2626] hover:bg-[#fef2f2] dark:text-[#ff7b7b] dark:hover:bg-night-head",
  },
];

function countForStage(list, stage) {
  if (stage === STAGE.TO_DELIVER) {
    return list.filter((d) => d.stage === STAGE.TO_DELIVER && !d.rescheduled && !d.returnToHub).length;
  }
  if (stage === STAGE.RESCHEDULED) {
    return list.filter((d) => d.stage === STAGE.TO_DELIVER && Boolean(d.rescheduled) && !d.returnToHub).length;
  }
  if (stage === STAGE.FAILED) {
    return list.filter((d) => d.stage === STAGE.FAILED || d.stage === STAGE.RETURN_TO_HUB || d.returnToHub).length;
  }
  return list.filter((d) => d.stage === stage).length;
}

// 4-Tab Filter Bar ng Deliveries page:
// 1. To Be Delivered | 2. Delivered | 3. Rescheduled | 4. Failed / Return to Hub
export default function DeliveryTabs({ value, onChange }) {
  const mine = useMyDeliveries();

  return (
    <>
      {/* Mobile sticky top 4-tab horizontal filter bar (max-[820px] ONLY) */}
      <div
        role="tablist"
        aria-label="Delivery lists"
        className="sticky top-14 z-30 -mx-3.5 -mt-3.5 mb-4 max-[380px]:-mx-2.5 grid grid-cols-4 border-b border-slate-200/90 bg-white/95 backdrop-blur-md min-[821px]:hidden dark:border-night-line dark:bg-night-panel/95"
      >
        {TABS.map((tab) => {
          const active = value === tab.stage;
          const count = countForStage(mine, tab.stage);
          return (
            <button
              key={tab.stage}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.stage)}
              className={`relative flex items-center justify-center gap-1 px-1 py-3.5 text-[11.5px] max-[360px]:text-[10.5px] leading-tight transition ${tab.textCls} ${
                active ? "font-extrabold" : "font-bold opacity-85 hover:opacity-100"
              }`}
            >
              <span className="truncate">{tab.mobileLabel}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${tab.badgeCls}`}
              >
                {count}
              </span>
              {active && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-2 bottom-0 h-[2.5px] rounded-full ${tab.barCls}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop 4-column tab bar (min-[821px]) */}
      <div
        role="tablist"
        aria-label="Delivery lists"
        className="mb-5 hidden min-[821px]:grid grid-cols-4 gap-2 rounded-2xl border border-[#eee] bg-white p-1.5 dark:border-night-line dark:bg-night-panel"
      >
        {TABS.map((tab) => {
          const active = value === tab.stage;
          return (
            <button
              key={tab.stage}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.stage)}
              className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-[14px] transition ${
                active
                  ? `${tab.desktopActiveCls} font-bold`
                  : `${tab.desktopIdleCls} font-bold`
              }`}
            >
              <span className="truncate">{tab.desktopLabel}</span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                  active ? "bg-black/15 text-white" : tab.badgeCls
                }`}
              >
                {countForStage(mine, tab.stage)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
