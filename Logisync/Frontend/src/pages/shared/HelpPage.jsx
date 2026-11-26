import { useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import { btnGhost, btnPrimary, panel } from "../../components/styles.js";
import { getRole } from "../../api.js";
import Icon from "../../components/Icon.jsx";

const FAQS = {
  seller: [
    ["How do I register a parcel?", "Open Create Parcel, scan the Shopee QR on the parcel (or type the transaction number), enter the receiver's name, contact, and contents, then press Register Parcel."],
    ["How do I upload my video proof?", "Open Scan QR / Upload Video, scan the parcel or enter its transaction number, choose your packing video (MP4, WebM, MOV, AVI or MPEG, up to 50 MB), and submit."],
    ["What do the parcel statuses mean?", "Waiting for Video: upload your packing video. Under Verification: Coordinator is reviewing. Verified / Ready for Delivery: approved for dispatch. Reupload Requested: upload a clearer video. Return to Hub: parcel is being returned."],
    ["The coordinator asked for a new video. What now?", "Open the parcel from Parcel Records or Notifications, read the Coordinator's remarks, record a new packing video, and submit it again."],
    ["How do I report an urgent parcel issue?", "Open Emergency Reports in the sidebar, select the affected parcel and category, describe the issue, and submit so the Coordinator is alerted immediately."],
    ["How do I reach the coordinator?", "Use Messages in the sidebar to chat directly with your hub Coordinator, or open Contact Us for support."],
    ["How do I change my password?", "Open Settings from the sidebar, then go to Account & Security → Password & Security."],
  ],
  rider: [
    ["How do I check and scan a parcel?", "Open Scan QR Code and scan the parcel QR (or type its transaction number) to view its verification clearance and delivery details."],
    ["When can I pick up and deliver a parcel?", "Only when the parcel is Verified / Ready for Delivery. If it is pending, rejected, or on hold, do not take it and message the Coordinator."],
    ["How do I mark a parcel Delivered, Rescheduled, or Return to Hub?", "Open My Deliveries, select the assigned parcel, and choose Delivered (with proof photo), Reschedule, or Return to Hub if delivery cannot be completed."],
    ["Where is the receiver's contact number and address?", "Open the parcel from My Deliveries or scan its QR code to view the receiver's name, phone number, and full delivery address."],
    ["How do I report an emergency on the road?", "Open Emergency Reports in the sidebar, pick the incident type and severity, and submit so your Coordinator can assist or place your parcels on hold."],
    ["How do I reach the coordinator?", "Use Messages in the sidebar to message your Coordinator directly."],
    ["How do I change my password?", "Open Settings from the sidebar, then go to Account & Security → Password & Security."],
  ],
};

export default function HelpPage() {
  const role = getRole() === "rider" ? "rider" : "seller";
  const [open, setOpen] = useState(0);

  return (
    <>
      <Topbar title="FAQs" subtitle="Quick answers and guides for common questions." />
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
            {FAQS[role].map(([q, a], i) => (
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
                Message your coordinator directly or contact hub support for assistance.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <Link to={`/${role}/messages`} className={`${btnPrimary} w-full justify-center`}>
                <Icon name="message-circle" className="mr-1.5" />
                Open Messages
              </Link>
              <Link to={`/${role}/contact`} className={`${btnGhost} w-full justify-center`}>
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
