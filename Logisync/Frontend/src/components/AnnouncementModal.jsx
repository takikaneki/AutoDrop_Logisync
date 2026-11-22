import { useEffect, useRef, useState } from "react";
import { addNotification } from "../store/notifications.js";
import { playAlertSound } from "../utils/sound.js";
import { publishAnnouncement } from "../store/announcements.js";
import { logAction } from "../store/audit.js";
import { getPrefs } from "../store/prefs.js";
import { toast } from "../store/toast.js";
import Icon from "./Icon.jsx";

const input =
  "w-full rounded-lg border border-[#e8e8e8] bg-white px-[11px] py-2.5 text-[13px] outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/10 text-ink";
const labelCls = "block mb-1.5 text-[12px] font-semibold text-[#666] dark:text-[#d1c9c2]";

// Global na Delivery Announcement. Binubuksan galing sa icon sa Topbar kaya available sa lahat ng module.
export default function AnnouncementModal({ open, onClose }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("riders"); // "riders" | "sellers" | "both"
  const [error, setError] = useState("");
  const [popup, setPopup] = useState(null);
  const titleRef = useRef(null);

  const toRiders = audience === "riders" || audience === "both";
  const toSellers = audience === "sellers" || audience === "both";

  useEffect(() => {
    if (!open) return;
    titleRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const [sending, setSending] = useState(false);

  const send = async () => {
    if (sending) return;
    if (!message.trim()) return setError("Please type the announcement message.");
    if (!toRiders && !toSellers) return setError("Please select at least one recipient.");

    const recipients = [toRiders && "Riders", toSellers && "Sellers"].filter(Boolean).join(" and ");
    const finalTitle = title.trim() || "Delivery Announcement";

    setSending(true);
    try {
      await publishAnnouncement({
        title: finalTitle,
        message: message.trim(),
        toRiders,
        toSellers,
        audience,
      });
      logAction({ category: "Announcements", action: "Sent announcement", target: recipients, detail: finalTitle });
      toast("Announcement sent.");
      addNotification({
        kind: "system",
        icon: "megaphone",
        tone: "orange",
        title: `Announcement sent: ${finalTitle}`,
        text: `Sent to ${recipients}.`,
        to: null,
      });

      setPopup({ title: finalTitle, message: message.trim(), recipients: `Sent to: ${recipients}` });
      const prefs = getPrefs();
      if (prefs.notificationsEnabled !== false && prefs.sound !== false && prefs.notifyAnnouncements !== false && prefs.soundAnnouncements !== false) {
        playAlertSound();
      }
      setTitle("");
      setMessage("");
      setError("");
      onClose();
    } finally {
      setSending(false);
    }
  };

  if (!open && !popup) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[2500] flex items-center justify-center p-5 bg-[rgba(25,25,25,.55)]"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <div className="w-full max-w-[560px] max-h-[92vh] overflow-y-auto rounded-[17px] bg-white p-[22px] border-l-4 border-l-brand shadow-[0_20px_60px_rgba(0,0,0,.2)] animate-popup dark:bg-night-panel">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-[10px] bg-brand-soft text-brand flex items-center justify-center">
                  <Icon name="megaphone" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold">Delivery Announcement</h2>
                  <p className="mt-1 text-[12px] text-[#999]">Send an important notice to riders and sellers.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 shrink-0 rounded-lg bg-[#f5f5f5] text-[#555] hover:bg-[#eee] hover:text-brand dark:bg-night-line dark:text-[#d1c9c2]"
              >
                <Icon name="x" />
              </button>
            </div>

            <div className="mt-[18px] p-[17px] rounded-[11px] bg-[#fffaf7] border border-[#ffe9dc] dark:bg-night-head dark:border-night-line">
              <div className="mb-3.5">
                <label className={labelCls}>Announcement Title</label>
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Delivery Cancellation Notice"
                  className={input}
                />
              </div>
              <div className="mb-3.5">
                <label className={labelCls}>Message</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setError("");
                  }}
                  placeholder="Type the announcement that should be seen immediately..."
                  className={`${input} resize-y`}
                />
              </div>

              {error && (
                <p className="mb-3 text-[12px] font-semibold text-[#d94747]">
                  <Icon name="circle-alert" className="mr-1" /> {error}
                </p>
              )}

              <div className="mb-3.5">
                <label className={labelCls}>Target Audience (Role-Based Recipient)</label>
                <div className="grid grid-cols-3 gap-2 max-[480px]:grid-cols-1">
                  {[
                    { key: "riders", label: "Riders Only", icon: "bike" },
                    { key: "sellers", label: "Sellers Only", icon: "store" },
                    { key: "both", label: "Both Roles", icon: "users" },
                  ].map((opt) => {
                    const active = audience === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setAudience(opt.key)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-bold transition ${
                          active
                            ? "border-brand bg-brand text-white shadow-xs"
                            : "border-[#e5e8ee] bg-white text-[#555] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
                        }`}
                      >
                        <Icon name={opt.icon} className="text-[13px]" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-[15px] max-[600px]:flex-col max-[600px]:items-stretch">
                <span className="text-[11.5px] font-semibold text-[#777] dark:text-[#d1c9c2]">
                  Sending to:{" "}
                  <strong className="text-brand">
                    {audience === "riders" ? "Riders Only" : audience === "sellers" ? "Sellers Only" : "Riders and Sellers"}
                  </strong>
                </span>
                <button
                  onClick={send}
                  disabled={sending}
                  className="px-[15px] py-2.5 rounded-lg bg-brand text-white text-[12px] font-bold hover:bg-brand-dark disabled:opacity-60"
                >
                  <Icon name="send" /> {sending ? "Sending..." : "Send Alert"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {popup && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-[rgba(35,35,35,.48)]">
          <div className="w-[390px] max-w-[calc(100%-30px)] p-7 text-center rounded-[17px] bg-white shadow-[0_20px_60px_rgba(0,0,0,.18)] animate-popup dark:bg-night-panel">
            <div className="w-[55px] h-[55px] mx-auto mb-3 rounded-full bg-brand-soft text-brand flex items-center justify-center text-[21px]">
              <Icon name="megaphone" />
            </div>
            <span className="text-[9px] font-extrabold tracking-[1px] text-brand">SYSTEM ANNOUNCEMENT</span>
            <h2 className="my-[9px] text-[19px] font-bold">{popup.title}</h2>
            <p className="text-[12px] leading-[1.6] text-[#777] dark:text-[#d1c9c2]">{popup.message}</p>
            <div className="my-[15px] text-[10px] text-[#999]">{popup.recipients}</div>
            <button onClick={() => setPopup(null)} className="w-full p-[11px] rounded-lg bg-brand text-white text-[11px] font-bold">
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </>
  );
}
