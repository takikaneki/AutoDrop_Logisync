import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { Avatar, ConfirmDialog, EmptyState, Modal, StatusBadge, TableSkeleton } from "../components/ui.jsx";
import { Notice, StatCard, StatGrid } from "../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, panel, td, th } from "../components/styles.js";
import { listUsers, updateUserVerification } from "../services/userService.js";
import { listParcels } from "../services/parcelService.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";
import { formatDate } from "../utils/format.js";
import { getParcelStatus } from "../utils/parcelStatus.js";

const tone = {
  Active: "bg-[#eaf8ef] text-[#29945a]",
  Suspended: "bg-[#fff0f0] text-[#d94747]",
};

const AVATAR_TONES = ["orange", "blue", "green", "purple"];
const PAGE_SIZE = 8;

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

  const loadData = useCallback(async () => {
    setLoading(true);
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
    } catch (err) {
      setError(err.message || "Failed to load sellers from the database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build database-driven seller records with live parcel metrics
  const sellers = useMemo(() => {
    return rawSellers.map((u, idx) => {
      const sellerCode = `S-${String(u.user_id).padStart(2, "0")}`;
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

      const uiStatus = u.verification_status === "REJECTED" ? "Suspended" : "Active";

      return {
        userId: u.user_id,
        id: sellerCode,
        name: u.name || "Unnamed Seller",
        shop: u.shop_name || u.name || "Seller Store",
        email: u.email || "—",
        phone: u.phone || "",
        initials: getInitials(u.name),
        tone: AVATAR_TONES[idx % AVATAR_TONES.length],
        joined: formatDate(u.created_at),
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

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const current = viewId != null ? sellers.find((s) => s.userId === viewId) : null;

  const actions = {
    Suspend: [
      "REJECTED",
      "Suspended seller",
      "Suspend this seller?",
      "They will not be able to sign in or register new parcels while suspended.",
      true,
    ],
    Reactivate: [
      "APPROVED",
      "Reactivated seller",
      "Reactivate this seller?",
      "Their account will be active again.",
      false,
    ],
  };

  const actionFor = (s) => (s.status === "Suspended" ? "Reactivate" : "Suspend");

  const apply = async () => {
    if (!confirm) return;
    const { seller, kind } = confirm;
    const [nextDbStatus, auditLabel] = actions[kind];
    setUpdatingId(seller.userId);
    try {
      await updateUserVerification(seller.userId, nextDbStatus);
      setRawSellers((prev) =>
        prev.map((u) =>
          u.user_id === seller.userId ? { ...u, verification_status: nextDbStatus } : u
        )
      );
      logAction({
        category: "Sellers",
        action: auditLabel,
        target: seller.name,
        detail: seller.email,
      });
      toast(`${seller.name} — ${auditLabel.toLowerCase()}.`);
    } catch (err) {
      toast(err.message || "Failed to update seller status.", "error");
    } finally {
      setUpdatingId(null);
      setConfirm(null);
    }
  };

  return (
    <>
      <Topbar
        title="Sellers"
        subtitle="Review, suspend and reactivate registered seller accounts from the database."
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
          label="Total sellers"
          value={loading ? "…" : sellers.length}
          icon="fa-store"
          tone="orange"
        />
        <StatCard
          label="Active"
          value={loading ? "…" : sellers.filter((x) => x.status === "Active").length}
          icon="fa-circle-check"
          tone="green"
        />
        <StatCard
          label="Suspended"
          value={loading ? "…" : sellers.filter((x) => x.status === "Suspended").length}
          icon="fa-ban"
          tone="red"
        />
      </StatGrid>

      <section className={`${panel} p-6`}>
        <div className="mb-5 grid grid-cols-[1fr_200px] gap-3 max-[700px]:grid-cols-1">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search seller name, shop, email or ID..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={inputCls}
            aria-label="Filter by status"
          >
            {["All", "Active", "Suspended"].map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
          <table className="w-full min-w-[780px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head">
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
                          actionFor(s) === "Suspend" ? "text-[#d94747]" : "text-[#29945a]"
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
          {!loading && rows.length === 0 && (
            <EmptyState
              icon="fa-store"
              title="No sellers found"
              text={
                sellers.length === 0
                  ? "No seller accounts have been created yet. Create a Seller account in the Accounts page."
                  : "Try a different search or status filter."
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
        className="w-full max-w-[540px] p-7 dark:bg-night-panel"
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
              <Avatar initials={current.initials} tone={current.tone} className="h-14 w-14 text-[18px]" />
              <div>
                <h3 className="text-[18px] font-bold">{current.name}</h3>
                <p className="text-[13px] text-[#999]">
                  {current.id} · {current.email} · joined {current.joined}
                </p>
              </div>
            </div>
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-3.5 dark:border-night-line dark:bg-night-head">
                <small className="block text-[12px] text-[#999]">Total parcels</small>
                <strong className="text-[20px]">{current.counts.total}</strong>
              </div>
              <div className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-3.5 dark:border-night-line dark:bg-night-head">
                <small className="block text-[12px] text-[#999]">Verified</small>
                <strong className="text-[20px]">{current.counts.verified}</strong>
              </div>
              <div className="rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-3.5 dark:border-night-line dark:bg-night-head">
                <small className="block text-[12px] text-[#999]">Delivered</small>
                <strong className="text-[20px]">{current.counts.delivered}</strong>
              </div>
            </div>
            <h4 className="mb-2 text-[14px] font-bold">Parcel history</h4>
            {current.counts.recent.length === 0 ? (
              <p className="mb-5 text-[13px] text-[#999]">No parcels registered by this seller yet.</p>
            ) : (
              <ul className="mb-5 divide-y divide-[#f1f1f1] dark:divide-night-line">
                {current.counts.recent.map((p) => (
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

      <ConfirmDialog
        open={!!confirm}
        title={confirm ? actions[confirm.kind][2] : ""}
        text={confirm ? `${confirm.seller.name} (${confirm.seller.email}). ${actions[confirm.kind][3]}` : ""}
        confirmLabel={confirm?.kind}
        danger={confirm ? actions[confirm.kind][4] : false}
        onConfirm={apply}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
