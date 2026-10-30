import { useCallback, useEffect, useRef, useState } from "react";
import { TERMS, TERMS_VERSION } from "../data/terms.js";

// Hindi mapipindot ang "I Agree" hangga't hindi naba-basa hanggang sa pinakababa.
// Kapag nakapag-agree na dati (alreadyAccepted), basahin lang at may "Close" na lang.
export default function TermsModal({ open, alreadyAccepted = false, onAgree, onClose }) {
  const box = useRef(null);
  const [atBottom, setAtBottom] = useState(false);

  const check = useCallback(() => {
    const el = box.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setAtBottom(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setAtBottom(false);
    const id = requestAnimationFrame(() => {
      if (box.current) box.current.scrollTop = 0;
      check();
    });
    return () => cancelAnimationFrame(id);
  }, [open, check]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const ready = alreadyAccepted || atBottom;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-[rgba(25,50,79,.45)] p-4 backdrop-blur-[3px]" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" aria-labelledby="terms-title" className="flex max-h-[90vh] w-full max-w-[640px] flex-col rounded-[20px] bg-white shadow-[0_18px_60px_rgba(25,50,79,.25)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#edf0f4] px-7 pb-4 pt-6 max-[600px]:px-5">
          <div>
            <h2 id="terms-title" className="text-[22px] font-bold text-[#18283e]">Terms of Service</h2>
            <p className="mt-1 text-sm text-[#72839b]">LogiSync · Version {TERMS_VERSION}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f6f8] text-[#7c8da0] hover:text-orange-500">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div ref={box} onScroll={check} tabIndex={0} aria-label="Terms of Service text" className="min-h-[200px] flex-1 overflow-y-auto px-7 py-5 text-[15px] leading-[1.75] text-[#3d4b61] max-[600px]:px-5">
          {TERMS.map(([title, body]) => (
            <section key={title} className="mb-5">
              <h3 className="mb-1 text-[16px] font-bold text-[#18283e]">{title}</h3>
              <p>{body}</p>
            </section>
          ))}
          <p className="border-t border-[#edf0f4] pt-4 text-sm text-[#72839b]">End of Terms of Service.</p>
        </div>

        <div className="border-t border-[#edf0f4] px-5 sm:px-7 pb-5 sm:pb-6 pt-3.5 sm:pt-4">
          {!ready && (
            <p role="status" className="mb-3 text-xs sm:text-sm text-[#d97706]">
              <i className="fa-solid fa-arrow-down mr-1.5" />Scroll down to the end of the Terms to enable the button.
            </p>
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
            {alreadyAccepted ? (
              <button type="button" onClick={onClose} className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#ff7900] to-[#ff6500] px-6 py-2.5 sm:py-3 font-bold text-white text-sm sm:text-base">Close</button>
            ) : (
              <>
                <button type="button" onClick={onClose} className="w-full sm:w-auto rounded-xl border border-[#d7dee8] px-5 py-2.5 sm:py-3 font-semibold text-[#64748b] hover:bg-[#f7f8fa] text-sm sm:text-base">Cancel</button>
                <button type="button" disabled={!ready} onClick={onAgree} className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#ff7900] to-[#ff6500] px-6 py-2.5 sm:py-3 font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40 text-sm sm:text-base">
                  I Agree
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
