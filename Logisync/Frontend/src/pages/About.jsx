import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { btnPrimary, panel } from "../components/styles.js";
import useBase from "../hooks/useBase.js";

const features = [
  ["fa-qrcode", "QR-based verification", "Coordinators scan a parcel's QR code and review the seller's packing video before it ships."],
  ["fa-truck-fast", "Delivery monitoring", "Follow every parcel from pickup to delivery with a clear tracking timeline and proof of delivery."],
  ["fa-comments", "Rider & seller messaging", "Talk directly to riders and sellers and handle urgent concerns in one place."],
  ["fa-file-lines", "Reports & analytics", "Generate reports, export them, and watch delivery performance over time."],
];
const steps = [
  ["1", "Seller registers a parcel", "The seller records the parcel and uploads a packing video."],
  ["2", "Coordinator verifies", "The coordinator scans the QR code and approves, flags or returns the parcel."],
  ["3", "Rider delivers", "A rider picks it up, delivers it and submits proof of delivery."],
];

export default function About() {
  const base = useBase();
  return (
    <>
      <Topbar title="About Us" subtitle="What LogiSync is and why we built it." />

      <section className={`${panel} p-9 mb-6 max-[600px]:p-6`}>
        <h2 className="text-[24px] font-bold mb-3">Reliable parcels, verified before they leave.</h2>
        <p className="max-w-[760px] text-[15px] leading-relaxed text-[#777] dark:text-[#d1c9c2]">
          LogiSync helps coordinators check parcels before delivery, keep riders and sellers connected, and give everyone a clear record of what happened. Our goal is fewer disputes, fewer lost parcels and faster, more transparent deliveries.
        </p>
      </section>

      <section className="grid grid-cols-4 gap-5 mb-6 max-[1200px]:grid-cols-2 max-[600px]:grid-cols-1">
        {features.map(([ic, t, d]) => (
          <div key={t} className={`${panel} p-6`}>
            <span className="w-[48px] h-[48px] rounded-xl bg-brand-soft text-brand flex items-center justify-center text-[19px] mb-4 dark:bg-night-line"><i className={`fa-solid ${ic}`} /></span>
            <h3 className="text-[16px] font-bold mb-1.5">{t}</h3>
            <p className="text-[13px] leading-relaxed text-[#888]">{d}</p>
          </div>
        ))}
      </section>

      <section className={`${panel} p-8 mb-6`}>
        <h2 className="text-[18px] font-bold mb-6">How it works</h2>
        <ol className="grid grid-cols-3 gap-6 max-[800px]:grid-cols-1">
          {steps.map(([n, t, d]) => (
            <li key={n} className="flex gap-4">
              <span className="w-[38px] h-[38px] shrink-0 rounded-full bg-brand text-white flex items-center justify-center font-bold">{n}</span>
              <div><strong className="block text-[15px] mb-1">{t}</strong><p className="text-[13px] leading-relaxed text-[#888]">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <div className="text-center py-4">
        <p className="text-[14px] text-[#888] mb-3">Have a question or suggestion?</p>
        <Link to={`${base}/contact`} className={btnPrimary}><i className="fa-solid fa-envelope" /> Contact us</Link>
      </div>
    </>
  );
}
