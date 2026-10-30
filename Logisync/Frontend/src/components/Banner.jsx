import { Link } from "react-router-dom";
import { useProfile } from "../store/profile.js";

// Hero banner sa Home. Para gumamit ng sarili mong picture: ilagay ang file bilang
// `public/banner.jpg` (hindi na kailangang baguhin ang code). Kapag wala, ang gradient + drawing ang lalabas.
export default function Banner() {
  const { name } = useProfile();
  return (
    <section className="relative overflow-hidden rounded-2xl mb-8 min-h-[220px] bg-gradient-to-r from-[#ff6818] via-[#ff7f3a] to-[#ffa466] text-white print:hidden">
      <img
        src="/banner.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#e9570b]/90 via-[#ff6818]/60 to-transparent" />

      {/* simpleng drawing ng truck at mga kahon */}
      <svg
        aria-hidden="true"
        viewBox="0 0 420 200"
        className="absolute right-4 bottom-0 h-[88%] max-w-[46%] opacity-95 max-[800px]:hidden"
      >
        <circle cx="330" cy="60" r="46" fill="#fff" opacity=".14" />
        <circle cx="90" cy="40" r="26" fill="#fff" opacity=".12" />
        <rect x="40" y="95" width="62" height="62" rx="6" fill="#fff" opacity=".95" />
        <path d="M40 120h62M71 95v62" stroke="#ff6818" strokeWidth="5" />
        <rect x="108" y="115" width="46" height="42" rx="5" fill="#ffe8d9" />
        <path d="M108 133h46M131 115v42" stroke="#ff6818" strokeWidth="4" />
        <rect x="170" y="88" width="150" height="70" rx="8" fill="#fff" />
        <path d="M320 108h38l26 28v22h-64z" fill="#fff" />
        <path d="M332 116h22l16 20h-38z" fill="#ffd2b3" />
        <circle cx="215" cy="162" r="17" fill="#292929" />
        <circle cx="215" cy="162" r="7" fill="#fff" />
        <circle cx="355" cy="162" r="17" fill="#292929" />
        <circle cx="355" cy="162" r="7" fill="#fff" />
        <path d="M0 180h420" stroke="#fff" strokeWidth="3" strokeDasharray="14 12" opacity=".6" />
        <path d="M390 40c-12 0-22 9-22 21 0 16 22 36 22 36s22-20 22-36c0-12-10-21-22-21z" fill="#fff" />
        <circle cx="390" cy="61" r="8" fill="#ff6818" />
      </svg>

      <div className="relative px-9 py-9 max-w-[620px] max-[600px]:px-6">
        <span className="inline-block mb-3 px-3 py-1 rounded-full bg-white/20 text-[12px] font-bold tracking-wide">
          WELCOME BACK, {name.toUpperCase()}
        </span>
        <h2 className="text-[34px] leading-tight font-extrabold mb-2 max-[600px]:text-[26px]">Verify. Track. Deliver.</h2>
        <p className="text-[15px] leading-relaxed text-white/90 mb-5">
          Monitor every parcel, coordinate with riders and sellers, and keep deliveries moving — all in one place.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/verification" className="px-4 py-2.5 rounded-lg bg-white text-brand text-[14px] font-bold hover:bg-[#fff3eb]">
            <i className="fa-solid fa-circle-check mr-1.5" /> Verify Parcels
          </Link>
          <Link to="/parcels" className="px-4 py-2.5 rounded-lg bg-white/15 border border-white/40 text-[14px] font-bold hover:bg-white/25">
            <i className="fa-solid fa-box-open mr-1.5" /> Track Parcels
          </Link>
        </div>
      </div>
    </section>
  );
}
