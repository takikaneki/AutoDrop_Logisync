import Icon from "./Icon.jsx";
import { useNetworkStatus } from "../utils/network.js";

/**
 * Subtle, persistent offline / connection-restored banner mounted near the top of all portals.
 * - Offline: "No Internet Connection" / "You're offline. Some information may not be up to date."
 * - Reconnected: "Connection restored. Refreshing data..."
 */
export default function NetworkStatusBanner() {
  const { online, status } = useNetworkStatus();

  if (online && status !== "reconnecting") return null;

  const isRestored = online && status === "reconnecting";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-14 z-40 w-full border-b px-4 py-2.5 text-[13px] transition-colors print:hidden ${
        isRestored
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/70 dark:bg-emerald-950/90 dark:text-emerald-100"
          : "border-amber-200 bg-[#fffbeb] text-[#78350f] dark:border-amber-800/70 dark:bg-[#2a1f10] dark:text-amber-100"
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-center gap-2.5 text-center sm:justify-start sm:text-left">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            isRestored
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
          }`}
          aria-hidden="true"
        >
          <Icon name={isRestored ? "wifi" : "wifi-off"} className="h-3.5 w-3.5" />
        </span>

        {isRestored ? (
          <p className="font-semibold leading-snug">
            Connection restored. Refreshing data...
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 sm:justify-start">
            <strong className="font-bold">No Internet Connection</strong>
            <span className="opacity-90">
              You&apos;re offline. Some information may not be up to date.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
