import { useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "./ui.jsx";
import { useT } from "../store/prefs.js";
import useBase from "../hooks/useBase.js";

// Quick links ng bawat role (Coordinator = walang base)
const QUICK = {
  "": [["/dashboard", "Home"], ["/parcels", "Parcel Records"], ["/reports", "Reports"], ["/verification", "Verification"]],
  "/seller": [["", "Home"], ["/parcels", "Parcel Records"], ["/create", "Create Parcel"], ["/scan", "Scan QR / Upload Video"]],
  "/rider": [["", "Home"], ["/scan", "Scan QR Code"], ["/messages", "Messages"]],
};

const legal = {
  Terms: "By using LogiSync you agree to use the system only for legitimate parcel monitoring and verification. Accounts are personal and must not be shared. LogiSync may suspend accounts that misuse the system. (Sample text — replace with your project's official terms.)",
  Privacy: "LogiSync stores the information needed to verify and deliver parcels, such as names, contact details, addresses and seller videos. This data is used only for delivery operations and is not sold to third parties. (Sample text — replace with your project's official policy.)",
};

export default function Footer() {
  const t = useT();
  const base = useBase();
  const [doc, setDoc] = useState(null);
  const quick = QUICK[base].map(([to, l]) => [base ? `${base}${to}` || base : to, l]);
  const col = "text-[13px] text-[#888] hover:text-brand";

  return (
    <footer className="mt-10 w-full shrink-0 border-t border-[#e9e9e9] pt-6 print:hidden dark:border-night-line">
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
        <div className="max-w-[300px]">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-brand text-white"><i className="fa-solid fa-box text-[13px]" /></span>
            <strong className="text-[15px]">LogiSync</strong>
          </div>
          <p className="text-[12.5px] leading-relaxed text-[#888]">Parcel verification and delivery monitoring.</p>
        </div>

        <nav className="flex flex-wrap gap-x-12 gap-y-5" aria-label="Footer">
          <div>
            <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide">{t("Quick Links")}</h4>
            <ul className="space-y-1.5">
              {quick.map(([to, l]) => (
                <li key={to}><Link to={to} className={col}>{t(l)}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide">LogiSync</h4>
            <ul className="space-y-1.5">
              {[["/about", "About Us"], ["/contact", "Contact"], ["/help", "Help"], ["/settings", "Settings"]].map(([to, l]) => (
                <li key={to}><Link to={`${base}${to}`} className={col}>{t(l)}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide">{t("Contact")}</h4>
            <ul className="space-y-1.5 text-[13px] text-[#888]">
              <li><i className="fa-solid fa-envelope w-4 text-brand" /> support@logisync.example</li>
              <li><i className="fa-solid fa-phone w-4 text-brand" /> (02) 8123 4567</li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eee] py-4 text-[12px] text-[#aaa] dark:border-night-line">
        <span>© 2026 LogiSync. All rights reserved.</span>
        <span className="flex gap-4">
          {Object.keys(legal).map((k) => (
            <button key={k} onClick={() => setDoc(k)} className="hover:text-brand">{k}</button>
          ))}
        </span>
      </div>

      <Modal open={!!doc} onClose={() => setDoc(null)} z="z-[4000]" className="w-full max-w-[460px] p-7 dark:bg-night-panel">
        <h3 className="text-[17px] font-bold mb-3">{doc}</h3>
        <p className="text-[14px] leading-relaxed text-[#777] dark:text-[#d1c9c2]">{doc && legal[doc]}</p>
        <button onClick={() => setDoc(null)} className="mt-5 px-4 py-2.5 rounded-lg bg-brand text-white text-[14px] font-bold">Close</button>
      </Modal>
    </footer>
  );
}
