import { dismissToast, useToasts } from "../store/toast.js";

const styles = {
  success: ["fa-circle-check", "text-[#29945a]"],
  error: ["fa-circle-exclamation", "text-[#d94747]"],
  info: ["fa-circle-info", "text-[#4285c5]"],
};

export default function Toaster() {
  const toasts = useToasts();
  return (
    <div className="fixed bottom-5 right-5 z-[5000] flex flex-col gap-2.5 print:hidden max-[600px]:left-4 max-[600px]:right-4">
      {toasts.map((t) => {
        const [icon, color] = styles[t.type] || styles.success;
        return (
          <div
            key={t.id}
            role="status"
            className="flex items-center gap-3 min-w-[260px] max-w-[380px] px-4 py-3 rounded-xl bg-white border border-[#eee] shadow-[0_10px_30px_rgba(0,0,0,.14)] animate-popup dark:bg-night-panel dark:border-night-line"
          >
            <i className={`fa-solid ${icon} ${color}`} />
            <span className="flex-1 text-[14px]">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="text-[#aaa] hover:text-brand">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
