import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { Avatar, ConfirmDialog, EmptyState, Modal, StatusBadge, TableSkeleton } from "../components/ui.jsx";
import { Notice, StatCard, StatGrid } from "../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, panel, stickyThead, tableScroll, td, th } from "../components/styles.js";
import { createUser, listUsers, updateUserVerification } from "../services/userService.js";
import { listParcels } from "../services/parcelService.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";
import { formatDate } from "../utils/format.js";
import { getParcelStatus } from "../utils/parcelStatus.js";
import {
  isOnline,
  readViewCache,
  useNetworkStatus,
  useReconnectRefresh,
  writeViewCache,
} from "../utils/network.js";
import {
  CachedDataNotice,
  LoadErrorState,
  OfflineState,
  ParcelCardListSkeleton,
} from "../components/Skeletons.jsx";
import Icon from "../components/Icon.jsx";
import { FilterSelect, SearchFilterBar, SearchInput } from "../components/SearchFilterBar.jsx";

const tone = {
  Active: "bg-[#eaf8ef] text-[#29945a]",
  Inactive: "bg-[#fff0f0] text-[#d94747]",
};

const AVATAR_TONES = ["orange", "blue", "green", "purple"];
const PAGE_SIZE = 8;

const EMPTY_FORM = {
  userId: null,
  sellerCode: "",
  name: "",
  shop_name: "",
  email: "",
  phone: "",
  pickup_address: "",
  status: "Active",
  password: "",
};

function generateTestPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "Sel";
  for (let i = 0; i < 7; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `${out}#${Math.floor(10 + Math.random() * 90)}`;
}

function getInitials(name) {
  return (
    String(name || "S")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "S"
  );
}

