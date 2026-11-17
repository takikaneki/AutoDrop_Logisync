import { useEffect, useState } from "react";
import { SPX_LOGO_DATA_URL } from "../../data/spxLogo.js";

export const CONTACT_DETAILS = [
  {
    icon: "fa-envelope",
    label: "Email Address",
    value: "support@logisync.example",
    sub: "Official system & coordinator support",
    href: "mailto:support@logisync.example",
  },
  {
    icon: "fa-phone",
    label: "Contact Number",
    value: "(02) 8123 4567",
    sub: "Direct landline for hub inquiries",
    href: "tel:+63281234567",
  },
  {
    icon: "fa-location-dot",
    label: "Office / Hub Address",
    value: "Cavite State University, Cavite",
    sub: "SPX Express Partner Coordination Hub",
    href: null,
  },
  {
    icon: "fa-clock",
    label: "Support Hours",
    value: "Mon–Sat, 8:00 AM – 6:00 PM",
    sub: "24/7 automated QR & parcel logging",
    href: null,
  },
];

/**
 * Reusable Contact Us section/content shared between the public Welcome Page
 * ContactUsModal and authenticated Contact Us views.
 */
export function ContactUsContent({
  onClose,
  initialName = "",
  initialEmail = "",
  onSent,
  idPrefix = "modal-c",
  titleId = "contact-modal-title",
  supportDark = false,
}) {
  const resolvedName = initialName && initialName !== "Guest" ? initialName : "";
  const [form, setForm] = useState({
    name: resolvedName,
    email: initialEmail || "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: prev.name || resolvedName,
      email: prev.email || initialEmail || "",
    }));
  }, [resolvedName, initialEmail]);

  const setField = (k) => (e) => {
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const handleCopy = (text, label) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nextErrors.email = "Please enter a valid email.";
    if (!form.message.trim()) nextErrors.message = "Please write a message.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSent(true);
    onSent?.(form);
  };

  const dk = (cls) => (supportDark ? cls : "");
  const inputBase = `w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand focus:bg-white focus:ring-3 focus:ring-brand/15 placeholder:text-slate-400 ${dk(
    "dark:border-night-line dark:bg-night-head dark:text-[#f1eeeb] dark:focus:bg-night-head dark:placeholder:text-[#8b837d]"
  )}`;

  return (
    <>
      {/* Top Header */}
      <div
        className={`flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7 sm:py-5 ${
          onClose ? "sticky top-0 z-10 bg-white/95 backdrop-blur-md" : ""
        } ${dk("dark:border-night-line")}`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-base text-white shadow-sm shadow-orange-500/25">
            <i className="fa-solid fa-headset" />
          </span>
          <div>
            <h2
              id={titleId}
              className={`text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl ${dk("dark:text-white")}`}
            >
              Contact LogiSync Support
            </h2>
            <p className={`text-xs text-slate-500 ${dk("dark:text-[#a8a099]")}`}>
              Reach the LogiSync coordination team for account, verification, or delivery inquiries.
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Contact Modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            <i className="fa-solid fa-xmark text-base" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 gap-6 p-5 sm:p-7 lg:grid-cols-12">
        {/* Left Column: Direct Contact Details */}
        <div className="space-y-3.5 lg:col-span-5">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 p-5 text-white">
            <span className="inline-block rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
              Direct Channels
            </span>
            <h3 className="mt-2 text-base font-extrabold">Get in touch with us</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Seller and Rider accounts are managed by the Coordinator. Contact us below if you need account access
              or parcel assistance.
            </p>

            <div className="mt-4 flex items-center gap-2.5 border-t border-white/10 pt-3.5">
              <span className="text-[11px] font-semibold text-slate-400">Developed for:</span>
              <img src={SPX_LOGO_DATA_URL} alt="SPX Express" className="h-6 w-auto object-contain" />
            </div>
          </div>

          <ul className="space-y-2.5">
            {CONTACT_DETAILS.map((contactItem) => (
              <li
                key={contactItem.label}
                className={`flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition hover:border-brand/40 hover:bg-white ${dk(
                  "dark:border-night-line dark:bg-night-head dark:hover:bg-night-panel"
                )}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-sm text-brand ${dk(
                      "dark:bg-night-line"
                    )}`}
                  >
                    <i className={`fa-solid ${contactItem.icon}`} />
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`block text-[11px] font-bold uppercase tracking-wider text-slate-400 ${dk(
                        "dark:text-[#8b837d]"
                      )}`}
                    >
                      {contactItem.label}
                    </span>
                    {contactItem.href ? (
                      <a
                        href={contactItem.href}
                        className={`block truncate text-sm font-extrabold text-slate-900 hover:text-brand ${dk(
                          "dark:text-white"
                        )}`}
                      >
                        {contactItem.value}
                      </a>
                    ) : (
                      <strong className={`block text-sm font-extrabold text-slate-900 ${dk("dark:text-white")}`}>
                        {contactItem.value}
                      </strong>
                    )}
                    <span className={`block text-[11px] text-slate-500 ${dk("dark:text-[#a8a099]")}`}>
                      {contactItem.sub}
                    </span>
                  </div>
                </div>

                {contactItem.href && (
                  <button
                    type="button"
                    onClick={() => handleCopy(contactItem.value, contactItem.label)}
                    title={`Copy ${contactItem.label}`}
                    className={`shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:border-brand hover:text-brand ${dk(
                      "dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
                    )}`}
                  >
                    {copied === contactItem.label ? (
                      <span className="text-emerald-600">Copied</span>
                    ) : (
                      <i className="fa-regular fa-copy" />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Right Column: Quick Message Form */}
        <div
          className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-7 ${dk(
            "dark:border-night-line dark:bg-night-head"
          )}`}
        >
          {sent ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
                <i className="fa-solid fa-check" />
              </span>
              <h3 className={`text-lg font-extrabold text-slate-900 ${dk("dark:text-white")}`}>Message Sent!</h3>
              <p className={`mt-1 max-w-xs text-xs leading-relaxed text-slate-500 ${dk("dark:text-[#a8a099]")}`}>
                Thank you for reaching out. Our coordination team will reply to{" "}
                <strong className={`text-slate-700 ${dk("dark:text-[#f1eeeb]")}`}>{form.email}</strong> shortly.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setForm((prev) => ({ ...prev, subject: "", message: "" }));
                  }}
                  className={`rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 ${dk(
                    "dark:border-night-line dark:text-[#d1c9c2] dark:hover:bg-night-line"
                  )}`}
                >
                  Send Another Message
                </button>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-dark"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h3 className={`text-base font-extrabold text-slate-900 ${dk("dark:text-white")}`}>Send us a message</h3>
              <p className={`mt-0.5 mb-4 text-xs text-slate-500 ${dk("dark:text-[#a8a099]")}`}>
                Have a question about parcel verification, rider dispatch, or account access? Drop us a note below.
              </p>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`${idPrefix}-name`}
                    className={`mb-1 block text-xs font-bold text-slate-600 ${dk("dark:text-[#d1c9c2]")}`}
                  >
                    Your Name
                  </label>
                  <input
                    id={`${idPrefix}-name`}
                    type="text"
                    value={form.name}
                    onChange={setField("name")}
                    placeholder="Juan Dela Cruz"
                    className={inputBase}
                  />
                  {errors.name && <p className="mt-1 text-[11px] font-medium text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label
                    htmlFor={`${idPrefix}-email`}
                    className={`mb-1 block text-xs font-bold text-slate-600 ${dk("dark:text-[#d1c9c2]")}`}
                  >
                    Email Address
                  </label>
                  <input
                    id={`${idPrefix}-email`}
                    type="email"
                    value={form.email}
                    onChange={setField("email")}
                    placeholder="example@gmail.com"
                    className={inputBase}
                  />
                  {errors.email && <p className="mt-1 text-[11px] font-medium text-red-600">{errors.email}</p>}
                </div>
              </div>

              <div className="mt-3.5">
                <label
                  htmlFor={`${idPrefix}-subject`}
                  className={`mb-1 block text-xs font-bold text-slate-600 ${dk("dark:text-[#d1c9c2]")}`}
                >
                  Subject <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id={`${idPrefix}-subject`}
                  type="text"
                  value={form.subject}
                  onChange={setField("subject")}
                  placeholder="e.g., Seller Account Request / Parcel Verification Inquiry"
                  className={inputBase}
                />
              </div>

              <div className="mt-3.5">
                <label
                  htmlFor={`${idPrefix}-msg`}
                  className={`mb-1 block text-xs font-bold text-slate-600 ${dk("dark:text-[#d1c9c2]")}`}
                >
                  Message
                </label>
                <textarea
                  id={`${idPrefix}-msg`}
                  rows={4}
                  value={form.message}
                  onChange={setField("message")}
                  placeholder="Write your inquiry or message here..."
                  className={`${inputBase} resize-none`}
                />
                {errors.message && <p className="mt-1 text-[11px] font-medium text-red-600">{errors.message}</p>}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5">
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-orange-500/20 transition hover:bg-brand-dark"
                >
                  <i className="fa-solid fa-paper-plane text-[11px]" />
                  <span>Send Message</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

export default function ContactUsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      <div
        className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.35)] animate-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <ContactUsContent onClose={onClose} />
      </div>
    </div>
  );
}

