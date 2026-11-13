import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { Avatar, ConfirmDialog, EmptyState, Modal, StatusBadge, TableSkeleton } from "../components/ui.jsx";
import { Notice, StatCard, StatGrid } from "../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, panel, td, th } from "../components/styles.js";
import { createUser, listUsers, updateSeller, updateUserVerification } from "../services/userService.js";
import { listParcels } from "../services/parcelService.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";
import { formatDate } from "../utils/format.js";
import { getParcelStatus } from "../utils/parcelStatus.js";

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

  const openEdit = (s) => {
    setForm({
      userId: s.userId,
      sellerCode: s.id,
      name: s.raw?.name || "",
      shop_name: s.raw?.shop_name || "",
      email: s.raw?.email || "",
      phone: s.raw?.phone || "",
      pickup_address: s.raw?.pickup_address || "",
      status: s.status,
      password: "",
    });
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
    if (!form.userId && form.password.length < 8) {
      return setFormError("Assign a test password of at least 8 characters.");
    }
    if (form.userId && form.password && form.password.length < 8) {
      return setFormError("The new password must be at least 8 characters.");
    }

    setSaving(true);
    try {
      if (form.userId) {
        const payload = { name, shop_name: shop, email, phone, pickup_address: pickup, status: form.status };
        if (form.password) payload.password = form.password;
        const updated = await updateSeller(form.userId, payload);
        setRawSellers((prev) => prev.map((u) => (u.user_id === form.userId ? { ...u, ...updated } : u)));
        logAction({ category: "Sellers", action: "Updated seller", target: name, detail: email });
        toast(`${name} — seller account updated.`);
        setFormOpen(false);
      } else {
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
      }
    } catch (err) {
      setFormError(err.message || "Failed to save seller account.");
    } finally {
      setSaving(false);
    }
  };

  const actions = {
    Deactivate: [
      "REJECTED",
      "Deactivated seller",
      "Deactivate this seller?",
      "They will not be able to sign in or register new parcels while inactive.",
      true,
    ],
    Activate: [
      "APPROVED",
      "Activated seller",
      "Activate this seller?",
      "Their account will be active again.",
      false,
    ],
  };

  const actionFor = (s) => (s.status === "Inactive" ? "Activate" : "Deactivate");

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
        subtitle="Create, edit, activate and deactivate seller accounts."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled
              title="Coming soon: bulk import of sellers via CSV or Excel (planned for deployment)."
              className={`${btnGhost} cursor-not-allowed opacity-60`}
            >
              <i className="fa-solid fa-file-import" /> Import Sellers
              <span className="ml-1 rounded-full bg-[#f1f1f1] px-2 py-0.5 text-[10px] font-bold text-[#777]">Coming soon</span>
            </button>
            <button type="button" onClick={loadData} className={btnGhost}>
              <i className="fa-solid fa-rotate" /> Refresh
            </button>
            <button type="button" onClick={openCreate} className={btnPrimary}>
              <i className="fa-solid fa-plus" /> Add Seller
            </button>
          </div>
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
          label="Inactive"
          value={loading ? "…" : sellers.filter((x) => x.status === "Inactive").length}
          icon="fa-ban"
          tone="red"
        />
      </StatGrid>

      <section className={`${panel} p-6 max-[600px]:p-4`}>
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
            {["All", "Active", "Inactive"].map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden min-[701px]:block w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
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
                        onClick={() => openEdit(s)}
                        className="mr-3 text-[13px] font-semibold text-[#3b82f6] hover:underline"
                      >
                        Edit
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

        {/* Mobile Card List */}
        <div className="min-[701px]:hidden space-y-3">
          {loading ? (
            <div className="py-8 text-center text-[13px] text-[#888]">Loading sellers…</div>
          ) : pageRows.length === 0 ? (
            <EmptyState
              icon="fa-store"
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
                      onClick={() => openEdit(s)}
                      className="font-semibold text-[#3b82f6] hover:underline"
                    >
                      Edit
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
                {(current.shop || current.phone || current.pickup) && (
                  <p className="mt-1 text-[12.5px] text-[#777] dark:text-[#d1c9c2]">
                    {current.shop}
                    {current.phone ? ` · ${current.phone}` : ""}
                    {current.pickup ? ` · Pickup: ${current.pickup}` : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="mb-5 grid grid-cols-3 gap-3 max-[520px]:grid-cols-1">
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
              <i className="fa-solid fa-xmark" />
            </button>
            <h3 className="mb-1 pr-8 text-[18px] font-bold">
              {form.userId ? "Edit Seller Account" : "Add Seller Account"}
            </h3>
            <p className="mb-4 text-[13px] text-[#999]">
              Prototype account using developer-created test data. No real Shopee/SPX records or Gmail accounts are needed.
            </p>

            <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
              <div>
                <label className="mb-1 block text-[13px] font-semibold">Seller ID</label>
                <input
                  value={form.userId ? form.sellerCode : "Auto-generated (SEL-0001…)"}
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
                {form.userId ? "Reset Test Password (optional)" : "Assigned Test Password *"}
              </label>
              <div className="flex gap-2">
                <input
                  id="sf-pass"
                  type="text"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  className={`${inputCls} font-mono`}
                  placeholder={form.userId ? "Leave blank to keep current password" : "At least 8 characters"}
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
                <Notice tone="error" icon="fa-circle-exclamation" role="alert">{formError}</Notice>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={saving} className={btnPrimary}>
                {saving ? "Saving…" : form.userId ? "Save Changes" : "Create Seller"}
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
              <i className="fa-solid fa-circle-check mr-2 text-[#29945a]" />
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
                <i className="fa-regular fa-copy" /> Copy
              </button>
              <button type="button" onClick={() => setCreated(null)} className={btnPrimary}>Done</button>
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
