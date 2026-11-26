import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { btnGhost, btnPrimary, panel } from "../components/styles.js";
import Icon from "../components/Icon.jsx";

const faqs = [
  ["How do I verify a parcel?", "Open Verification, press the scan button on a parcel, review the seller's packing video and declaration details, then choose Verify, Request Reupload, or Reject."],
  ["How do I confirm a Return to Hub (RTH) parcel?", "On the Dashboard under Return to Hub (RTH) Physical Verification, click Verify Arrival on a pending return or scan the parcel's Unified QR code to confirm physical arrival at the hub."],
  ["How do I handle Rider or Seller Emergency Reports?", "Open Emergency Reports from the sidebar to review active alerts, confirm receipt, and take action such as resuming delivery, rescheduling, or placing a temporary hold."],
  ["How do I send an announcement?", "Click the megaphone icon in the top header, write your message, choose Riders and/or Sellers, then press Send Alert. Past announcements are tracked in Notifications."],
  ["How do I generate a parcel report?", "Open Parcel Records and click Generate Report in the upper-right corner. Filter by status, seller, rider, or date range, then export as CSV or save as PDF."],
  ["How do I reassign a rider?", "Open a parcel from Parcel Records. If it is still In Transit, click Reassign, pick an available rider, and confirm the handoff."],
  ["How do I deactivate or reactivate an account?", "Go to Sellers or Riders under Account Management. Deactivating revokes access immediately and starts a 7-day recovery window during which you can reactivate the account."],
  ["Where can I see who changed what?", "Open Activity Log in the sidebar to view a full history of verifications, reassignments, account updates, announcements, and other hub actions."],
  ["How do I change my password?", "Open Settings from the sidebar, then go to Account & Security → Password & Security to update your password."],
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
      <Topbar title="FAQs" subtitle="Quick answers and hub guides for common questions." />
      <div
        id="faq"
        className="grid w-full grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <section className={`${panel} flex w-full flex-col p-5 sm:p-6`}>
          <div className="mb-3 border-b border-[#edf0f4] pb-3.5 dark:border-night-line">
            <h2 className="text-[17px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
              Frequently asked questions
            </h2>
          </div>

          <div className="flex-1 divide-y divide-[#edf0f4] dark:divide-night-line">
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
                  <Icon
                    name="chevron-down"
                    className={`shrink-0 text-[13px] text-[#94a3b8] transition-transform ${
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

        <aside className="flex flex-col">
          <section className={`${panel} flex flex-1 flex-col justify-center p-6 text-center`}>
            <div>
              <span className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-night-line">
                <Icon name="headset" className="text-[20px]" />
              </span>
              <h3 className="mb-1.5 text-[16px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                Still need help?
              </h3>
              <p className="mb-5 text-[13.5px] leading-relaxed text-[#64748b] dark:text-[#9c948c]">
                Can&apos;t find what you&apos;re looking for? Reach out directly via Messages or Contact Support.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <Link to={messagesPath} className={`${btnPrimary} w-full justify-center`}>
                <Icon name="message-circle" className="mr-1.5" />
                Open Messages
              </Link>
              <Link to={contactPath} className={`${btnGhost} w-full justify-center`}>
                <Icon name="mail" className="mr-1.5" />
                Contact Support
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
