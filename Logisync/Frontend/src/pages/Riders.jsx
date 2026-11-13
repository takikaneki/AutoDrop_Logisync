import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { EmptyState, Modal, StatusBadge, TableSkeleton, ConfirmDialog } from "../components/ui.jsx";
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
  "On Delivery": "bg-[#fff0e7] text-[#e9651c]",
  Inactive: "bg-[#fff0f0] text-[#d94747]",
};

const TYPE_LABEL = { FM: "First Mile (FM)", LM: "Last Mile (LM)" };
const TYPE_DESC = {
  FM: "Picks up parcels from Sellers (seller pickup activities).",
  LM: "Delivers parcels to Buyers, including applicable return pickups and deliveries.",
};
const TYPE_TONE = {
  FM: "bg-[#eaf2ff] text-[#2563eb]",
  LM: "bg-[#fff0e7] text-[#e9651c]",
};

const EMPTY_FORM = {
  userId: null,
  riderCode: "",
  name: "",
  email: "",
  phone: "",
  agency: "",
  rider_type: "",
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
  const [typeFilter, setTypeFilter] = useState("All");
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

  const openEdit = (r) => {
    setForm({
      userId: r.userId,
      riderCode: r.id,
      name: r.raw?.name || "",
      email: r.raw?.email || "",
      phone: r.raw?.phone || "",
      agency: r.agency === "Unassigned" ? "" : r.agency,
      rider_type: r.riderType,
      status: r.accountActive ? "Active" : "Inactive",
      password: "",
    });
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
    if (!form.rider_type) return setFormError("Select a Rider Type: First Mile (FM) or Last Mile (LM).");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setFormError("Please enter a valid email address / login username.");
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
        const payload = { name, email, phone, agency, rider_type: form.rider_type, status: form.status };
        if (form.password) payload.password = form.password;
        const updated = await updateSeller(form.userId, payload);
        setRawRiders((prev) => prev.map((u) => (u.user_id === form.userId ? { ...u, ...updated } : u)));
        logAction({ category: "Riders", action: "Updated rider", target: name, detail: `${form.rider_type} · ${agency}` });
        toast(`${name} — rider account updated.`);
        setFormOpen(false);
      } else {
        const user = await createUser({
          role: "rider",
          name,
          email,
          phone,
          agency,
          rider_type: form.rider_type,
          password: form.password,
          status: form.status,
        });
        setRawRiders((prev) => [user, ...prev]);
        logAction({ category: "Riders", action: "Created rider", target: name, detail: user.rider_code || email });
        setFormOpen(false);
        setCreated({
          riderCode: user.rider_code,
          type: user.rider_type,
          agency: user.agency,
          email,
          password: form.password,
        });
      }
    } catch (err) {
      setFormError(err.message || "Failed to save rider account.");
    } finally {
      setSaving(false);
    }
  };

  const applyStatus = async () => {
    if (!confirm) return;
    const { rider, kind } = confirm;
    const next = kind === "Deactivate" ? "REJECTED" : "APPROVED";
    try {
      await updateUserVerification(rider.userId, next);
      setRawRiders((prev) => prev.map((u) => (u.user_id === rider.userId ? { ...u, verification_status: next } : u)));
      logAction({ category: "Riders", action: kind === "Deactivate" ? "Deactivated rider" : "Activated rider", target: rider.name, detail: rider.email });
      toast(`${rider.name} — ${kind === "Deactivate" ? "deactivated" : "activated"}.`);
    } catch (err) {
      toast(err.message || "Failed to update rider status.", "error");
    } finally {
      setConfirm(null);
    }
  };

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
        (typeFilter === "All" || r.riderType === typeFilter) &&
        (agencyFilter === "All" || r.agency === agencyFilter) &&
        (!q ||
          [r.name, r.email, r.zone, r.id, r.phone, r.agency]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)))
    );
  }, [riders, status, zone, typeFilter, agencyFilter, search]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const current = viewId != null ? riders.find((r) => r.userId === viewId) : null;

  return (
    <>
      <Topbar
        title="Riders"
        subtitle="Create, edit, activate and deactivate rider accounts. Track agency affiliation and FM / LM classification."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={loadData} className={btnGhost}>
              <i className="fa-solid fa-rotate" /> Refresh
            </button>
            <button type="button" onClick={openCreate} className={btnPrimary}>
              <i className="fa-solid fa-plus" /> Add Rider
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
          label="Total riders"
          value={loading ? "…" : riders.length}
          icon="fa-motorcycle"
          tone="orange"
        />
        <StatCard
          label="First Mile (FM)"
          value={loading ? "…" : riders.filter((r) => r.riderType === "FM").length}
          icon="fa-box-open"
          tone="blue"
        />
        <StatCard
          label="Last Mile (LM)"
          value={loading ? "…" : riders.filter((r) => r.riderType === "LM").length}
          icon="fa-truck"
          tone="green"
        />
      </StatGrid>

      <section className={`${panel} p-6 max-[600px]:p-4`}>
        <div className="mb-5 grid grid-cols-[1fr_150px_170px_150px_150px] gap-3 max-[1100px]:grid-cols-2 max-[600px]:grid-cols-1">
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
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className={inputCls}
            aria-label="Filter by rider type"
          >
            <option value="All">All types</option>
            <option value="FM">First Mile (FM)</option>
            <option value="LM">Last Mile (LM)</option>
          </select>
          <select
            value={agencyFilter}
            onChange={(e) => {
              setAgencyFilter(e.target.value);
              setPage(1);
            }}
            className={inputCls}
            aria-label="Filter by agency"
          >
            <option value="All">All agencies</option>
            {agencies.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
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
            {["All", "Active", "On Delivery", "Inactive"].map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden min-[701px]:block w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
          <table className="w-full min-w-[700px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head">
              <tr>
                {["Rider", "Email / Contact", "Agency", "Type", "Parcels", "Status", ""].map((h, i) => (
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
                    <td className={td}>{r.agency}</td>
                    <td className={td}>
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-bold ${TYPE_TONE[r.riderType]}`}>
                        {r.riderType}
                      </span>
                    </td>
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
                        className="mr-3 text-[13px] font-semibold text-brand hover:underline"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="mr-3 text-[13px] font-semibold text-[#3b82f6] hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ rider: r, kind: r.accountActive ? "Deactivate" : "Activate" })}
                        className={`text-[13px] font-semibold hover:underline ${r.accountActive ? "text-[#d94747]" : "text-[#29945a]"}`}
                      >
                        {r.accountActive ? "Deactivate" : "Activate"}
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

        {/* Mobile Card List */}
        <div className="min-[701px]:hidden space-y-3">
          {loading ? (
            <div className="py-8 text-center text-[13px] text-[#888]">Loading riders…</div>
          ) : pageRows.length === 0 ? (
            <EmptyState
              icon="fa-motorcycle"
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
                    <span className="text-[12px] text-[#888]">{r.id} · {r.agency} · {r.riderType}</span>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      tone[r.status] || tone.Active
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
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
                      onClick={() => openEdit(r)}
                      className="font-semibold text-[#3b82f6] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ rider: r, kind: r.accountActive ? "Deactivate" : "Activate" })}
                      className={`font-semibold hover:underline ${r.accountActive ? "text-[#d94747]" : "text-[#29945a]"}`}
                    >
                      {r.accountActive ? "Deactivate" : "Activate"}
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
                [
                  "Rider type",
                  `${TYPE_LABEL[current.riderType]} — ${current.riderType === "FM" ? "seller pickups" : "buyer deliveries"}`,
                ],
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
              {form.userId ? "Edit Rider Account" : "Add Rider Account"}
            </h3>
            <p className="mb-4 text-[13px] text-[#999]">
              Riders are recruited through Shopee agency partners. Prototype uses dummy rider and agency data; there is no rider self-registration.
            </p>

            <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
              <div>
                <label className="mb-1 block text-[13px] font-semibold">Rider ID</label>
                <input
                  value={form.userId ? form.riderCode : "Auto-generated (RID-0001…)"}
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

            <fieldset className="mt-4">
              <legend className="mb-1.5 text-[13px] font-semibold">Rider Type *</legend>
              <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
                {["FM", "LM"].map((t) => (
                  <label
                    key={t}
                    className={`cursor-pointer rounded-xl border p-3 text-[13px] transition ${
                      form.rider_type === t
                        ? "border-brand bg-brand-soft/60 dark:bg-night-line"
                        : "border-[#e5e7eb] hover:border-brand/60 dark:border-night-line"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="rider_type"
                        value={t}
                        checked={form.rider_type === t}
                        onChange={() => setField("rider_type", t)}
                      />
                      <strong>{TYPE_LABEL[t]}</strong>
                    </span>
                    <span className="mt-1 block text-[12px] text-[#888]">{TYPE_DESC[t]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-4">
              <label className="mb-1 block text-[13px] font-semibold" htmlFor="rf-pass">
                {form.userId ? "Reset Test Password (optional)" : "Assigned Test Password *"}
              </label>
              <div className="flex gap-2">
                <input
                  id="rf-pass"
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
                Each rider gets an individual login. Passwords are stored hashed and cannot be viewed later.
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
                {saving ? "Saving…" : form.userId ? "Save Changes" : "Create Rider"}
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
              Rider account created
            </h3>
            <p className="mb-4 text-[13px] text-[#999]">Give these test login credentials to the rider. The password will not be shown again.</p>
            <dl className="space-y-2 rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-4 text-[13.5px] dark:border-night-line dark:bg-night-head">
              <div className="flex justify-between gap-3"><dt className="text-[#999]">Rider ID</dt><dd className="font-bold">{created.riderCode}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#999]">Type</dt><dd className="font-semibold">{TYPE_LABEL[created.type]}</dd></div>
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
                <i className="fa-regular fa-copy" /> Copy
              </button>
              <button type="button" onClick={() => setCreated(null)} className={btnPrimary}>Done</button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm ? `${confirm.kind} this rider?` : ""}
        text={
          confirm
            ? confirm.kind === "Deactivate"
              ? `${confirm.rider.name} (${confirm.rider.email}) will not be able to sign in while inactive.`
              : `${confirm.rider.name} (${confirm.rider.email}) will be able to sign in again.`
            : ""
        }
        confirmLabel={confirm?.kind}
        danger={confirm?.kind === "Deactivate"}
        onConfirm={applyStatus}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
