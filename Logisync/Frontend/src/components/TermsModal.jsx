import { useEffect, useRef, useState } from "react";
import {
  EFFECTIVE_DATE,
  POLICY_VERSION,
  PRIVACY_SECTIONS,
  REPUBLIC_ACTS,
  TERMS_SECTIONS,
} from "../data/terms.js";
import { SPX_LOGO_DATA_URL } from "../data/spxLogo.js";

/**
 * Modal for displaying LogiSync's Terms and Conditions and Privacy Policy,
 * including applicable Philippine Republic Acts (R.A. 10173, R.A. 11967, R.A. 10175).
 */
export default function TermsModal({
  open,
  initialTab = "terms",
  alreadyAccepted = false,
  onAgree,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState(initialTab || "terms");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [open, activeTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isTerms = activeTab === "terms";
  const sections = isTerms ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.35)] animate-popup"
      >
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-[#f97316] via-amber-500 to-[#ea580c]" />

        {/* Modal Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 pt-5 pb-4 sm:px-7">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] border border-orange-200/70">
              <i
                className={`fa-solid ${
                  isTerms ? "fa-file-contract" : "fa-user-shield"
                } text-lg`}
              />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="legal-modal-title"
                  className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl"
                >
                  {isTerms ? "Terms and Conditions" : "Privacy Policy"}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                  v{POLICY_VERSION}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                LogiSync Platform Legal &amp; Data Protection Notice • Updated {EFFECTIVE_DATE}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-orange-50 hover:text-[#f97316]"
          >
            <i className="fa-solid fa-xmark text-base" />
          </button>
        </div>

        {/* Document Switcher Tabs */}
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-2.5 sm:px-7">
          <button
            type="button"
            onClick={() => setActiveTab("terms")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition sm:text-sm ${
              isTerms
                ? "bg-[#f97316] text-white shadow-sm shadow-orange-500/25"
                : "bg-white text-slate-600 border border-slate-200/80 hover:border-orange-200 hover:text-[#f97316]"
            }`}
          >
            <i className="fa-solid fa-file-contract text-xs" />
            <span>Terms and Conditions</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("privacy")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition sm:text-sm ${
              !isTerms
                ? "bg-[#f97316] text-white shadow-sm shadow-orange-500/25"
                : "bg-white text-slate-600 border border-slate-200/80 hover:border-orange-200 hover:text-[#f97316]"
            }`}
          >
            <i className="fa-solid fa-user-shield text-xs" />
            <span>Privacy Policy</span>
          </button>
        </div>

        {/* Scrollable Legal Document Body */}
        <div
          ref={scrollRef}
          tabIndex={0}
          aria-label={isTerms ? "Terms and Conditions text" : "Privacy Policy text"}
          className="min-h-[240px] flex-1 overflow-y-auto px-5 py-5 text-sm leading-relaxed text-slate-700 sm:px-7 sm:py-6"
        >
          {/* Applicable Philippine Republic Acts Reference Box */}
          <div className="mb-6 rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/40 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <i className="fa-solid fa-scale-balanced text-[#ea580c]" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 sm:text-sm">
                Applicable Philippine Legal Framework
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {REPUBLIC_ACTS.map((act) => (
                <div
                  key={act.code}
                  className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#f97316]">
                      <i className={`fa-solid ${act.icon} text-xs`} />
                    </span>
                    <div>
                      <p className="text-xs font-extrabold text-[#ea580c]">{act.code}</p>
                      <p className="text-[11px] font-bold text-slate-800 leading-tight">
                        {act.title}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11.5px] leading-snug text-slate-600">
                    {act.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Role Scope Pill */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
            <span className="font-semibold">
              <i className="fa-solid fa-users-gear mr-1.5 text-brand" />
              Applies to all system roles:{" "}
              <strong className="text-slate-800">Coordinator, Seller, and Rider</strong>
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              Service Hub: Trece Martires City, Cavite
            </span>
          </div>

          {/* Main Document Sections */}
          <div className="space-y-5">
            {sections.map((sec) => (
              <section
                key={sec.id}
                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-2xs sm:p-5"
              >
                <h3 className="mb-2 text-base font-extrabold text-slate-900">
                  {sec.title}
                </h3>
                <div className="space-y-2.5 text-[13.5px] leading-relaxed text-slate-600">
                  {sec.paragraphs.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>
                {sec.bullets && sec.bullets.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-[13px] text-slate-600">
                    {sec.bullets.map((item, idx) => {
                      const colonIdx = item.indexOf(":");
                      const hasLead = colonIdx > 0 && colonIdx < 45;
                      return (
                        <li key={idx} className="flex items-start gap-2.5">
                          <i className="fa-solid fa-circle-check mt-1 shrink-0 text-[11px] text-[#f97316]" />
                          <span>
                            {hasLead ? (
                              <>
                                <strong className="font-bold text-slate-800">
                                  {item.slice(0, colonIdx + 1)}
                                </strong>
                                {item.slice(colonIdx + 1)}
                              </>
                            ) : (
                              item
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Document Footer Note */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <img
                src={SPX_LOGO_DATA_URL}
                alt="SPX Express"
                draggable={false}
                className="h-5 w-auto object-contain"
              />
              <span>
                End of {isTerms ? "Terms and Conditions" : "Privacy Policy"} (Version{" "}
                {POLICY_VERSION})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab(isTerms ? "privacy" : "terms")}
              className="font-bold text-[#f97316] underline underline-offset-2 hover:text-[#ea580c]"
            >
              Read {isTerms ? "Privacy Policy" : "Terms and Conditions"} →
            </button>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex shrink-0 flex-col-reverse items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:px-7">
          <p className="text-center text-xs text-slate-500 sm:text-left">
            By clicking <strong className="text-slate-700">Accept &amp; Continue</strong>, you
            confirm your agreement to both the Terms and Conditions and Privacy Policy.
          </p>
          <div className="flex w-full shrink-0 items-center justify-end gap-2.5 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 sm:w-auto sm:text-sm"
            >
              Close
            </button>
            {onAgree && (
              <button
                type="button"
                onClick={onAgree}
                className="w-full rounded-xl bg-gradient-to-r from-[#f97316] to-[#ea580c] px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-orange-500/20 transition hover:from-[#ea580c] hover:to-[#c2410c] sm:w-auto sm:text-sm"
              >
                <i className="fa-solid fa-check mr-1.5" />
                {alreadyAccepted ? "Accepted" : "Accept & Continue"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
