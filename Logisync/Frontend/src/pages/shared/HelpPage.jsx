import { useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import { panel } from "../../components/styles.js";
import { getRole } from "../../api.js";

// Mga tanong at sagot na tugma sa kayang gawin ng sistema ngayon (walang ipinapangakong wala pa)
const FAQS = {
  seller: [
    ["How do I register a parcel?", "Open Create Parcel, scan the Shopee QR on the parcel (or type the transaction number), enter the receiver's name, contact and the contents, then press Register parcel."],
    ["How do I upload my video proof?", "Open Scan QR / Upload Video, scan the parcel or type its transaction number, choose your video (MP4, WebM, MOV, AVI or MPEG, up to 50 MB) and press Submit video."],
    ["What do the statuses mean?", "Waiting for video: you still need to upload. Under verification: the coordinator is checking your video. Verified: approved. Rejected: not approved. Reupload requested: upload a new video."],
    ["The coordinator asked for a new video. What now?", "Open the parcel from Parcel Records or the notification. Read the coordinator's remarks, record a new video and submit it again."],
    ["Does Verified mean the parcel was delivered?", "No. Verified only means the coordinator approved your video. Delivery tracking is not available yet."],
    ["How do I reach the coordinator?", "Use Messages in the sidebar. You can only message coordinators."],
  ],
  rider: [
    ["How do I check a parcel?", "Open Scan QR Code and scan the QR on the parcel, or type its transaction number. You will see whether the parcel is cleared for delivery."],
    ["When can I take a parcel?", "Only when it shows Cleared for delivery (Verified). If it is not verified, rejected or on hold, do not take it and message the coordinator."],
    ["Where is the receiver's contact number?", "It appears in the parcel details after you scan the parcel."],
    ["Why can't I mark a parcel Delivered or Failed?", "Delivery results and rider assignment are not available yet. Those pages are marked Soon in the sidebar."],
    ["What are Recent Scans?", "A list of parcels you scanned on this device. It is stored in this browser only."],
    ["How do I reach the coordinator?", "Use Messages in the sidebar. You can only message coordinators."],
  ],
};

export default function HelpPage() {
  const role = getRole() === "rider" ? "rider" : "seller";
  const [open, setOpen] = useState(0);

  return (
    <>
      <Topbar title="Help" subtitle="Answers to common questions." />
      <div className="grid grid-cols-[1.6fr_1fr] items-start gap-6 max-[1000px]:grid-cols-1">
        <section className={`${panel} p-3`}>
          <h2 className="px-4 pb-2 pt-3 text-[17px] font-bold">Frequently asked questions</h2>
          {FAQS[role].map(([q, a], i) => (
            <div key={q} className="border-b border-[#f3f3f3] last:border-0 dark:border-night-line">
              <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-[15px] font-semibold hover:text-brand">
                {q}
                <i className={`fa-solid fa-chevron-down text-[12px] text-[#aaa] transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && <p className="px-4 pb-4 text-[14px] leading-relaxed text-[#777] dark:text-[#d1c9c2]">{a}</p>}
            </div>
          ))}
        </section>

        <section className={`${panel} p-6 text-center`}>
          <span className="mx-auto mb-3 flex h-[48px] w-[48px] items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-night-line"><i className="fa-solid fa-headset" /></span>
          <h3 className="mb-1 text-[16px] font-bold">Still need help?</h3>
          <p className="mb-4 text-[13px] text-[#888]">Message your coordinator or contact support.</p>
          <div className="flex justify-center gap-5 text-[14px] font-bold text-brand">
            <Link to={`/${role}/messages`} className="hover:underline">Messages →</Link>
            <Link to={`/${role}/contact`} className="hover:underline">Contact →</Link>
          </div>
        </section>
      </div>
    </>
  );
}
