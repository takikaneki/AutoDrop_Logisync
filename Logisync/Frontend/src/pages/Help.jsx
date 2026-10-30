import { useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { panel } from "../components/styles.js";

const faqs = [
  ["How do I verify a parcel?", "Open Verification, press the scan button on a parcel, review the seller's video and details, then choose Verify, Return to Seller or Flag."],
  ["How do I send an announcement?", "Click the megaphone icon at the top of any page, write the message, choose Riders and/or Sellers, then press Send Alert. Past announcements are listed under Announcements."],
  ["How do I generate a report?", "Go to Reports, choose the filters (status, seller, rider, dates) and press Generate Report. You can then export a CSV for Excel or save it as a PDF."],
  ["How do I reassign a rider?", "Open a parcel from Parcels. If it is still In Transit, press Reassign, pick another rider and confirm."],
  ["Where can I see who changed what?", "The Audit Log lists verifications, reassignments, approvals, announcements and other actions."],
  ["How do I change my photo or password?", "Open Settings from the menu under your name, then use the Profile or Password tab."],
];
const keys = [["g then d", "Dashboard"], ["g then p", "Parcels"], ["g then r", "Reports"], ["g then v", "Verification"], ["g then m", "Messages"], ["g then n", "Notifications"], ["?", "Open this Help page"]];

export default function Help() {
  const [open, setOpen] = useState(0);
  return (
    <>
      <Topbar title="Help" subtitle="Answers to common questions and handy shortcuts." />
      <div className="grid grid-cols-[1.6fr_1fr] gap-6 max-[1000px]:grid-cols-1">
        <section className={`${panel} p-3`}>
          <h2 className="text-[17px] font-bold px-4 pt-3 pb-2">Frequently asked questions</h2>
          {faqs.map(([q, a], i) => (
            <div key={q} className="border-b border-[#f3f3f3] last:border-0 dark:border-night-line">
              <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left text-[15px] font-semibold hover:text-brand">
                {q}<i className={`fa-solid fa-chevron-down text-[12px] text-[#aaa] transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && <p className="px-4 pb-4 text-[14px] leading-relaxed text-[#777] dark:text-[#d1c9c2]">{a}</p>}
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-6">
          <section className={`${panel} p-6`}>
            <h2 className="text-[17px] font-bold mb-4"><i className="fa-regular fa-keyboard mr-2 text-brand" />Keyboard shortcuts</h2>
            <ul className="space-y-2.5">
              {keys.map(([k, d]) => (
                <li key={k} className="flex items-center justify-between gap-3 text-[14px]">
                  <span className="text-[#777] dark:text-[#d1c9c2]">{d}</span>
                  <kbd className="px-2.5 py-1 rounded-md bg-[#f5f5f5] border border-[#e5e5e5] text-[12px] font-mono dark:bg-night-line dark:border-night-line">{k}</kbd>
                </li>
              ))}
            </ul>
          </section>
          <section className={`${panel} p-6 text-center`}>
            <span className="w-[48px] h-[48px] mx-auto mb-3 rounded-full bg-brand-soft text-brand flex items-center justify-center dark:bg-night-line"><i className="fa-solid fa-headset" /></span>
            <h3 className="text-[16px] font-bold mb-1">Still need help?</h3>
            <p className="text-[13px] text-[#888] mb-4">Send us a message and we'll get back to you.</p>
            <Link to="/contact" className="text-brand font-bold text-[14px] hover:underline">Contact support →</Link>
          </section>
        </div>
      </div>
    </>
  );
}
