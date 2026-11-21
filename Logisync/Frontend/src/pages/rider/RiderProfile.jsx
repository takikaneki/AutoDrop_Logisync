import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserAvatar from "../../components/Avatar.jsx";
import ContactUsModal from "../../components/auth/ContactUsModal.jsx";
import LogoutModal from "../../components/LogoutModal.jsx";
import { syncProfileFromServer, useProfile } from "../../store/profile.js";

function formatRiderId(profile) {
  if (profile.riderCode) return profile.riderCode;
  if (profile.userId !== null && profile.userId !== undefined && String(profile.userId).trim() !== "") {
    return `RID-${String(profile.userId).padStart(4, "0")}`;
  }
  return "RID-0001";
}

export default function RiderProfile() {
  const navigate = useNavigate();
  const profile = useProfile();
  const [contactOpen, setContactOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    document.title = "Profile · LogiSync";
    syncProfileFromServer();
  }, []);

  const riderId = formatRiderId(profile);

  const primaryItems = [
    {
      key: "personal",
      label: "Personal Information",
      icon: "fa-regular fa-user",
      to: "/rider/settings?section=account",
    },
    {
      key: "faqs",
      label: "FAQs",
      icon: "fa-regular fa-circle-question",
      to: "/rider/help#faq",
    },
    {
      key: "contact",
      label: "Contact Us",
      icon: "fa-solid fa-phone",
      onClick: () => setContactOpen(true),
    },
  ];

  const legalItems = [
    {
      key: "privacy",
      label: "Privacy Policy",
      icon: "fa-solid fa-shield-halved",
      to: "/rider/settings?section=privacy",
    },
    {
      key: "terms",
      label: "Terms & Conditions",
      icon: "fa-solid fa-file-contract",
      to: "/rider/settings?section=terms",
    },
    {
      key: "about",
      label: "About LOGISYNC",
      icon: "fa-solid fa-circle-info",
      to: "/rider/settings?section=about",
    },
  ];

  const rowCls =
    "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition active:bg-slate-50 hover:bg-slate-50/80 dark:hover:bg-night-head/70 dark:active:bg-night-head";

  return (
    <>
      <div className="relative mx-auto min-h-[calc(100dvh-124px)] w-full max-w-xl overflow-hidden bg-[#f7f8fb] px-4 pt-6 pb-8 dark:bg-night-bg min-[821px]:rounded-2xl min-[821px]:border min-[821px]:border-slate-200/80 min-[821px]:bg-white min-[821px]:p-6 min-[821px]:dark:border-night-line min-[821px]:dark:bg-night-panel">
        {/* Soft decorative pastel corner accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full bg-[#e0f2fe]/70 blur-2xl dark:bg-brand/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-28 -right-14 h-36 w-36 rounded-full bg-[#ffedd5]/65 blur-2xl dark:bg-sky-500/10"
        />

        {/* Profile Header */}
        <section className="relative z-10 flex flex-col items-center text-center">
          <div className="relative">
            <div className="rounded-full p-1 ring-2 ring-brand/25 shadow-sm bg-white dark:bg-night-panel">
              <UserAvatar className="h-[88px] w-[88px] text-[30px]" />
            </div>
            <button
              type="button"
              onClick={() => navigate("/rider/settings?section=account")}
              aria-label="Edit Profile"
              title="Edit Profile"
              className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#0f172a] text-white shadow-md transition active:scale-95 hover:bg-brand dark:border-night-panel"
            >
              <i className="fa-solid fa-pen text-[11px]" />
            </button>
          </div>

          <h1 className="mt-3.5 max-w-full truncate px-2 text-[21px] font-extrabold tracking-tight text-[#0f172a] dark:text-white">
            {profile.name}
          </h1>
          <p className="mt-0.5 text-[13.5px] font-semibold text-slate-500 dark:text-[#b8b0a8]">
            Rider
          </p>

          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-200/85 px-3.5 py-1 text-[11.5px] font-bold tracking-wide text-slate-600 dark:bg-night-head dark:text-[#d1c9c2]">
            <span>RIDER ID:</span>
            <span className="font-mono text-[#0f172a] dark:text-white">{riderId}</span>
          </span>

          <button
            type="button"
            onClick={() => navigate("/rider/settings?section=account")}
            className="mt-3.5 inline-flex items-center gap-2 rounded-full border border-brand/35 bg-white px-5 py-2 text-[13px] font-bold text-brand shadow-xs transition active:scale-95 hover:bg-brand hover:text-white dark:bg-night-panel dark:hover:bg-brand"
          >
            <i className="fa-solid fa-user-pen text-[12px]" />
            <span>Edit Profile</span>
          </button>
        </section>

        {/* Profile Menu */}
        <nav aria-label="Rider profile menu" className="relative z-10 mt-6 space-y-3">
          {/* Group 1: Personal Information, FAQs, Contact Us */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] divide-y divide-slate-100 dark:border-night-line dark:bg-night-panel dark:divide-night-line">
            {primaryItems.map((item) =>
              item.to ? (
                <Link key={item.key} to={item.to} className={rowCls}>
                  <span className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-[#f1eeeb]">
                      <i className={`${item.icon} text-[15px]`} />
                    </span>
                    <span className="truncate text-[14.5px] font-semibold text-[#0f172a] dark:text-[#f1eeeb]">
                      {item.label}
                    </span>
                  </span>
                  <i className="fa-solid fa-chevron-right shrink-0 text-[12px] text-slate-400" />
                </Link>
              ) : (
                <button key={item.key} type="button" onClick={item.onClick} className={rowCls}>
                  <span className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-[#f1eeeb]">
                      <i className={`${item.icon} text-[15px]`} />
                    </span>
                    <span className="truncate text-[14.5px] font-semibold text-[#0f172a] dark:text-[#f1eeeb]">
                      {item.label}
                    </span>
                  </span>
                  <i className="fa-solid fa-chevron-right shrink-0 text-[12px] text-slate-400" />
                </button>
              )
            )}
          </div>

          {/* Highlighted Settings Card */}
          <Link
            to="/rider/settings"
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#fed7aa]/90 bg-[#fff3e8] px-4 py-3.5 shadow-[0_2px_10px_rgba(238,77,45,0.07)] transition active:scale-[0.99] hover:bg-[#ffead6] dark:border-brand/30 dark:bg-brand/15 dark:hover:bg-brand/20"
          >
            <span className="flex min-w-0 items-center gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/90 text-[#0f172a] shadow-2xs dark:bg-night-panel dark:text-brand">
                <i className="fa-solid fa-gear text-[15px]" />
              </span>
              <span className="truncate text-[14.5px] font-bold text-[#0f172a] dark:text-white">
                Settings
              </span>
            </span>
            <i className="fa-solid fa-chevron-right shrink-0 text-[12px] text-brand" />
          </Link>

          {/* Group 2: Privacy Policy, Terms & Conditions, About LOGISYNC */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] divide-y divide-slate-100 dark:border-night-line dark:bg-night-panel dark:divide-night-line">
            {legalItems.map((item) => (
              <Link key={item.key} to={item.to} className={rowCls}>
                <span className="flex min-w-0 items-center gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-[#f1eeeb]">
                    <i className={`${item.icon} text-[15px]`} />
                  </span>
                  <span className="truncate text-[14.5px] font-semibold text-[#0f172a] dark:text-[#f1eeeb]">
                    {item.label}
                  </span>
                </span>
                <i className="fa-solid fa-chevron-right shrink-0 text-[12px] text-slate-400" />
              </Link>
            ))}
          </div>

          {/* Log Out Row */}
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-red-200/80 bg-[#fff4f2] px-4 py-3.5 text-left transition active:scale-[0.99] hover:bg-red-50 dark:border-red-900/40 dark:bg-red-950/25 dark:hover:bg-red-950/40"
          >
            <span className="flex min-w-0 items-center gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#d94747] shadow-2xs dark:bg-red-950/50 dark:text-red-300">
                <i className="fa-solid fa-right-from-bracket text-[15px]" />
              </span>
              <span className="truncate text-[14.5px] font-bold text-[#c23a3a] dark:text-red-300">
                Log Out
              </span>
            </span>
            <i className="fa-solid fa-chevron-right shrink-0 text-[12px] text-[#d94747]/70" />
          </button>
        </nav>
      </div>

      <ContactUsModal open={contactOpen} onClose={() => setContactOpen(false)} />
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
