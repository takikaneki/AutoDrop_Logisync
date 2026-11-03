import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { EmptyState, Modal, StatusBadge, TableSkeleton } from "../components/ui.jsx";
import { Notice, StatCard, StatGrid } from "../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, panel, td, th } from "../components/styles.js";
import { listUsers } from "../services/userService.js";
import { listParcels } from "../services/parcelService.js";
import { formatDate } from "../utils/format.js";
import { getParcelStatus } from "../utils/parcelStatus.js";

const tone = {
  Active: "bg-[#eaf8ef] text-[#29945a]",
  "On Delivery": "bg-[#fff0e7] text-[#e9651c]",
  Inactive: "bg-[#f4f6f8] text-[#7c8da0]",
};

const PAGE_SIZE = 8;

export default function Riders() {
  const [rawRiders, setRawRiders] = useState([]);
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [zone, setZone] = useState("All");
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
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
    } catch (err) {
      setError(err.message || "Failed to load riders from the database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build database-driven rider records with live parcel metrics
  const riders = useMemo(() => {
    return rawRiders.map((u) => {
      const riderCode = `R-${String(u.user_id).padStart(2, "0")}`;
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

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return riders.filter(
      (r) =>
        (status === "All" || r.status === status) &&
        (zone === "All" || r.zone === zone) &&
        (!q ||
          [r.name, r.email, r.zone, r.id, r.phone]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)))
    );
  }, [riders, status, zone, search]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const current = viewId != null ? riders.find((r) => r.userId === viewId) : null;

  return (
    <>
      <Topbar
        title="Riders"
        subtitle="Manage registered riders from the database and track their live delivery performance."
        right={
          <button type="button" onClick={loadData} className={btnGhost}>
            <i className="fa-solid fa-rotate" /> Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-5">
          <Notice tone="error" icon="fa-circle-exclamation" role="alert">
            {error}
          </Notice>
        </div>
      )}

      <StatGrid cols={3}>
        <StatCard
          label="Total riders"
          value={loading ? "…" : riders.length}
          icon="fa-motorcycle"
          tone="orange"
        />
        <StatCard
          label="Active"
          value={loading ? "…" : riders.filter((r) => r.status === "Active").length}
          icon="fa-circle-check"
          tone="green"
        />
        <StatCard
          label="On delivery"
          value={loading ? "…" : riders.filter((r) => r.status === "On Delivery").length}
          icon="fa-truck"
          tone="blue"
        />
      </StatGrid>

      <section className={`${panel} p-6`}>
        <div className="mb-5 grid grid-cols-[1fr_180px_200px] gap-3 max-[900px]:grid-cols-1">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search rider name, email, zone or ID..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select
            value={zone}
            onChange={(e) => {
              setZone(e.target.value);
              setPage(1);
            }}
            className={inputCls}
            aria-label="Filter by zone"
          >
            <option value="All">All zones</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={inputCls}
            aria-label="Filter by status"
          >
            {["All", "Active", "On Delivery"].map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
          <table className="w-full min-w-[700px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head">
              <tr>
                {["Rider", "Email / Contact", "Zone", "Vehicle", "Parcels", "Status", ""].map((h, i) => (
                  <th key={i} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton rows={5} cols={7} />
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
                    <td className={td}>{r.zone}</td>
                    <td className={td}>{r.vehicle}</td>
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
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <button
                        type="button"
                        onClick={() => setViewId(r.userId)}
                        className="text-[13px] font-semibold text-brand hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {!loading && rows.length === 0 && (
            <EmptyState
              icon="fa-motorcycle"
              title="No riders found"
              text={
                riders.length === 0
                  ? "No rider accounts have been created yet. Create a Rider account in the Accounts page."
                  : "Try a different search, zone, or status filter."
              }
            />
          )}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
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
              <i className="fa-solid fa-xmark" />
            </button>
            <div className="mb-5 flex items-center gap-4">
              <span className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-brand-soft text-[22px] text-brand">
                <i className="fa-solid fa-motorcycle" />
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

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                <i className="fa-solid fa-comment" /> Message
              </Link>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
