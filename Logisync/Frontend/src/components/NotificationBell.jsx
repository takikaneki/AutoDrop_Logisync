import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { markAllRead, markRead, timeAgo, useNotifications } from "../store/notifications.js";

const tones = {
  orange: "bg-[#fff0e7] text-[#ff6818]",
  purple: "bg-[#f2ecff] text-[#8258c7]",
  blue: "bg-[#eaf3ff] text-[#4285c5]",
  green: "bg-[#eaf8ef] text-[#29945a]",
  red: "bg-[#fff0f0] text-[#d94747]",
};

const tabs = [
  { key: "all", label: "All" },
  { key: "rider", label: "Riders" },
  { key: "seller", label: "Sellers" },
];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const notifications = useNotifications();

  const unread = notifications.filter((n) => !n.read).length;
  const list = useMemo(
    () => (tab === "all" ? notifications : notifications.filter((n) => n.kind === tab)),
    [notifications, tab]
  );

  // isara kapag nag-click sa labas o Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openItem = (n) => {
    markRead(n.id);
    if (n.to) {
      setOpen(false);
      navigate(n.to);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
        className={`relative w-[40px] h-[40px] rounded-full hover:text-brand ${
          open ? "bg-brand-soft text-brand dark:bg-night-line" : "bg-[#f5f5f5] text-[#555] dark:bg-night-line dark:text-[#d1c9c2]"
        }`}
      >
        <i className="fa-regular fa-bell" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[50px] z-[1500] w-[380px] overflow-hidden rounded-[15px] border border-[#eee] bg-white shadow-[0_18px_50px_rgba(0,0,0,.15)] animate-popup dark:border-night-line dark:bg-night-panel max-[600px]:fixed max-[600px]:left-3 max-[600px]:right-3 max-[600px]:top-[68px] max-[600px]:w-auto">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold">Notifications</h3>
              {unread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#fff0e7] text-brand text-[10px] font-bold">{unread} new</span>
              )}
            </div>
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="text-[12px] font-semibold text-brand hover:underline disabled:text-[#bbb] disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>

          <div className="flex gap-1.5 px-4 pb-2.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition ${
                  tab === t.key
                    ? "bg-brand text-white"
                    : "bg-[#f5f5f5] text-[#777] hover:bg-[#ffe9dc] hover:text-brand dark:bg-night-line dark:text-[#d1c9c2]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[360px] overflow-y-auto border-t border-[#f1f1f1] dark:border-night-line">
            {list.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-[#aaa]">
                <i className="fa-regular fa-bell-slash mb-2 block text-[22px]" />
                No notifications here yet.
              </div>
            ) : (
              list.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-[#f6f6f6] hover:bg-[#fff7f2] dark:border-night-line dark:hover:bg-night-line ${
                    n.read ? "" : "bg-[#fffaf7] dark:bg-night-head"
                  }`}
                >
                  <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[14px] ${tones[n.tone] || tones.orange}`}>
                    <i className={`fa-solid ${n.icon}`} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <strong className="block text-[13px] leading-snug">{n.title}</strong>
                    <span className="block mt-0.5 text-[12px] text-[#888] truncate">{n.text}</span>
                    <small className="block mt-1 text-[11px] text-[#aaa]">{timeAgo(n.ts)}</small>
                  </span>
                  {!n.read && <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-brand" />}
                </button>
              ))
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
            className="w-full py-3 text-[12px] font-bold text-brand border-t border-[#f1f1f1] hover:bg-[#fff7f2] dark:border-night-line dark:hover:bg-night-line"
          >
            View all notifications <i className="fa-solid fa-arrow-right ml-1" />
          </button>
        </div>
      )}
    </div>
  );
}
