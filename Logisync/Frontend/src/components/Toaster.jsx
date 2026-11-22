import { useNavigate } from "react-router-dom";
import { dismissPopup, dismissToast, usePopups, useToasts } from "../store/toast.js";
import Icon from "./Icon.jsx";

const styles = {
  success: ["circle-check", "text-[#29945a]"],
  error: ["circle-alert", "text-[#d94747]"],
  info: ["info", "text-[#4285c5]"],
};

export default function Toaster() {
  const toasts = useToasts();
  const popups = usePopups();
  const navigate = useNavigate();

  return (
    <>
      {/* Top-Right Notification Popups (under the Header Bell) */}
      {popups.length > 0 && (
        <div className="fixed top-[68px] right-5 z-[4900] flex flex-col gap-2.5 print:hidden max-[600px]:left-3 max-[600px]:right-3">
          {popups.map((p) => (
            <div
              key={p.id}
              role="status"
              className="flex items-start gap-3 min-w-[280px] max-w-[360px] rounded-xl border-[1.5px] border-brand/50 bg-white p-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.16)] animate-popup dark:border-brand/40 dark:bg-night-panel max-[600px]:max-w-none"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Icon name={p.icon || "bell"} />
              </span>
              <button
                type="button"
                onClick={() => {
                  dismissPopup(p.id);
                  if (p.to) navigate(p.to);
                }}
                className="min-w-0 flex-1 text-left"
              >
                {p.title && (
                  <strong className="block truncate text-[13.5px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">
                    {p.title}
                  </strong>
                )}
                {p.message && (
                  <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-[#64748b] dark:text-[#d1c9c2]">
                    {p.message}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => dismissPopup(p.id)}
                aria-label="Dismiss notification"
                className="text-[#94a3b8] transition hover:text-brand"
              >
                <Icon name="x" className="text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom-Right Action Feedback Toasts */}
      <div className="fixed bottom-5 right-5 z-[5000] flex flex-col gap-2.5 print:hidden max-[600px]:left-4 max-[600px]:right-4">
        {toasts.map((t) => {
          const [icon, color] = styles[t.type] || styles.success;
          return (
            <div
              key={t.id}
              role="status"
              className="flex items-center gap-3 min-w-[260px] max-w-[380px] px-4 py-3 rounded-xl bg-white border border-[#eee] shadow-[0_10px_30px_rgba(0,0,0,.14)] animate-popup dark:bg-night-panel dark:border-night-line"
            >
              <Icon name={icon} className={`h-4 w-4 ${color}`} />
              <span className="flex-1 text-[14px]">{t.message}</span>
              <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="text-[#aaa] hover:text-brand">
                <Icon name="x" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
