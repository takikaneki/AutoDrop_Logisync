import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { panel } from "../components/styles.js";

const faqs = [
  ["How do I verify a parcel?", "Open Verification, press the scan button on a parcel, review the seller's video and details, then choose Verify, Return to Seller or Flag."],
  ["How do I send an announcement?", "Click the megaphone icon at the top of any page, write the message, choose Riders and/or Sellers, then press Send Alert. Past announcements are listed under Announcements."],
  ["How do I generate a report?", "Open Parcel Records and click Generate Report in the upper-right corner. You can view the report details immediately, filter by status, seller, rider, or dates, and export as CSV or save as PDF."],
  ["How do I reassign a rider?", "Open a parcel from Parcels. If it is still In Transit, press Reassign, pick another rider and confirm."],
  ["Where can I see who changed what?", "The Audit Log lists verifications, reassignments, approvals, announcements and other actions."],
  ["How do I change my password?", "Open Settings from the menu under your name, then use the Security & Password section."],
];

export default function Help() {
  const [open, setOpen] = useState(0);
  const { pathname } = useLocation();
  const contactPath = pathname.startsWith("/seller")
    ? "/seller/contact"
    : pathname.startsWith("/rider")
    ? "/rider/contact"
    : "/contact";
  const messagesPath = pathname.startsWith("/seller")
    ? "/seller/messages"
    : pathname.startsWith("/rider")
    ? "/rider/messages"
    : "/messages";

  return (
    <>
      <Topbar title="Help" subtitle="Answers to common questions." />
      <div id="faq" className="flex w-full flex-col gap-6">
        <section className={`${panel} w-full p-5 sm:p-6`}>
          <h2 className="mb-3 px-2 text-[17px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-[#edf0f4] dark:divide-night-line">
            {faqs.map(([q, a], i) => (
              <div key={q}>
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? -1 : i)}
                  aria-expanded={open === i}
                  className={`flex w-full items-center justify-between gap-4 px-2 py-4 text-left text-[15px] font-semibold transition hover:text-brand ${
                    open === i ? "text-brand" : "text-[#27364f] dark:text-[#f1eeeb]"
                  }`}
                >
                  <span>{q}</span>
                  <i
                    className={`fa-solid fa-chevron-down shrink-0 text-[12px] text-[#aaa] transition-transform ${
                      open === i ? "rotate-180 text-brand" : ""
                    }`}
                  />
                </button>
                {open === i && (
                  <p className="px-2 pb-4 text-[14px] leading-relaxed text-[#64748b] dark:text-[#d1c9c2]">
                    {a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className={`${panel} w-full p-6 text-center`}>
          <span className="mx-auto mb-3 flex h-[48px] w-[48px] items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-night-line">
            <i className="fa-solid fa-headset" />
          </span>
          <h3 className="mb-1 text-[16px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
            Still need help?
          </h3>
          <p className="mb-4 text-[13px] text-[#888]">
            Send us a message and we'll get back to you.
          </p>
          <div className="flex justify-center gap-5 text-[14px] font-bold text-brand">
            <Link to={messagesPath} className="hover:underline">
              Messages →
            </Link>
            <Link to={contactPath} className="hover:underline">
              Contact →
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
