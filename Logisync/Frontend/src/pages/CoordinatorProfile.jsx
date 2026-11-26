import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import UserAvatar from "../components/Avatar.jsx";
import ContactUsModal from "../components/auth/ContactUsModal.jsx";
import LogoutModal from "../components/LogoutModal.jsx";
import Topbar from "../components/Topbar.jsx";
import UnifiedSettings from "../components/settings/UnifiedSettings.jsx";
import { syncProfileFromServer, useProfile, useProfileSyncState } from "../store/profile.js";
import { useNetworkStatus } from "../utils/network.js";
import { CachedDataNotice, ProfileHeaderSkeleton } from "../components/Skeletons.jsx";
import Icon from "../components/Icon.jsx";

function formatCoordinatorId(profile) {
  if (profile.userId !== null && profile.userId !== undefined && String(profile.userId).trim() !== "") {
    return `COOR-${String(profile.userId).padStart(4, "0")}`;
  }
  return "COOR-0001";
}

function SectionLabel({ children }) {
  return (
    <p className="px-4 pt-3.5 pb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400 dark:text-[#9c948c]">
      {children}
    </p>
  );
}

function MenuRow({ icon, label, sublabel, to, onClick, iconTone = "default" }) {
  const iconBoxCls =
    iconTone === "brand"
      ? "bg-brand/12 text-brand dark:bg-brand/20"
      : "bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-[#f1eeeb]";

  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBoxCls}`}>
          <Icon name={icon} className="text-[16px]" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold text-[#0f172a] dark:text-[#f1eeeb]">
            {label}
          </span>
          {sublabel && (
            <span className="block truncate text-[12px] font-medium text-slate-500 dark:text-[#9c948c]">
              {sublabel}
            </span>
          )}
        </span>
      </span>
      <Icon name="chevron-right" className="shrink-0 text-[13px] text-slate-400" />
    </>
  );

  const rowCls =
    "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition active:bg-slate-50 hover:bg-slate-50/80 dark:hover:bg-night-head/70 dark:active:bg-night-head";

  if (to) {
    return (
      <Link to={to} className={rowCls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={rowCls}>
      {content}
    </button>
  );
}

export default function CoordinatorProfile() {
  const navigate = useNavigate();
  const profile = useProfile();
  const syncState = useProfileSyncState();
  const { online } = useNetworkStatus();
  const [accountCreationOpen, setAccountCreationOpen] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const showProfileSkeleton = online && syncState.syncing && (!profile.name || profile.name === "Guest");

  useEffect(() => {
    document.title = "Profile · LogiSync";
    syncProfileFromServer();
  }, []);

  const coordinatorId = formatCoordinatorId(profile);

  return (
    <>
      {/* Desktop Web View: Unified Profile & Settings layout */}
      <div className="hidden min-[821px]:block">
        <Topbar title="Profile & Settings" />
        <UnifiedSettings />
      </div>

      {/* Mobile View (max-[820px]): Single-column Profile Hub */}
      <div className="relative mx-auto min-h-[calc(100dvh-124px)] w-full max-w-xl overflow-hidden bg-[#f7f8fb] px-4 pt-6 pb-8 dark:bg-night-bg min-[821px]:hidden">
        {/* Soft decorative pastel corner accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full bg-[#e0f2fe]/70 blur-2xl dark:bg-brand/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-28 -right-14 h-36 w-36 rounded-full bg-[#ffedd5]/65 blur-2xl dark:bg-sky-500/10"
        />

        {!online && <CachedDataNotice updatedAt={syncState.lastSyncedAt} className="relative z-10 mb-4" />}

        {/* Profile Header */}
        {showProfileSkeleton ? (
          <ProfileHeaderSkeleton />
        ) : (
        <section className="relative z-10 flex flex-col items-center text-center min-[821px]:flex-row min-[821px]:items-center min-[821px]:justify-between min-[821px]:gap-6 min-[821px]:border-b min-[821px]:border-slate-200/80 min-[821px]:pb-6 min-[821px]:text-left min-[821px]:dark:border-night-line">
          <div className="flex flex-col items-center min-[821px]:flex-row min-[821px]:items-center min-[821px]:gap-5">
            <div className="relative shrink-0">
              <div className="rounded-full bg-white p-1 shadow-sm ring-2 ring-brand/25 dark:bg-night-panel">
                <UserAvatar className="h-[88px] w-[88px] text-[30px]" />
              </div>
              <button
                type="button"
                onClick={() => navigate("/settings?section=account")}
                aria-label="Edit Profile"
                title="Edit Profile"
                className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#0f172a] text-white shadow-md transition active:scale-95 hover:bg-brand dark:border-night-panel"
              >
                <Icon name="pencil" className="text-[11px]" />
              </button>
            </div>

            <div className="min-w-0">
              <h1 className="mt-3.5 max-w-full truncate px-2 text-[21px] font-extrabold tracking-tight text-[#0f172a] dark:text-white min-[821px]:mt-0 min-[821px]:px-0 min-[821px]:text-[24px]">
                {profile.name}
              </h1>
              <p className="mt-0.5 text-[13.5px] font-semibold text-slate-500 dark:text-[#b8b0a8]">
                Coordinator
              </p>

              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-200/85 px-3.5 py-1 text-[11.5px] font-bold tracking-wide text-slate-600 dark:bg-night-head dark:text-[#d1c9c2]">
                <span>COORDINATOR ID:</span>
                <span className="font-mono text-[#0f172a] dark:text-white">{coordinatorId}</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/settings?section=account")}
            className="mt-3.5 inline-flex shrink-0 items-center gap-2 rounded-lg border border-brand/40 bg-white px-4 py-2 text-[13px] font-semibold text-brand shadow-xs transition active:scale-95 hover:bg-brand hover:text-white dark:bg-night-panel dark:hover:bg-brand min-[821px]:mt-0"
          >
            <Icon name="pencil" className="text-[12px]" />
            <span>Edit Profile</span>
          </button>
        </section>
        )}

        {/* Sectioned Coordinator Profile Menu */}
        <nav aria-label="Coordinator profile menu" className="relative z-10 mt-6 space-y-3">
          <div className="space-y-3">
            {/* ACCOUNT & SECURITY */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:border-night-line dark:bg-night-panel">
            <SectionLabel>Account &amp; Security</SectionLabel>
            <div className="divide-y divide-slate-100 dark:divide-night-line">
              <MenuRow
                icon="user-round"
                label="Personal Information"
                to="/settings?section=account"
              />
            </div>
          </div>

          {/* MANAGEMENT & OPERATIONS */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:border-night-line dark:bg-night-panel">
            <SectionLabel>Management &amp; Operations</SectionLabel>

            {/* Expandable Account Creation Accordion */}
            <div className="px-2.5 pb-2">
              <button
                type="button"
                onClick={() => setAccountCreationOpen((v) => !v)}
                aria-expanded={accountCreationOpen}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                  accountCreationOpen
                    ? "bg-[#fff1e6] text-[#0f172a] dark:bg-brand/15 dark:text-white"
                    : "hover:bg-slate-50 text-[#0f172a] dark:text-[#f1eeeb] dark:hover:bg-night-head/70"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      accountCreationOpen
                        ? "bg-white/90 text-brand shadow-2xs dark:bg-night-panel"
                        : "bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-[#f1eeeb]"
                    }`}
                  >
                    <Icon name="user-plus" className="text-[16px]" />
                  </span>
                  <span className="truncate text-[14.5px] font-bold">
                    Account Creation
                  </span>
                </span>
                <Icon
                  name="chevron-down"
                  className={`shrink-0 text-[15px] text-slate-500 transition-transform duration-200 dark:text-[#b8b0a8] ${
                    accountCreationOpen ? "rotate-180 text-brand" : ""
                  }`}
                />
              </button>

              {accountCreationOpen && (
                <div className="mt-2 space-y-1.5 px-1">
                  {/* Indented Rider & Seller sub-accounts */}
                  <div className="ml-4 space-y-1 border-l-2 border-slate-200/90 pl-3.5 dark:border-night-line">
                    <Link
                      to="/riders"
                      className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-slate-50 active:bg-slate-100/70 dark:hover:bg-night-head/70"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-[#f1eeeb]">
                          <Icon name="bike" className="text-[15px]" />
                        </span>
                        <span className="min-w-0">
                          <strong className="block truncate text-[13.5px] font-bold text-[#0f172a] dark:text-[#f1eeeb]">
                            Rider Accounts
                          </strong>
                          <small className="block truncate text-[11.5px] text-slate-500 dark:text-[#9c948c]">
                            Manage rider accounts
                          </small>
                        </span>
                      </span>
                      <Icon name="chevron-right" className="shrink-0 text-[12px] text-slate-400" />
                    </Link>

                    <Link
                      to="/sellers"
                      className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-slate-50 active:bg-slate-100/70 dark:hover:bg-night-head/70"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#0f172a] dark:bg-night-head dark:text-[#f1eeeb]">
                          <Icon name="store" className="text-[15px]" />
                        </span>
                        <span className="min-w-0">
                          <strong className="block truncate text-[13.5px] font-bold text-[#0f172a] dark:text-[#f1eeeb]">
                            Seller Accounts
                          </strong>
                          <small className="block truncate text-[11.5px] text-slate-500 dark:text-[#9c948c]">
                            Manage seller accounts
                          </small>
                        </span>
                      </span>
                      <Icon name="chevron-right" className="shrink-0 text-[12px] text-slate-400" />
                    </Link>
                  </div>

                  {/* + Create New Account CTA */}
                  <div className="pt-1.5 pb-1">
                    <Link
                      to="/accounts"
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#fed7aa] bg-[#fff1e6] px-4 py-2.5 text-[13.5px] font-bold text-brand transition active:scale-[0.99] hover:bg-[#ffe5d0] dark:border-brand/35 dark:bg-brand/15 dark:hover:bg-brand/25"
                    >
                      <Icon name="plus" className="text-[15px]" />
                      <span>Create New Account</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-night-line dark:border-night-line">
              <MenuRow
                icon="chart-no-axes-column"
                label="Analytics"
                to="/analytics"
              />
              <MenuRow
                icon="triangle-alert"
                iconTone="brand"
                label="Emergency Reports"
                sublabel="Review Seller & Rider alerts"
                to="/emergency-reports"
              />
            </div>
          </div>

          </div>

          <div className="space-y-3 min-[821px]:space-y-4">
            {/* PREFERENCES */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:border-night-line dark:bg-night-panel">
            <SectionLabel>Preferences</SectionLabel>
            <div className="divide-y divide-slate-100 dark:divide-night-line">
              <MenuRow icon="settings" label="Settings" to="/settings" />
            </div>
          </div>

          {/* INFORMATION */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:border-night-line dark:bg-night-panel">
            <SectionLabel>Information</SectionLabel>
            <div className="divide-y divide-slate-100 dark:divide-night-line">
              <MenuRow
                icon="shield-check"
                label="Privacy Policy"
                to="/settings?section=privacy"
              />
              <MenuRow
                icon="info"
                label="About LOGISYNC"
                to="/settings?section=about"
              />
            </div>
          </div>

          {/* SUPPORT */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] dark:border-night-line dark:bg-night-panel">
            <SectionLabel>Support</SectionLabel>
            <div className="divide-y divide-slate-100 dark:divide-night-line">
              <MenuRow icon="circle-help" label="FAQs" to="/help#faq" />
              <MenuRow
                icon="headset"
                iconTone="brand"
                label="Need Help?"
                sublabel="Contact Support"
                onClick={() => setContactOpen(true)}
              />
            </div>
          </div>

          {/* Log Out Row */}
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-red-200/80 bg-[#fff4f2] px-4 py-3.5 text-left transition active:scale-[0.99] hover:bg-red-50 dark:border-red-900/40 dark:bg-red-950/25 dark:hover:bg-red-950/40"
          >
            <span className="flex min-w-0 items-center gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#d94747] shadow-2xs dark:bg-red-950/50 dark:text-red-300">
                <Icon name="log-out" className="text-[15px]" />
              </span>
              <span className="truncate text-[14.5px] font-bold text-[#c23a3a] dark:text-red-300">
                Log Out
              </span>
            </span>
            <Icon name="chevron-right" className="shrink-0 text-[12px] text-[#d94747]/70" />
          </button>
          </div>
        </nav>
      </div>

      <ContactUsModal open={contactOpen} onClose={() => setContactOpen(false)} />
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </>
  );
}
