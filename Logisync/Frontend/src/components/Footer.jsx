import { useState } from "react";
import { Link } from "react-router-dom";
import TermsModal from "./TermsModal.jsx";
import { useT } from "../store/prefs.js";
import useBase from "../hooks/useBase.js";
import { SPX_LOGO_DATA_URL } from "../data/spxLogo.js";

// Quick links ng bawat role (Coordinator = walang base)
const QUICK = {
  "": [["/dashboard", "Home"], ["/parcels", "Parcel Records"], ["/reports", "Reports"], ["/verification", "Verification"]],
  "/seller": [["", "Home"], ["/parcels", "Parcel Records"], ["/create", "Create Parcel"], ["/scan", "Scan QR / Upload Video"]],
  "/rider": [["", "Home"], ["/scan", "Scan QR Code"], ["/messages", "Messages"]],
};

export default function Footer() {
  const t = useT();
  const base = useBase();
  const [doc, setDoc] = useState(null);
  const quick = QUICK[base].map(([to, l]) => [base ? `${base}${to}` || base : to, l]);
  const col = "text-[13px] text-[#888] hover:text-brand";

  return (
    <footer className="w-full shrink-0 border-t border-[#e9e9e9] pt-7 max-[800px]:pt-5 print:hidden dark:border-night-line">
      <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-6 max-[800px]:flex-col max-[800px]:gap-y-3">
        <div className="max-w-[300px] max-[800px]:max-w-none">
          <div className="mb-2 max-[800px]:mb-1.5 flex items-center gap-3 max-[800px]:gap-2.5">
            <img
              src={SPX_LOGO_DATA_URL}
              alt="SPX Express"
              draggable={false}
              className="h-7 max-[800px]:h-6 w-auto shrink-0 object-contain"
            />
            <span className="h-4 w-px bg-[#e5e5e5] dark:bg-night-line" aria-hidden="true" />
            <strong className="text-[15px] max-[800px]:text-[14px]">LogiSync</strong>
          </div>
          <p className="text-[12.5px] max-[800px]:text-[12px] leading-relaxed text-[#888]">
            Parcel verification and delivery monitoring.
          </p>
        </div>

        <nav className="flex flex-wrap items-start gap-x-14 gap-y-5 max-[800px]:w-full" aria-label="Footer">
          <div className="max-[800px]:hidden">
            <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide">{t("Quick Links")}</h4>
            <ul className="space-y-1.5">
              {quick.map(([to, l]) => (
                <li key={to}><Link to={to} className={col}>{t(l)}</Link></li>
              ))}
            </ul>
          </div>
          <div className="max-[800px]:hidden">
            <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide">LogiSync</h4>
            <ul className="space-y-1.5">
              {[["/about", "About Us"], ["/contact", "Contact"], ["/help", "Help"], ["/settings", "Settings"]].map(([to, l]) => (
                <li key={to}><Link to={`${base}${to}`} className={col}>{t(l)}</Link></li>
              ))}
            </ul>
          </div>
          <div className="max-[800px]:w-full">
            <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide max-[800px]:hidden">{t("Contact")}</h4>
            <ul className="space-y-1.5 text-[13px] text-[#888] max-[800px]:flex max-[800px]:flex-wrap max-[800px]:items-center max-[800px]:gap-x-5 max-[800px]:gap-y-1.5 max-[800px]:space-y-0 max-[800px]:text-[12px]">
              <li className="flex items-center gap-1.5 max-[800px]:inline-flex">
                <i className="fa-solid fa-envelope w-4 text-center text-brand" />
                <span>support@logisync.example</span>
              </li>
              <li className="flex items-center gap-1.5 max-[800px]:inline-flex">
                <i className="fa-solid fa-phone w-4 text-center text-brand" />
                <span>(02) 8123 4567</span>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="mt-5 max-[800px]:mt-3.5 flex flex-wrap items-center justify-between gap-3 max-[800px]:gap-2 border-t border-[#eee] py-4 max-[800px]:py-3 text-[12px] max-[800px]:text-[11.5px] text-[#aaa] dark:border-night-line">
        <span>© 2026 LogiSync. All rights reserved.</span>
        <span className="flex items-center gap-4">
          <button type="button" onClick={() => setDoc("terms")} className="hover:text-brand">
            Terms and Conditions
          </button>
          <button type="button" onClick={() => setDoc("privacy")} className="hover:text-brand">
            Privacy Policy
          </button>
        </span>
      </div>

      <TermsModal
        open={Boolean(doc)}
        initialTab={doc || "terms"}
        alreadyAccepted={true}
        onClose={() => setDoc(null)}
      />
    </footer>
  );
}
