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

const QUICK_LINKS = {
  seller: [
    { label: "Create Parcel", desc: "Register a new shipment", icon: "plus", to: "/seller/create" },
    { label: "Scan / Upload Video", desc: "Attach packing proof video", icon: "qr-code", to: "/seller/scan" },
    { label: "Parcel Records", desc: "Track all your shipments", icon: "package", to: "/seller/parcels" },
    { label: "Emergency Reports", desc: "Alert coordinator of urgent issues", icon: "triangle-alert", to: "/seller/emergency-report" },
  ],
  rider: [
    { label: "My Deliveries", desc: "View active assigned parcels", icon: "truck", to: "/rider/deliveries" },
    { label: "Scan QR Code", desc: "Verify or update parcel status", icon: "qr-code", to: "/rider/scan" },
    { label: "Emergency Reports", desc: "Report road or parcel incidents", icon: "triangle-alert", to: "/rider/emergency-report" },
    { label: "Messages", desc: "Chat directly with coordinator", icon: "message-circle", to: "/rider/messages" },
  ],
};

export default function HelpPage() {
  const role = getRole() === "rider" ? "rider" : "seller";
  const [open, setOpen] = useState(0);
  const [query, setQuery] = useState("");

  const filteredFaqs = FAQS[role].filter(([q, a]) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return q.toLowerCase().includes(term) || a.toLowerCase().includes(term);
  });

  return (
    <>
      <Topbar title="FAQs" subtitle="Quick answers and guides for common questions." />
      <div
        id="faq"
        className="grid w-full min-h-[calc(100vh-148px)] grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_330px]"
      >
        <section className={`${panel} flex w-full flex-col p-5 sm:p-6`}>
          <div className="mb-4 flex flex-col gap-3 border-b border-[#edf0f4] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-night-line">
            <div>
              <h2 className="text-[17px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                Frequently asked questions
              </h2>
              <p className="mt-0.5 text-[13px] text-[#64748b] dark:text-[#9c948c]">
                {filteredFaqs.length} {filteredFaqs.length === 1 ? "topic" : "topics"} available
              </p>
            </div>
            <div className="relative w-full sm:w-[250px]">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#94a3b8]"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(0);
                }}
                placeholder="Search questions..."
                aria-label="Search frequently asked questions"
                className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] py-2 pl-9 pr-3 text-[13.5px] text-[#1e293b] outline-none transition focus:border-brand focus:bg-white dark:border-night-line dark:bg-night-head dark:text-[#f1eeeb]"
              />
            </div>
          </div>

          <div className="flex-1 divide-y divide-[#edf0f4] dark:divide-night-line">
            {filteredFaqs.length === 0 ? (
              <div className="py-12 text-center text-[14px] text-[#64748b] dark:text-[#9c948c]">
                No matching questions found for &ldquo;{query}&rdquo;.
              </div>
            ) : (
              filteredFaqs.map(([q, a], i) => (
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
              ))
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <section className={`${panel} flex flex-col justify-between p-6 text-center`}>
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

          <section className={`${panel} flex-1 p-5`}>
            <h3 className="mb-3 text-[14px] font-bold uppercase tracking-wider text-[#64748b] dark:text-[#9c948c]">
              Quick Shortcuts
            </h3>
            <div className="space-y-2.5">
              {QUICK_LINKS[role].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-lg border border-[#edf0f4] bg-[#fafbfc] px-3 py-2.5 transition hover:border-brand/40 hover:bg-brand-softer/40 dark:border-night-line dark:bg-night-head dark:hover:border-brand/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand dark:bg-night-panel">
                    <Icon name={item.icon} className="text-[15px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-[#1e293b] dark:text-[#f1eeeb]">
                      {item.label}
                    </p>
                    <p className="truncate text-[12px] text-[#64748b] dark:text-[#9c948c]">
                      {item.desc}
                    </p>
                  </div>
                  <Icon name="chevron-right" className="shrink-0 text-[12px] text-[#94a3b8]" />
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
