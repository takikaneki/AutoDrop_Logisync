import { STAGE, useMyDeliveries } from "../../store/riderDeliveries.js";

const TABS = [
  [STAGE.TO_DELIVER, "To Be Delivered", "To Be Delivered"],
  [STAGE.DELIVERED, "Delivered", "Delivered"],
  [STAGE.FAILED, "Failed / Return to Hub", "Failed / Return"],
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
    <>
      {/* Mobile Lalamove-style sticky top horizontal filter bar (max-[820px] ONLY) */}
      <div
        role="tablist"
        aria-label="Delivery lists"
        className="sticky top-14 z-30 -mx-3.5 -mt-3.5 mb-4 max-[380px]:-mx-2.5 grid grid-cols-3 border-b border-slate-200/90 bg-white/95 backdrop-blur-md min-[821px]:hidden dark:border-night-line dark:bg-night-panel/95"
      >
        {TABS.map(([stage, _desktopLabel, mobileLabel]) => {
          const active = value === stage;
          const count = countForStage(mine, stage);
          return (
            <button
              key={stage}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(stage)}
              className={`relative flex items-center justify-center gap-1 px-1 py-3.5 text-[12px] max-[360px]:text-[11px] leading-tight transition ${
                active
                  ? "font-extrabold text-brand"
                  : "font-semibold text-slate-500 hover:text-[#0f172a] dark:text-[#b8b0a8] dark:hover:text-white"
              }`}
            >
              <span className="truncate">{mobileLabel}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  active
                    ? "bg-brand/12 text-brand"
                    : "bg-slate-100 text-slate-500 dark:bg-night-head dark:text-[#b8b0a8]"
                }`}
              >
                {count}
              </span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 bottom-0 h-[2.5px] rounded-full bg-brand"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop 3-column tab bar (min-[821px] — 100% unchanged) */}
      <div
        role="tablist"
        aria-label="Delivery lists"
        className="mb-5 hidden min-[821px]:grid grid-cols-3 gap-2 rounded-2xl border border-[#eee] bg-white p-1.5 dark:border-night-line dark:bg-night-panel"
      >
        {TABS.map(([stage, desktopLabel]) => {
          const active = value === stage;
          return (
            <button
              key={stage}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(stage)}
              className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-[14px] transition ${
                active
                  ? "bg-brand font-bold text-white"
                  : "font-semibold text-[#777] hover:bg-[#fff3eb] hover:text-brand dark:text-[#d1c9c2] dark:hover:bg-night-line"
              }`}
            >
              <span className="truncate">{desktopLabel}</span>
              <span className="shrink-0 rounded-full bg-black/10 px-2.5 py-0.5 text-[12px] font-bold">
                {countForStage(mine, stage)}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
