import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { EmptyState, Modal, StatusBadge, TableSkeleton, ConfirmDialog } from "../components/ui.jsx";
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
  "On Delivery": "bg-[#fff0e7] text-[#e9651c]",
  Inactive: "bg-[#fff0f0] text-[#d94747]",
};

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  agency: "",
  status: "Active",
  password: "",
};

function generateTestPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "Rid";
  for (let i = 0; i < 7; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `${out}#${Math.floor(10 + Math.random() * 90)}`;
}

const PAGE_SIZE = 8;

export default function Riders() {
  const [rawRiders, setRawRiders] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [zone, setZone] = useState("All");
  const [agencyFilter, setAgencyFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { rider, kind }
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
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const agency = form.agency.trim();

    if (!name || !email || !phone || !agency) {
      return setFormError("Please fill in the rider name, email / login username, contact number and assigned agency.");
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) return setFormError("Please enter a valid email address / login username.");
    if (!/^09\d{9}$/.test(phone)) {
      return setFormError("Contact number must be an 11-digit mobile number starting with 09.");
    }
    if (form.password.length < 8) {
      return setFormError("Assign a temporary password of at least 8 characters.");
    }

    setSaving(true);
    try {
      const user = await createUser({
        role: "rider",
        name,
        email,
        phone,
        agency,
        password: form.password,
        status: form.status,
      });
      setRawRiders((prev) => [user, ...prev]);
      logAction({ category: "Riders", action: "Created rider", target: name, detail: user.rider_code || email });
      setFormOpen(false);
      setCreated({
        riderCode: user.rider_code,
        agency: user.agency,
        email,
        password: form.password,
      });
    } catch (err) {
      setFormError(err.message || "Failed to create rider account.");
    } finally {
      setSaving(false);
    }
  };

  const [updatingId, setUpdatingId] = useState(null);

  const applyStatus = async () => {
    if (!confirm || updatingId) return;
    const { rider, kind } = confirm;
    const next = kind === "Deactivate" ? "REJECTED" : "APPROVED";
    setUpdatingId(rider.userId);
    try {
      const res = await updateUserVerification(rider.userId, next);
      const updatedRow = res?.user;
      setRawRiders((prev) =>
        prev.map((u) =>
          u.user_id === rider.userId
            ? {
                ...u,
                ...(updatedRow || {}),
                verification_status: next,
                deactivated_at: updatedRow ? updatedRow.deactivated_at : next === "REJECTED" ? new Date().toISOString() : null,
                recovery_expires_at: updatedRow ? updatedRow.recovery_expires_at : null,
              }
            : u
        )
      );
      toast(
        res?.message ||
          (kind === "Deactivate"
            ? `${rider.name}'s account has been deactivated. Recoverable for 7 days.`
            : `${rider.name}'s account has been reactivated.`)
      );
    } catch (err) {
      toast(err.message || "Failed to update rider status.", "error");
      if (err?.status === 410 || err?.code === "RECOVERY_EXPIRED" || err?.code === "ACCOUNT_DELETED") {
        loadData();
      }
    } finally {
      setUpdatingId(null);
      setConfirm(null);
    }
  };

  const { online } = useNetworkStatus();
  const [cachedAt, setCachedAt] = useState(() => readViewCache("coordinator-riders")?.updatedAt || null);
  const [hasData, setHasData] = useState(() => Boolean(readViewCache("coordinator-riders")?.data));

  const loadData = useCallback(async () => {
    if (!isOnline()) {
      const cached = readViewCache("coordinator-riders");
      if (cached?.data) {
        setRawRiders(cached.data.riders || []);
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
        listUsers("rider"),
        listParcels().catch(() => []),
      ]);
      const onlyRiders = (Array.isArray(usersData) ? usersData : []).filter(
        (u) => u.role === "rider"
      );
      const realParcels = (Array.isArray(parcelsData) ? parcelsData : []).filter(
        (p) => p && p.parcel_id !== "PX123456"
      );
      setRawRiders(onlyRiders);
      setParcels(realParcels);
      setHasData(true);
      setCachedAt(Date.now());
      writeViewCache("coordinator-riders", { riders: onlyRiders, parcels: realParcels });
    } catch (err) {
      if (isOnline()) setError(err.message || "Failed to load riders from the database.");
    } finally {
      setLoading(false);
    }
  }, [hasData]);

  useEffect(() => {
    const cached = readViewCache("coordinator-riders");
    if (cached?.data) {
      setRawRiders(cached.data.riders || []);
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

  // Build database-driven rider records with live parcel metrics
  const riders = useMemo(() => {
    return rawRiders.map((u) => {
      const riderCode = u.rider_code || `RID-${String(u.user_id).padStart(4, "0")}`;
      const mine = parcels.filter(
        (p) =>
          (p.rider_id != null && Number(p.rider_id) === Number(u.user_id)) ||
          (p.rider_name && p.rider_name.trim().toLowerCase() === String(u.name || "").trim().toLowerCase())
      );

      const transit = mine.filter(
        (p) =>
          p.delivery_status === "TO_DELIVER" ||
          p.status === "OUT_FOR_DELIVERY" ||
          p.status === "RESCHEDULED"
      ).length;

      const delivered = mine.filter(
        (p) => p.delivery_status === "DELIVERED" || p.status === "DELIVERED"
      ).length;

      const failed = mine.filter(
        (p) =>
          p.delivery_status === "FAILED" ||
          p.status === "DELIVERY_FAILED" ||
          p.status === "RETURN_TO_HUB" ||
          p.returnToHub
      ).length;

      const liveStatus =
        u.verification_status === "REJECTED"
          ? "Inactive"
          : transit > 0
          ? "On Delivery"
          : "Active";

      return {
        userId: u.user_id,
        id: riderCode,
        raw: u,
        agency: u.agency || "Unassigned",
        riderType: String(u.rider_type || "LM").toUpperCase() === "FM" ? "FM" : "LM",
        accountActive: u.verification_status !== "REJECTED",
        name: u.name || "Unnamed Rider",
        email: u.email || "—",
        phone: u.phone || "—",
        zone: u.zone || "General",
        vehicle: u.vehicle || "Motorcycle",
        plate: u.plate_number || "",
        joined: formatDate(u.created_at),
        status: liveStatus,
        stats: {
          total: mine.length,
          transit,
          delivered,
          failed,
          recent: mine.slice(0, 5),
        },
      };
    });
  }, [rawRiders, parcels]);

  const zones = useMemo(
    () => [...new Set(riders.map((r) => r.zone).filter(Boolean))].sort(),
    [riders]
  );

  const agencies = useMemo(
    () => [...new Set(riders.map((r) => r.agency).filter(Boolean))].sort(),
    [riders]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return riders.filter(
      (r) =>
        (status === "All" || r.status === status) &&
        (zone === "All" || r.zone === zone) &&
        (agencyFilter === "All" || r.agency === agencyFilter) &&
        (!q ||
          [r.name, r.email, r.zone, r.id, r.phone, r.agency]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)))
    );
  }, [riders, status, zone, agencyFilter, search]);

  const pageRows = rows;
  const current = viewId != null ? riders.find((r) => r.userId === viewId) : null;

  return (
    <>
      <Topbar
        title="Riders"
        subtitle="Create, view, activate and deactivate rider accounts. Track agency affiliation."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={loadData} className={btnGhost}>
              <Icon name="refresh-cw" /> Refresh
            </button>
            <button type="button" onClick={openCreate} className={btnPrimary}>
              <Icon name="plus" /> Add Rider
            </button>
          </div>
        }
      />

      {/* MOBILE LALAMOVE-STYLE HORIZONTAL FILTER BAR (max-[820px] ONLY) */}
      <div
        role="tablist"
        aria-label="Filter riders by status"
        className="-mx-3.5 -mt-3.5 mb-3 max-[380px]:-mx-2.5 grid grid-cols-3 border-b border-slate-200/90 bg-white/95 backdrop-blur-md min-[821px]:hidden dark:border-night-line dark:bg-night-panel/95"
      >
        {[
          {
            key: "All",
            label: "All",
            count: riders.length,
            textCls: "text-[#0f172a] dark:text-white",
            badgeCls: "bg-slate-200/80 text-[#0f172a] dark:bg-slate-600/40 dark:text-white",
            barCls: "bg-[#64748b]",
          },
          {
            key: "Active",
            label: "Active",
            count: riders.filter((r) => r.status === "Active").length,
            textCls: "text-[#16a34a] dark:text-[#4ade80]",
            badgeCls: "bg-[#dcfce7] text-[#15803d] dark:bg-green-500/20 dark:text-[#4ade80]",
            barCls: "bg-[#16a34a]",
          },
          {
            key: "On Delivery",
            label: "On Delivery",
            count: riders.filter((r) => r.status === "On Delivery").length,
            textCls: "text-[#2563eb] dark:text-[#60a5fa]",
            badgeCls: "bg-[#dbeafe] text-[#1d4ed8] dark:bg-blue-500/20 dark:text-[#60a5fa]",
            barCls: "bg-[#2563eb]",
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
              className={`relative flex items-center justify-center gap-1.5 px-1.5 py-3.5 text-[12px] max-[360px]:text-[11px] leading-tight transition ${tab.textCls} ${
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
          <span>Add Rider</span>
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
            label="Total riders"
            value={loading ? "…" : riders.length}
            icon="bike"
            tone="gray"
          />
          <StatCard
            label="Active"
            value={loading ? "…" : riders.filter((r) => r.status === "Active").length}
            icon="circle-check"
            tone="green"
          />
          <StatCard
            label="On Delivery"
            value={loading ? "…" : riders.filter((r) => r.status === "On Delivery").length}
            icon="truck"
            tone="blue"
          />
        </StatGrid>
      </div>

      <section className={`${panel} p-6 max-[600px]:p-4`}>
        <SearchFilterBar
          hasActiveFilters={Boolean(
            search.trim() || agencyFilter !== "All" || zone !== "All" || status !== "All"
          )}
          onReset={() => {
            setSearch("");
            setAgencyFilter("All");
            setZone("All");
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
            placeholder="Search rider name, email, zone or ID..."
            ariaLabel="Search riders"
          />
          <FilterSelect
            value={agencyFilter}
            onChange={(e) => {
              setAgencyFilter(e.target.value);
              setPage(1);
            }}
            ariaLabel="Filter by agency"
            icon="warehouse"
            active={agencyFilter !== "All"}
            className="min-w-[165px]"
          >
            <option value="All">All agencies</option>
            {agencies.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={zone}
            onChange={(e) => {
              setZone(e.target.value);
              setPage(1);
            }}
            ariaLabel="Filter by zone"
            icon="map-pin"
            active={zone !== "All"}
            className="min-w-[150px]"
          >
            <option value="All">All zones</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            ariaLabel="Filter by status"
            icon="filter"
            active={status !== "All"}
            className="min-w-[155px]"
          >
            {["All", "Active", "On Delivery", "Inactive"].map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s}
              </option>
            ))}
          </FilterSelect>
        </SearchFilterBar>

        {showCachedNotice && <CachedDataNotice updatedAt={cachedAt} />}
        {error && !offlineEmpty && (
          <div className="mb-4">
            <LoadErrorState compact title="Unable to load riders" message={error} onRetry={loadData} />
          </div>
        )}

        <div className={`hidden min-[701px]:block ${tableScroll}`}>
          <table className="w-full min-w-[700px] border-collapse">
            <thead className={stickyThead}>
              <tr>
                {["Rider", "Email / Contact", "Agency", "Parcels", "Status", ""].map((h, i) => (
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
                {pageRows.map((r) => (
                  <tr
                    key={r.userId}
                    className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head"
                  >
                    <td className={td}>
                      <strong className="block text-[#333] dark:text-[#f1eeeb]">{r.name}</strong>
                      <small className="text-[11px] text-[#aaa]">{r.id}</small>
                    </td>
                    <td className={td}>
                      <span className="block break-all text-[13px]">{r.email}</span>
                      {r.phone !== "—" && (
                        <small className="text-[11px] text-[#aaa]">{r.phone}</small>
                      )}
                    </td>
                    <td className={td}>{r.agency}</td>
                    <td className={td}>
                      <span className="font-semibold text-[#333] dark:text-[#f1eeeb]">
                        {r.stats.total}
                      </span>
                      {r.stats.transit > 0 && (
                        <small className="ml-1.5 text-[11px] font-semibold text-brand">
                          ({r.stats.transit} active)
                        </small>
                      )}
                    </td>
                    <td className={td}>
                      <span
                        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                          tone[r.status] || tone.Active
                        }`}
                      >
                        {r.status}
                      </span>
                      {!r.accountActive && r.raw?.recovery_expires_at && (
                        <small className="mt-1 block text-[11px] font-medium text-[#b45309] dark:text-amber-300">
                          Recovery ends {formatDate(r.raw.recovery_expires_at)}
                        </small>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <button
                        type="button"
                        onClick={() => setViewId(r.userId)}
                        className="mr-3 text-[13px] font-semibold text-brand hover:underline"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        disabled={updatingId === r.userId}
                        onClick={() => setConfirm({ rider: r, kind: r.accountActive ? "Deactivate" : "Activate" })}
                        className={`text-[13px] font-semibold hover:underline disabled:opacity-50 ${r.accountActive ? "text-[#d94747]" : "text-[#29945a]"}`}
                      >
                        {r.accountActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {!loading && offlineEmpty && (
            <div className="p-4">
              <OfflineState compact title="Rider directory unavailable offline" text="Reconnect to load rider accounts." onRetry={loadData} />
            </div>
          )}
          {!loading && !offlineEmpty && !error && rows.length === 0 && (
            <EmptyState
              icon="bike"
              title="No riders found"
              text={
                riders.length === 0
                  ? "No rider accounts have been created yet. Create a Rider account in the Accounts page."
                  : "Try a different search, zone, or status filter."
              }
            />
          )}
        </div>

        {/* Mobile Card List */}
        <div className="min-[701px]:hidden space-y-3">
          {loading ? (
            <ParcelCardListSkeleton count={4} label="Loading riders" />
          ) : offlineEmpty ? (
            <OfflineState compact title="Rider directory unavailable offline" text="Reconnect to load rider accounts." onRetry={loadData} />
          ) : pageRows.length === 0 ? (
            <EmptyState
              icon="bike"
              title="No riders found"
              text={
                riders.length === 0
                  ? "No rider accounts have been created yet. Create a Rider account in the Accounts page."
                  : "Try a different search, zone, or status filter."
              }
            />
          ) : (
            pageRows.map((r) => (
              <div
                key={r.userId}
                className="rounded-xl border border-[#eee] bg-[#fcfcfd] p-4 dark:border-night-line dark:bg-night-head"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="block text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">{r.name}</strong>
                    <span className="text-[12px] text-[#888]">{r.id} · {r.agency}</span>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      tone[r.status] || tone.Active
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                {!r.accountActive && r.raw?.recovery_expires_at && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11.5px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <Icon name="clock" className="mr-1.5 h-3 w-3" />
                    Recovery period ends {formatDate(r.raw.recovery_expires_at)}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-[#f1f3f7] pt-2.5 text-[12.5px] dark:border-night-line">
                  <div className="text-[#666] dark:text-[#d1c9c2]">
                    <span className="font-semibold text-[#333] dark:text-[#f1eeeb]">{r.stats.total}</span> parcels
                    {r.stats.transit > 0 && <span className="text-brand font-semibold ml-1">({r.stats.transit} active)</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setViewId(r.userId)}
                      className="font-bold text-brand hover:underline"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === r.userId}
                      onClick={() => setConfirm({ rider: r, kind: r.accountActive ? "Deactivate" : "Activate" })}
                      className={`font-semibold hover:underline disabled:opacity-50 ${r.accountActive ? "text-[#d94747]" : "text-[#29945a]"}`}
                    >
                      {r.accountActive ? "Deactivate" : "Activate"}
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
        className="w-full max-w-[520px] p-7 dark:bg-night-panel"
      >
        {current && (
          <>
            <button
              type="button"
              onClick={() => setViewId(null)}
              aria-label="Close"
              className="absolute right-4 top-4 h-8 w-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
            >
              <Icon name="x" />
            </button>
            <div className="mb-5 flex items-center gap-4">
              <span className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-brand-soft text-[22px] text-brand">
                <Icon name="bike" />
              </span>
              <div>
                <h3 className="text-[18px] font-bold">{current.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[12px] text-[#888]">{current.id}</span>
                  <span
                    className={`inline-block rounded-full px-3 py-0.5 text-[12px] font-semibold ${
                      tone[current.status] || tone.Active
                    }`}
                  >
                    {current.status}
                  </span>
                </div>
              </div>
            </div>

            {!current.accountActive && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-[12.5px] text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                <strong className="block font-bold">Account Inactive — 7-Day Recovery Window</strong>
                {current.raw?.deactivated_at && (
                  <span className="mt-0.5 block">
                    Deactivated: {formatDate(current.raw.deactivated_at)}
                    {current.raw?.deactivated_by_name ? ` by ${current.raw.deactivated_by_name}` : ""}
                  </span>
                )}
                {current.raw?.recovery_expires_at && (
                  <span className="mt-0.5 block font-semibold">
                    Permanent removal scheduled: {formatDate(current.raw.recovery_expires_at)}
                  </span>
                )}
              </div>
            )}

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 max-[380px]:grid-cols-1">
              {[
                ["Assigned", current.stats.total],
                ["In transit", current.stats.transit],
                ["Delivered", current.stats.delivered],
                ["Failed", current.stats.failed],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-3.5 dark:border-night-line dark:bg-night-head"
                >
                  <small className="block text-[12px] text-[#999]">{l}</small>
                  <strong className="text-[20px]">{v}</strong>
                </div>
              ))}
            </div>

            <dl className="mb-5 space-y-2.5 text-[14px]">
              {[
                ["Agency", current.agency],
                ["Email", current.email],
                ["Phone", current.phone],
                ["Zone", current.zone],
                ["Vehicle", current.plate ? `${current.vehicle} · ${current.plate}` : current.vehicle],
                ["Joined", current.joined],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-[#999]">{k}</dt>
                  <dd className="break-all text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            <h4 className="mb-2 text-[14px] font-bold">Assigned parcels</h4>
            {current.stats.recent.length === 0 ? (
              <p className="mb-5 text-[13px] text-[#999]">No parcels assigned to this rider yet.</p>
            ) : (
              <ul className="mb-5 divide-y divide-[#f1f1f1] dark:divide-night-line">
                {current.stats.recent.map((p) => (
                  <li
                    key={p.parcel_id}
                    className="flex items-center justify-between gap-3 py-2.5 text-[13px]"
                  >
                    <span className="truncate">
                      <Link
                        to={`/parcels/${encodeURIComponent(p.parcel_id)}`}
                        onClick={() => setViewId(null)}
                        className="font-bold text-brand hover:underline"
                      >
                        {p.transaction_number || p.parcel_id}
                      </Link>{" "}
                      · {p.receiver_name} ({p.contents || "Parcel"})
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

            <div className="flex flex-wrap gap-2.5">
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
              Add Rider Account
            </h3>
            <p className="mb-4 text-[13px] text-[#999]">
              Riders are recruited through Shopee agency partners. Credentials will be emailed for mandatory first-time password setup.
            </p>

            <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
              <div>
                <label className="mb-1 block text-[13px] font-semibold">Rider ID</label>
                <input
                  value="Auto-generated (RID-0001…)"
                  readOnly
                  className={`${inputCls} cursor-not-allowed bg-[#f6f6f6] dark:bg-night-head`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold" htmlFor="rf-status">Account Status</label>
                <select id="rf-status" value={form.status} onChange={(e) => setField("status", e.target.value)} className={inputCls}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold" htmlFor="rf-name">Rider Full Name *</label>
                <input id="rf-name" value={form.name} onChange={(e) => setField("name", e.target.value)} maxLength={100} className={inputCls} placeholder="e.g. Juan Dela Cruz" />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold" htmlFor="rf-phone">Contact Number *</label>
                <input
                  id="rf-phone"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className={inputCls}
                  placeholder="09XXXXXXXXX"
                />
              </div>
              <div className="col-span-2 max-[600px]:col-span-1">
                <label className="mb-1 block text-[13px] font-semibold" htmlFor="rf-email">Email Address / Login Username *</label>
                <input id="rf-email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className={inputCls} placeholder="rider01@logisync.test" />
              </div>
              <div className="col-span-2 max-[600px]:col-span-1">
                <label className="mb-1 block text-[13px] font-semibold" htmlFor="rf-agency">Assigned Agency *</label>
                <input
                  id="rf-agency"
                  list="rider-agencies"
                  value={form.agency}
                  onChange={(e) => setField("agency", e.target.value)}
                  maxLength={150}
                  className={inputCls}
                  placeholder="e.g. Trece Martires Test Logistics Agency"
                />
                <datalist id="rider-agencies">
                  {agencies.filter((a) => a !== "Unassigned").map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-[13px] font-semibold" htmlFor="rf-pass">
                Assigned Temporary Password *
              </label>
              <div className="flex gap-2">
                <input
                  id="rf-pass"
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
                Each rider gets an individual login. Passwords are stored hashed and cannot be viewed later.
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
                {saving ? "Saving…" : "Create Rider"}
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
              Rider account created
            </h3>
            <p className="mb-4 text-[13px] text-[#999]">Give these temporary login credentials to the rider. The password will not be shown again.</p>
            <dl className="space-y-2 rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-4 text-[13.5px] dark:border-night-line dark:bg-night-head">
              <div className="flex justify-between gap-3"><dt className="text-[#999]">Rider ID</dt><dd className="font-bold">{created.riderCode}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#999]">Agency</dt><dd className="font-semibold">{created.agency}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#999]">Login</dt><dd className="break-all font-mono">{created.email}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#999]">Password</dt><dd className="font-mono font-bold">{created.password}</dd></div>
            </dl>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(`Rider ID: ${created.riderCode}\nLogin: ${created.email}\nPassword: ${created.password}`);
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
        title={
          confirm
            ? confirm.kind === "Deactivate"
              ? "Deactivate this account?"
              : "Reactivate this account?"
            : ""
        }
        text={
          confirm
            ? confirm.kind === "Deactivate"
              ? `Are you sure you want to deactivate ${confirm.rider.name}'s account? The user will immediately lose access to LOGISYNC. This account can still be reactivated within the next 7 days.`
              : `Are you sure you want to reactivate ${confirm.rider.name}'s account? The user will regain access to their LOGISYNC portal.`
            : ""
        }
        confirmLabel={
          confirm
            ? confirm.kind === "Deactivate"
              ? "Yes, Deactivate"
              : "Yes, Reactivate"
            : "Confirm"
        }
        danger={confirm?.kind === "Deactivate"}
        busy={Boolean(confirm && updatingId === confirm.rider.userId)}
        onConfirm={applyStatus}
        onCancel={() => !updatingId && setConfirm(null)}
      />
    </>
  );
}