export default function Sellers() {
  const [rawSellers, setRawSellers] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { seller, kind }

  const { online } = useNetworkStatus();
  const [cachedAt, setCachedAt] = useState(() => readViewCache("coordinator-sellers")?.updatedAt || null);
  const [hasData, setHasData] = useState(() => Boolean(readViewCache("coordinator-sellers")?.data));

  const loadData = useCallback(async () => {
    if (!isOnline()) {
      const cached = readViewCache("coordinator-sellers");
      if (cached?.data) {
        setRawSellers(cached.data.sellers || []);
        setParcels(cached.data.parcels || []);
        setCachedAt(cached.updatedAt || null);
        setHasData(true);
      }
      setLoading(false);
      return;
    }
    setLoading((prev) => (hasData ? prev : true));
    setError("");
    try {
      const [usersData, parcelsData] = await Promise.all([
        listUsers("seller"),
        listParcels().catch(() => []),
      ]);
      const onlySellers = (Array.isArray(usersData) ? usersData : []).filter(
        (u) => u.role === "seller"
      );
      const realParcels = (Array.isArray(parcelsData) ? parcelsData : []).filter(
        (p) => p && p.parcel_id !== "PX123456"
      );
      setRawSellers(onlySellers);
      setParcels(realParcels);
      setHasData(true);
      setCachedAt(Date.now());
      writeViewCache("coordinator-sellers", { sellers: onlySellers, parcels: realParcels });
    } catch (err) {
      if (isOnline()) setError(err.message || "Failed to load sellers from the database.");
    } finally {
      setLoading(false);
    }
  }, [hasData]);

  useEffect(() => {
    const cached = readViewCache("coordinator-sellers");
    if (cached?.data) {
      setRawSellers(cached.data.sellers || []);
      setParcels(cached.data.parcels || []);
      setHasData(true);
      setLoading(false);
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useReconnectRefresh(loadData);

  const offlineEmpty = !online && !hasData;
  const showCachedNotice = !online && hasData;

  // Build database-driven seller records with live parcel metrics
  const sellers = useMemo(() => {
    return rawSellers.map((u, idx) => {
      const sellerCode = u.seller_code || `SEL-${String(u.user_id).padStart(4, "0")}`;
      const mine = parcels.filter(
        (p) =>
          (p.seller_id != null && Number(p.seller_id) === Number(u.user_id)) ||
          (p.seller_name && p.seller_name.trim().toLowerCase() === String(u.name || "").trim().toLowerCase())
      );

      const delivered = mine.filter(
        (p) => p.delivery_status === "DELIVERED" || p.status === "DELIVERED"
      ).length;

      const verified = mine.filter(
        (p) => p.verification_status === "VERIFIED" || p.status === "VERIFIED"
      ).length;

      const uiStatus = u.verification_status === "REJECTED" ? "Inactive" : "Active";

      return {
        userId: u.user_id,
        id: sellerCode,
        pickup: u.pickup_address || "",
        raw: u,
        name: u.name || "Unnamed Seller",
        shop: u.shop_name || u.name || "Seller Store",
        email: u.email || "—",
        phone: u.phone || "",
        initials: getInitials(u.name),
        tone: AVATAR_TONES[idx % AVATAR_TONES.length],
        joined: formatDate(u.created_at),
        deactivatedAt: u.deactivated_at || null,
        deactivatedByName: u.deactivated_by_name || null,
        recoveryExpiresAt: u.recovery_expires_at || null,
        status: uiStatus,
        verificationStatus: u.verification_status || "APPROVED",
        counts: {
          total: mine.length,
          verified,
          delivered,
          recent: mine.slice(0, 5),
        },
      };
    });
  }, [rawSellers, parcels]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sellers.filter(
      (s) =>
        (status === "All" || s.status === status) &&
        (!q ||
          [s.name, s.shop, s.email, s.id, s.phone]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)))
    );
  }, [sellers, status, search]);

  const pageRows = rows;
  const current = viewId != null ? sellers.find((s) => s.userId === viewId) : null;

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFormError("");
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, password: generateTestPassword() });
    setFormError("");
    setFormOpen(true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const shop = form.shop_name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const pickup = form.pickup_address.trim();

    if (!name || !shop || !email || !phone || !pickup) {
      return setFormError("Please fill in the seller name, shop name, email, contact number and pickup address.");
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) return setFormError("Please enter a valid email address.");
    if (!/^09\d{9}$/.test(phone)) {
      return setFormError("Contact number must be an 11-digit mobile number starting with 09.");
    }
    if (form.password.length < 8) {
      return setFormError("Assign a temporary password of at least 8 characters.");
    }

    setSaving(true);
    try {
      const user = await createUser({
        role: "seller",
        name,
        shop_name: shop,
        email,
        phone,
        pickup_address: pickup,
        password: form.password,
        status: form.status,
      });
      setRawSellers((prev) => [user, ...prev]);
      logAction({ category: "Sellers", action: "Created seller", target: name, detail: user.seller_code || email });
      setFormOpen(false);
      setCreated({ sellerCode: user.seller_code, shop, email, password: form.password });
    } catch (err) {
      setFormError(err.message || "Failed to create seller account.");
    } finally {
      setSaving(false);
    }
  };

  const actions = {
    Deactivate: {
      dbStatus: "REJECTED",
      title: "Deactivate this account?",
      confirmLabel: "Yes, Deactivate",
      danger: true,
      message: (seller) =>
        `Are you sure you want to deactivate ${seller.name}'s account? The user will immediately lose access to LOGISYNC. This account can still be reactivated within the next 7 days.`,
    },
    Activate: {
      dbStatus: "APPROVED",
      title: "Reactivate this account?",
      confirmLabel: "Yes, Reactivate",
      danger: false,
      message: (seller) =>
        `Are you sure you want to reactivate ${seller.name}'s account? The user will regain access to their LOGISYNC portal.`,
    },
  };

  const actionFor = (s) => (s.status === "Inactive" ? "Activate" : "Deactivate");

  const apply = async () => {
    if (!confirm || updatingId) return;
    const { seller, kind } = confirm;
    const cfg = actions[kind];
    setUpdatingId(seller.userId);
    try {
      const res = await updateUserVerification(seller.userId, cfg.dbStatus);
      const updatedRow = res?.user;
      setRawSellers((prev) =>
        prev.map((u) =>
          u.user_id === seller.userId
            ? {
                ...u,
                ...(updatedRow || {}),
                verification_status: cfg.dbStatus,
                deactivated_at: updatedRow ? updatedRow.deactivated_at : cfg.dbStatus === "REJECTED" ? new Date().toISOString() : null,
                recovery_expires_at: updatedRow ? updatedRow.recovery_expires_at : null,
              }
            : u
        )
      );
      toast(
        res?.message ||
          (kind === "Deactivate"
            ? `${seller.name}'s account has been deactivated. Recoverable for 7 days.`
            : `${seller.name}'s account has been reactivated.`)
      );
    } catch (err) {
      toast(err.message || "Failed to update seller status.", "error");
      if (err?.status === 410 || err?.code === "RECOVERY_EXPIRED" || err?.code === "ACCOUNT_DELETED") {
        loadData();
      }
    } finally {
      setUpdatingId(null);
      setConfirm(null);
    }
  };

  return (
    <>
      <Topbar
        title="Sellers"
        subtitle="Create, view, activate and deactivate seller accounts."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              title="Coming soon: bulk import of sellers via CSV or Excel (planned for deployment)."
              className={`${btnGhost} cursor-not-allowed opacity-60`}
            >
              <Icon name="file-input" /> Import Sellers
              <span className="ml-1 rounded-full bg-[#f1f1f1] px-2 py-0.5 text-[10px] font-bold text-[#777]">Coming soon</span>
            </button>
            <button type="button" onClick={loadData} className={btnGhost}>
              <Icon name="refresh-cw" /> Refresh
            </button>
            <button type="button" onClick={openCreate} className={btnPrimary}>
              <Icon name="plus" /> Add Seller
            </button>
          </div>
        }
      />

      {/* MOBILE LALAMOVE-STYLE HORIZONTAL FILTER BAR (max-[820px] ONLY) */}
      <div
        role="tablist"
        aria-label="Filter sellers by status"
        className="-mx-3.5 -mt-3.5 mb-3 max-[380px]:-mx-2.5 grid grid-cols-3 border-b border-slate-200/90 bg-white/95 backdrop-blur-md min-[821px]:hidden dark:border-night-line dark:bg-night-panel/95"
      >
        {[
          {
            key: "All",
            label: "All",
            count: sellers.length,
            textCls: "text-[#0f172a] dark:text-white",
            badgeCls: "bg-slate-200/80 text-[#0f172a] dark:bg-slate-600/40 dark:text-white",
            barCls: "bg-[#64748b]",
          },
          {
            key: "Active",
            label: "Active",
            count: sellers.filter((x) => x.status === "Active").length,
            textCls: "text-[#16a34a] dark:text-[#4ade80]",
            badgeCls: "bg-[#dcfce7] text-[#15803d] dark:bg-green-500/20 dark:text-[#4ade80]",
            barCls: "bg-[#16a34a]",
          },
          {
            key: "Inactive",
            label: "Inactive",
            count: sellers.filter((x) => x.status === "Inactive").length,
            textCls: "text-[#dc2626] dark:text-[#f87171]",
            badgeCls: "bg-[#fee2e2] text-[#dc2626] dark:bg-red-500/20 dark:text-[#f87171]",
            barCls: "bg-[#dc2626]",
          },
        ].map((tab) => {
          const active = status === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              className={`relative flex items-center justify-center gap-1.5 px-2 py-3.5 text-[12.5px] leading-tight transition ${tab.textCls} ${
                active ? "font-extrabold" : "font-bold opacity-85 hover:opacity-100"
              }`}
            >
              <span className="truncate">{tab.label}</span>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${tab.badgeCls}`}
              >
                {loading ? "…" : tab.count}
              </span>
              {active && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 bottom-0 h-[2.5px] rounded-full ${tab.barCls}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* MOBILE COMPACT ACTION ROW (below filter bar, upper-right) */}
      <div className="mb-3 flex items-center justify-end gap-2 min-[821px]:hidden">
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-bold text-slate-600 transition active:scale-95 dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
        >
          <Icon name="refresh-cw" className="text-[11px]" />
          <span>Refresh</span>
        </button>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-[12.5px] font-bold text-white shadow-xs transition active:scale-95 hover:bg-brand-dark"
        >
          <Icon name="plus" className="text-[11px]" />
          <span>Add Seller</span>
        </button>
      </div>

      {error && (
        <div className="mb-5">
          <Notice tone="error" icon="circle-alert" role="alert">
            {error}
          </Notice>
        </div>
      )}

      <div className="hidden min-[821px]:block">
        <StatGrid cols={3}>
          <StatCard
            label="Total sellers"
            value={loading ? "…" : sellers.length}
            icon="store"
            tone="gray"
          />
          <StatCard
            label="Active"
            value={loading ? "…" : sellers.filter((x) => x.status === "Active").length}
            icon="circle-check"
            tone="green"
          />
          <StatCard
            label="Inactive"
            value={loading ? "…" : sellers.filter((x) => x.status === "Inactive").length}
            icon="circle-x"
            tone="red"
          />
        </StatGrid>
      </div>

      <section className={`${panel} p-6 max-[600px]:p-4`}>
        <SearchFilterBar
          hasActiveFilters={Boolean(search.trim() || status !== "All")}
          onReset={() => {
            setSearch("");
            setStatus("All");
            setPage(1);
          }}
        >
          <SearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search seller name, shop, email or ID..."
            ariaLabel="Search sellers"
          />
          <FilterSelect
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            ariaLabel="Filter by status"
            icon="filter"
            active={status !== "All"}
            className="min-w-[180px]"
          >
            {["All", "Active", "Inactive"].map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s}
              </option>
            ))}
          </FilterSelect>
        </SearchFilterBar>

        {showCachedNotice && <CachedDataNotice updatedAt={cachedAt} />}
        {error && !offlineEmpty && (
          <div className="mb-4">
            <LoadErrorState compact title="Unable to load sellers" message={error} onRetry={loadData} />
          </div>
        )}

        <div className={`hidden min-[701px]:block ${tableScroll}`}>
          <table className="w-full min-w-[780px] border-collapse">
            <thead className={stickyThead}>
              <tr>
                {["Seller", "Shop", "Contact", "Parcels", "Status", ""].map((h, i) => (
                  <th key={i} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : (
              <tbody>
                {pageRows.map((s) => (
                  <tr
                    key={s.userId}
                    className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head"
                  >
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={s.initials} tone={s.tone} className="h-9 w-9 text-[12px]" />
                        <div>
                          <strong className="block text-[#333] dark:text-[#f1eeeb]">{s.name}</strong>
                          <small className="text-[11px] text-[#aaa]">{s.id}</small>
                        </div>
                      </div>
                    </td>
                    <td className={td}>{s.shop}</td>
                    <td className={td}>
                      <span className="block break-all text-[13px]">{s.email}</span>
                      {s.phone && <small className="text-[11px] text-[#aaa]">{s.phone}</small>}
                    </td>
                    <td className={td}>
                      <span className="font-semibold text-[#333] dark:text-[#f1eeeb]">
                        {s.counts.total}
                      </span>
                    </td>
                    <td className={td}>
                      <span
                        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                          tone[s.status]
                        }`}
                      >
                        {s.status}
                      </span>
                      {s.status === "Inactive" && s.recoveryExpiresAt && (
                        <small className="mt-1 block text-[11px] font-medium text-[#b45309] dark:text-amber-300">
                          Recovery ends {formatDate(s.recoveryExpiresAt)}
                        </small>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <button
                        type="button"
                        onClick={() => setViewId(s.userId)}
                        className="mr-3 text-[13px] font-semibold text-brand hover:underline"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        disabled={updatingId === s.userId}
                        onClick={() => setConfirm({ seller: s, kind: actionFor(s) })}
                        className={`text-[13px] font-semibold hover:underline disabled:opacity-50 ${
                          actionFor(s) === "Deactivate" ? "text-[#d94747]" : "text-[#29945a]"
                        }`}
                      >
                        {actionFor(s)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {!loading && offlineEmpty && (
            <div className="p-4">
              <OfflineState compact title="Seller directory unavailable offline" text="Reconnect to load seller accounts." onRetry={loadData} />
            </div>
          )}
          {!loading && !offlineEmpty && !error && rows.length === 0 && (
            <EmptyState
              icon="store"
              title="No sellers found"
              text={
                sellers.length === 0
                  ? "No seller accounts have been created yet. Create a Seller account in the Accounts page."
                  : "Try a different search or status filter."
              }
            />
          )}
        </div>

        {/* Mobile Card List */}
        <div className="min-[701px]:hidden space-y-3">
          {loading ? (
            <ParcelCardListSkeleton count={4} label="Loading sellers" />
          ) : offlineEmpty ? (
            <OfflineState compact title="Seller directory unavailable offline" text="Reconnect to load seller accounts." onRetry={loadData} />
          ) : pageRows.length === 0 ? (
            <EmptyState
              icon="store"
              title="No sellers found"
              text={
                sellers.length === 0
                  ? "No seller accounts have been created yet. Create a Seller account in the Accounts page."
                  : "Try a different search or status filter."
              }
            />
          ) : (
            pageRows.map((s) => (
              <div
                key={s.userId}
                className="rounded-xl border border-[#eee] bg-[#fcfcfd] p-4 dark:border-night-line dark:bg-night-head"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar initials={s.initials} tone={s.tone} className="h-9 w-9 text-[12px] shrink-0" />
                    <div className="min-w-0">
                      <strong className="block truncate text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">{s.name}</strong>
                      <span className="block truncate text-[12px] text-[#888]">{s.shop} · {s.id}</span>
                    </div>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shrink-0 ${
                      tone[s.status]
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                {s.status === "Inactive" && s.recoveryExpiresAt && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11.5px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <Icon name="clock" className="mr-1.5 h-3 w-3" />
                    Recovery period ends {formatDate(s.recoveryExpiresAt)}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-[#f1f3f7] pt-2.5 text-[12.5px] dark:border-night-line">
                  <span className="text-[#666] dark:text-[#d1c9c2]">
                    <strong className="text-[#333] dark:text-[#f1eeeb]">{s.counts.total}</strong> parcels
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setViewId(s.userId)}
                      className="font-bold text-brand hover:underline"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === s.userId}
                      onClick={() => setConfirm({ seller: s, kind: actionFor(s) })}
                      className={`font-semibold hover:underline disabled:opacity-50 ${
                        actionFor(s) === "Deactivate" ? "text-[#d94747]" : "text-[#29945a]"
                      }`}
                    >
                      {actionFor(s)}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <Modal
        open={!!current}
        onClose={() => setViewId(null)}
        z="z-[3500]"
        className="max-h-[90dvh] w-full max-w-[460px] overflow-y-auto p-5 sm:p-6 dark:bg-night-panel"
      >
        {current && (
          <>
            <button
              type="button"
              onClick={() => setViewId(null)}
              aria-label="Close"
              className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f6f8] text-[#7c8da0] transition hover:bg-[#e9edf2] dark:bg-night-line"
            >
              <Icon name="x" />
            </button>

            <div className="mb-3.5 flex items-center gap-3 pr-8">
              <Avatar initials={current.initials} tone={current.tone} className="h-12 w-12 shrink-0 text-[16px]" />
              <div className="min-w-0">
                <h3 className="truncate text-[17px] font-bold leading-snug">{current.name}</h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-[#888]">{current.id}</span>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      tone[current.status] || tone.Active
                    }`}
                  >
                    {current.status}
                  </span>
                </div>
              </div>
            </div>

            {current.status === "Inactive" && (
              <div className="mb-3.5 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-[12px] text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                <strong className="block font-bold">Account Inactive — 7-Day Recovery Window</strong>
                {current.deactivatedAt && (
                  <span className="mt-0.5 block">
                    Deactivated: {formatDate(current.deactivatedAt)}
                    {current.deactivatedByName ? ` by ${current.deactivatedByName}` : ""}
                  </span>
                )}
                {current.recoveryExpiresAt && (
                  <span className="mt-0.5 block font-semibold">
                    Permanent removal scheduled: {formatDate(current.recoveryExpiresAt)}
                  </span>
                )}
              </div>
            )}

            <div className="mb-3.5 grid grid-cols-3 gap-2">
              {[
                ["Total parcels", current.counts.total],
                ["Verified", current.counts.verified],
                ["Delivered", current.counts.delivered],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] px-3 py-2.5 dark:border-night-line dark:bg-night-head"
                >
                  <small className="block text-[11px] text-[#888]">{l}</small>
                  <strong className="text-[18px] leading-tight">{v}</strong>
                </div>
              ))}
            </div>

            <dl className="mb-3.5 space-y-1.5 rounded-xl border border-[#f1f3f7] bg-[#fcfcfd] px-3.5 py-2.5 text-[13px] dark:border-night-line dark:bg-night-head/60">
              {[
                ["Shop", current.shop || "—"],
                ["Email", current.email || "—"],
                ["Phone", current.phone || "—"],
                ["Pickup", current.pickup || "—"],
                ["Joined", current.joined || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-0.5">
                  <dt className="shrink-0 text-[#888]">{k}</dt>
                  <dd className="min-w-0 break-words text-right font-semibold text-[#27364f] dark:text-[#f1eeeb]">{v}</dd>
                </div>
              ))}
            </dl>

            <h4 className="mb-1.5 text-[13px] font-bold">Parcel history</h4>
            {current.counts.recent.length === 0 ? (
              <p className="mb-4 text-[12.5px] text-[#999]">No parcels registered by this seller yet.</p>
            ) : (
              <ul className="mb-4 max-h-40 divide-y divide-[#f1f1f1] overflow-y-auto pr-1 dark:divide-night-line">
                {current.counts.recent.map((p) => (
                  <li
                    key={p.parcel_id}
                    className="flex items-center justify-between gap-2.5 py-2 text-[12.5px]"
                  >
                    <span className="min-w-0 truncate">
                      <Link
                        to={`/parcels/${encodeURIComponent(p.parcel_id)}`}
                        onClick={() => setViewId(null)}
                        className="font-bold text-brand hover:underline"
                      >
                        {p.transaction_number || p.parcel_id}
                      </Link>{" "}
                      · {p.contents || "Parcel"} ({p.receiver_name})
                    </span>
                    <StatusBadge
                      status={
                        p.returnToHub
                          ? "Return to Hub"
                          : p.rescheduled
                          ? "Rescheduled"
                          : getParcelStatus(p)
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#f1f3f7] pt-3 dark:border-night-line">
              <Link
                to={`/messages?contact=${encodeURIComponent(current.name)}`}
                className={btnPrimary}
              >
                <Icon name="message-circle" /> Message
              </Link>
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        z="z-[3600]"
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto p-7 max-[600px]:p-5 dark:bg-night-panel"
      >
        {formOpen && (
          <form onSubmit={submitForm} noValidate>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 h-8 w-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
            >
              <Icon name="x" />
            </button>
            <h3 className="mb-1 pr-8 text-[18px] font-bold">
              Add Seller Account
            </h3>
            <p className="mb-4 text-[13px] text-[#999]">
              Credentials will be emailed to the seller for mandatory first-time password setup.
            </p>

            <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
              <div>
                <label className="mb-1 block text-[13px] font-semibold">Seller ID</label>
                <input
                  value="Auto-generated (SEL-0001…)"
                  readOnly
                  className={`${inputCls} cursor-not-allowed bg-[#f6f6f6] dark:bg-night-head`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold" htmlFor="sf-status">Account Status</label>
                <select
                  id="sf-status"
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value)}
                  className={inputCls}
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold" htmlFor="sf-name">Seller / Contact Person Name *</label>
                <input id="sf-name" value={form.name} onChange={(e) => setField("name", e.target.value)} maxLength={100} className={inputCls} placeholder="e.g. Maria Santos" />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold" htmlFor="sf-shop">Shop Name *</label>
                <input id="sf-shop" value={form.shop_name} onChange={(e) => setField("shop_name", e.target.value)} maxLength={150} className={inputCls} placeholder="e.g. Maria's Online Store" />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold" htmlFor="sf-email">Email Address *</label>
                <input id="sf-email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className={inputCls} placeholder="seller01@logisync.test" />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold" htmlFor="sf-phone">Contact Number *</label>
                <input
                  id="sf-phone"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className={inputCls}
                  placeholder="09XXXXXXXXX"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-[13px] font-semibold" htmlFor="sf-pickup">Pickup Address *</label>
              <textarea
                id="sf-pickup"
                rows={2}
                value={form.pickup_address}
                onChange={(e) => setField("pickup_address", e.target.value)}
                maxLength={300}
                className={`${inputCls} resize-none`}
                placeholder="House/Unit, Street, Barangay, Trece Martires City, Cavite"
              />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-[13px] font-semibold" htmlFor="sf-pass">
                Assigned Temporary Password *
              </label>
              <div className="flex gap-2">
                <input
                  id="sf-pass"
                  type="text"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  className={`${inputCls} font-mono`}
                  placeholder="At least 8 characters"
                  autoComplete="off"
                />
                <button type="button" onClick={() => setField("password", generateTestPassword())} className={`${btnGhost} whitespace-nowrap`}>
                  Generate
                </button>
              </div>
              <small className="mt-1 block text-[12px] text-[#999]">
                Share these credentials with the seller. Passwords are stored hashed and cannot be viewed later.
              </small>
            </div>

            {formError && (
              <div className="mt-4">
                <Notice tone="error" icon="circle-alert" role="alert">{formError}</Notice>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Saving…" : "Create Seller"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        z="z-[3700]"
        className="w-full max-w-[460px] p-7 dark:bg-night-panel"
      >
        {created && (
          <>
            <h3 className="mb-1 text-[18px] font-bold">
              <Icon name="circle-check" className="mr-2 text-[#29945a]" />
              Seller account created
            </h3>
            <p className="mb-4 text-[13px] text-[#999]">Give these test login credentials to the seller. The password will not be shown again.</p>
            <dl className="space-y-2 rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-4 text-[13.5px] dark:border-night-line dark:bg-night-head">
              <div className="flex justify-between gap-3"><dt className="text-[#999]">Seller ID</dt><dd className="font-bold">{created.sellerCode}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#999]">Shop</dt><dd className="font-semibold">{created.shop}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#999]">Email</dt><dd className="break-all font-mono">{created.email}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#999]">Password</dt><dd className="font-mono font-bold">{created.password}</dd></div>
            </dl>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(`Seller ID: ${created.sellerCode}\nEmail: ${created.email}\nPassword: ${created.password}`);
                  toast("Credentials copied.");
                }}
                className={btnGhost}
              >
                <Icon name="copy" /> Copy
              </button>
              <button type="button" onClick={() => setCreated(null)} className={btnPrimary}>Done</button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm ? actions[confirm.kind].title : ""}
        text={confirm ? actions[confirm.kind].message(confirm.seller) : ""}
        confirmLabel={confirm ? actions[confirm.kind].confirmLabel : "Confirm"}
        danger={confirm ? actions[confirm.kind].danger : false}
        busy={Boolean(confirm && updatingId === confirm.seller.userId)}
        onConfirm={apply}
        onCancel={() => !updatingId && setConfirm(null)}
      />
    </>
  );
}
