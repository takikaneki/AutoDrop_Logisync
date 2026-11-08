import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { StatCard, StatGrid } from "../components/portal.jsx";
import Pagination from "../components/Pagination.jsx";
import ScanPanel from "../components/qr/ScanPanel.jsx";
import { EmptyState, Modal } from "../components/ui.jsx";
import { btnDanger, btnGhost, btnPrimary, inputCls, panel, td, textareaCls, th } from "../components/styles.js";
import StatusBadge from "../components/StatusBadge.jsx";
import {
  decideDiscreetHandling,
  decideParcel,
  findParcel,
  getCoordinatorParcel,
  getVideoUrl,
  listParcels,
} from "../services/parcelService.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";
import { formatDate, formatSize } from "../utils/format.js";
import { statusInfo } from "../utils/parcelStatus.js";
import { getParcelAddress } from "../store/customers.js";

const PAGE_SIZE = 8;
const FILTERS = [
  "VIDEO_SUBMITTED",
  "ALL",
  "DISCREET_PENDING",
  "FLAGGED_DECLARATION",
  "VERIFIED",
  "REUPLOAD_REQUESTED",
  "REJECTED",
  "WAITING_FOR_VIDEO",
];

function DiscreetStatusBadge({ discreteItem, discreetStatus }) {
  if (!discreteItem && (!discreetStatus || discreetStatus === "NOT_REQUESTED")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-[11px] font-semibold text-[#6b7280] dark:bg-night-head dark:text-[#b8b0a8]">
        No
      </span>
    );
  }
  const status = discreetStatus || (discreteItem ? "PENDING_REVIEW" : "NOT_REQUESTED");
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf8ef] px-2.5 py-0.5 text-[11px] font-semibold text-[#1f7f4a] dark:bg-[#29945a]/20 dark:text-[#8fd6ae]">
        <i className="fa-solid fa-user-shield text-[10px]" /> Discreet: Approved
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#fdecec] px-2.5 py-0.5 text-[11px] font-semibold text-[#c53030] dark:bg-[#d94a4a]/20 dark:text-[#f5a3a3]">
        <i className="fa-solid fa-ban text-[10px]" /> Discreet: Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4e5] px-2.5 py-0.5 text-[11px] font-semibold text-[#b45309] dark:bg-[#c97c10]/20 dark:text-[#f2c278]">
      <i className="fa-solid fa-clock text-[10px]" /> Discreet: Pending Review
    </span>
  );
}

export default function Verification() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const urlStatus = params.get("status");
  const initialFilter = FILTERS.includes(urlStatus) ? urlStatus : "VIDEO_SUBMITTED";

  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [scanOpen, setScanOpen] = useState(params.get("scan") === "1");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [videoId, setVideoId] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const urlRef = useRef("");

  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState("");
  const [deciding, setDeciding] = useState(false);

  const [discreetRemarks, setDiscreetRemarks] = useState("");
  const [discreetBusy, setDiscreetBusy] = useState(false);

  useEffect(() => setFilter(initialFilter), [initialFilter]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    listParcels()
      .then(setParcels)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const count = (s) => parcels.filter((p) => p.status === s).length;
  const discreetPendingCount = parcels.filter(
    (p) => Boolean(p.discrete_item) && (p.discreet_status || "PENDING_REVIEW") === "PENDING_REVIEW"
  ).length;
  const flaggedCount = parcels.filter((p) => Boolean(p.declaration_flagged)).length;

  const summary = [
    { label: "Under verification", value: count("VIDEO_SUBMITTED"), icon: "fa-hourglass-half", tone: "blue" },
    { label: "Discreet requests pending", value: discreetPendingCount, icon: "fa-user-shield", tone: "orange" },
    { label: "Verified", value: count("VERIFIED"), icon: "fa-check", tone: "green" },
    { label: "Flagged / Rejected", value: flaggedCount + count("REJECTED"), icon: "fa-triangle-exclamation", tone: "red" },
  ];

  const filterLabel = (f) => {
    if (f === "ALL") return "All statuses";
    if (f === "DISCREET_PENDING") return "Discreet Request Pending";
    if (f === "FLAGGED_DECLARATION") return "Flagged Declarations";
    return statusInfo(f).label;
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parcels.filter((p) => {
      const matchesFilter =
        filter === "ALL"
          ? true
          : filter === "DISCREET_PENDING"
          ? Boolean(p.discrete_item) && (p.discreet_status || "PENDING_REVIEW") === "PENDING_REVIEW"
          : filter === "FLAGGED_DECLARATION"
          ? Boolean(p.declaration_flagged)
          : p.status === filter;

      if (!matchesFilter) return false;
      if (!q) return true;
      return [
        p.parcel_id,
        p.transaction_number,
        p.seller_name,
        p.receiver_name,
        p.content_category,
        p.contents,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [parcels, filter, search]);

  useEffect(() => setPage(1), [filter, search]);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const releaseVideo = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
    setVideoUrl("");
  };

  const playVideo = async (id) => {
    releaseVideo();
    setVideoId(id);
    setVideoError("");
    setVideoLoading(true);
    try {
      const url = await getVideoUrl(id);
      urlRef.current = url;
      setVideoUrl(url);
    } catch (e) {
      setVideoError(e.message);
    } finally {
      setVideoLoading(false);
    }
  };
  useEffect(() => releaseVideo, []);

  const applyDetail = (data) => {
    setDetail(data);
    setRemarks("");
    setRemarksError("");
    setDiscreetRemarks(data?.parcel?.discreet_review_remarks || "");
    const latest = data.videos?.[0];
    if (latest) playVideo(latest.video_id);
    else {
      releaseVideo();
      setVideoId(null);
    }
  };

  const openParcel = async (loader) => {
    setOpen(true);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    releaseVideo();
    setVideoId(null);
    try {
      applyDetail(await loader());
    } catch (e) {
      setDetailError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const review = (p) => openParcel(() => getCoordinatorParcel(p.parcel_id));

  const onScanValue = async (value) => {
    setLooking(true);
    setLookupError("");
    try {
      const data = await findParcel(value, "coordinator");
      setScanOpen(false);
      setOpen(true);
      setDetailError("");
      applyDetail(data);
    } catch (e) {
      setLookupError(e.message);
    } finally {
      setLooking(false);
    }
  };

  const close = () => {
    setOpen(false);
    releaseVideo();
  };

  const handleDiscreetDecision = async (decision) => {
    if (!detail?.parcel) return;
    const id = detail.parcel.parcel_id;
    if (decision === "REJECT" && !discreetRemarks.trim()) {
      toast("Please provide a short note explaining why the discreet request is rejected.", "error");
      return;
    }
    setDiscreetBusy(true);
    try {
      await decideDiscreetHandling(id, decision, discreetRemarks.trim());
      logAction({
        category: "Discreet Verification",
        action: decision === "APPROVE" ? "Approved discreet handling" : "Rejected discreet handling",
        target: id,
        detail: discreetRemarks.trim(),
      });
      toast(
        decision === "APPROVE"
          ? `Discreet handling approved for ${id}`
          : `Discreet handling rejected for ${id}`
      );
      applyDetail(await getCoordinatorParcel(id));
      load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setDiscreetBusy(false);
    }
  };

  const decide = async (action, label) => {
    const needsRemarks = action !== "verify";
    if (needsRemarks && !remarks.trim()) return setRemarksError("Please write remarks so the seller knows why.");
    setDeciding(true);
    try {
      const id = detail.parcel.parcel_id;
      await decideParcel(id, action, remarks.trim());
      logAction({ category: "Verification", action: label, target: id, detail: remarks.trim() });
      toast(`${label}: ${id}`);
      applyDetail(await getCoordinatorParcel(id));
      load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setDeciding(false);
    }
  };

  const p = detail?.parcel;
  const canDecide = p?.status === "VIDEO_SUBMITTED" && detail?.videos?.length > 0;
  const categoryDisplay = p?.content_category
    ? p.content_category === "Other" && p.other_category_description
      ? `Other — ${p.other_category_description}`
      : p.content_category
    : "Unspecified";

  return (
    <>
      <Topbar title="Verification" subtitle="Review seller content declarations, discreet handling requests, and video proofs.">
        <button className={btnGhost} onClick={load}><i className="fa-solid fa-rotate" /> Refresh</button>
        <button className={btnPrimary} onClick={() => { setScanOpen((v) => !v); setLookupError(""); }}>
          <i className="fa-solid fa-qrcode" /> {scanOpen ? "Close scanner" : "Scan parcel QR"}
        </button>
      </Topbar>

      {scanOpen && (
        <section className={`${panel} p-6 max-[600px]:p-4 mb-6`}>
          <ScanPanel onValue={onScanValue} busy={looking} btnClass="bg-brand hover:bg-brand-dark" inputClass="focus:ring-brand/20" />
          {lookupError && <p role="alert" className="mt-4 rounded-lg bg-[#fff1f1] px-4 py-3 text-sm text-[#d94a4a]">{lookupError}</p>}
        </section>
      )}

      <StatGrid>
        <button
          type="button"
          onClick={() => setFilter("VIDEO_SUBMITTED")}
          className="text-left w-full h-full cursor-pointer focus:outline-none"
        >
          <StatCard
            label="Under verification"
            value={loading ? "…" : count("VIDEO_SUBMITTED")}
            icon="fa-hourglass-half"
            tone="blue"
          />
        </button>
        <button
          type="button"
          onClick={() => setFilter("DISCREET_PENDING")}
          className="text-left w-full h-full cursor-pointer focus:outline-none"
        >
          <StatCard
            label="Discreet requests pending"
            value={loading ? "…" : discreetPendingCount}
            icon="fa-user-shield"
            tone="orange"
          />
        </button>
        <button
          type="button"
          onClick={() => setFilter("VERIFIED")}
          className="text-left w-full h-full cursor-pointer focus:outline-none"
        >
          <StatCard
            label="Verified"
            value={loading ? "…" : count("VERIFIED")}
            icon="fa-check"
            tone="green"
          />
        </button>
        <button
          type="button"
          onClick={() => setFilter("FLAGGED_DECLARATION")}
          className="text-left w-full h-full cursor-pointer focus:outline-none"
        >
          <StatCard
            label="Flagged / Rejected"
            value={loading ? "…" : flaggedCount + count("REJECTED")}
            icon="fa-triangle-exclamation"
            tone="red"
          />
        </button>
      </StatGrid>

      <section className={`${panel} p-6 max-[600px]:p-4`}>
        <div className="mb-4 grid grid-cols-[1fr_240px] gap-3 max-[640px]:grid-cols-1">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parcel ID, transaction no., seller, receiver, category..." aria-label="Search" className={`${inputCls} pl-9`} />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Status filter" className={inputCls}>
            {FILTERS.map((f) => <option key={f} value={f}>{filterLabel(f)}</option>)}
          </select>
        </div>

        {error && <p role="alert" className="mb-4 rounded-lg bg-[#fff1f1] px-4 py-3 text-sm text-[#d94a4a]">{error} <button onClick={load} className="font-semibold underline">Try again</button></p>}

        {/* Desktop & Tablet Table */}
        <div className="hidden min-[701px]:block overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head">
              <tr>
                {[
                  "Parcel ID",
                  "Transaction no.",
                  "Seller",
                  "Declared Category",
                  "Discreet Request",
                  "Status",
                  "Updated",
                  "",
                ].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className={`${td} text-center text-[#999]`}>Loading…</td></tr>}
              {!loading && visible.map((r) => (
                <tr key={r.parcel_id} className="hover:bg-[#fffaf7] dark:hover:bg-night-head">
                  <td className={`${td} font-mono text-[13px]`}>
                    <div>{r.parcel_id}</div>
                    {r.declaration_flagged && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#fff1f1] px-2 py-0.5 font-sans text-[10.5px] font-bold text-[#d94a4a] dark:bg-[#d94a4a]/20 dark:text-[#f5a3a3]">
                        <i className="fa-solid fa-triangle-exclamation text-[9px]" /> Flagged Declaration
                      </span>
                    )}
                  </td>
                  <td className={td}>{r.transaction_number || "—"}</td>
                  <td className={td}>
                    <strong className="block text-[13.5px] text-[#333] dark:text-[#f1eeeb]">{r.seller_name}</strong>
                    <span className="block text-[12px] text-[#888]">To: {r.receiver_name}</span>
                  </td>
                  <td className={td}>
                    <span className="block text-[13px] font-semibold text-[#27364f] dark:text-[#f1eeeb]">
                      {r.content_category || "Unspecified"}
                    </span>
                    <span className="block max-w-[190px] truncate text-[12px] text-[#888]">
                      {r.contents || "—"}
                    </span>
                  </td>
                  <td className={td}>
                    <DiscreetStatusBadge
                      discreteItem={r.discrete_item}
                      discreetStatus={r.discreet_status}
                    />
                  </td>
                  <td className={td}><StatusBadge status={r.status} /></td>
                  <td className={`${td} whitespace-nowrap text-[#999]`}>{formatDate(r.updated_at)}</td>
                  <td className={`${td} text-right`}><button className={btnGhost} onClick={() => review(r)}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="min-[701px]:hidden space-y-3">
          {loading && <p className="py-10 text-center text-[14px] text-[#999]">Loading…</p>}
          {!loading && visible.map((r) => (
            <article key={r.parcel_id} className="rounded-xl border border-[#eee] bg-[#fcfcfd] p-4 dark:border-night-line dark:bg-night-head">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="block font-mono text-[11px] text-[#999]">{r.parcel_id}</span>
                  <strong className="text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                    #{r.transaction_number || r.parcel_id}
                  </strong>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <DiscreetStatusBadge
                  discreteItem={r.discrete_item}
                  discreetStatus={r.discreet_status}
                />
                {r.declaration_flagged && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1f1] px-2.5 py-0.5 text-[11px] font-bold text-[#d94a4a]">
                    <i className="fa-solid fa-triangle-exclamation text-[10px]" /> Flagged Declaration
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1 text-[13px] text-[#555] dark:text-[#d1c9c2]">
                <p>Seller: <strong className="text-[#333] dark:text-[#f1eeeb]">{r.seller_name}</strong></p>
                <p>Receiver: <strong className="text-[#333] dark:text-[#f1eeeb]">{r.receiver_name}</strong></p>
                <p>Category: <strong className="text-[#333] dark:text-[#f1eeeb]">{r.content_category || "Unspecified"}</strong> ({r.contents || "—"})</p>
              </div>
              <div className="mt-3.5 flex items-center justify-between border-t border-[#eee] pt-3 text-[12px] dark:border-night-line">
                <span className="text-[#999]">{formatDate(r.updated_at)}</span>
                <button onClick={() => review(r)} className="rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-bold text-white">
                  Review
                </button>
              </div>
            </article>
          ))}
        </div>

        {!loading && rows.length === 0 && (
          <EmptyState icon="fa-clipboard-check" title={parcels.length ? "No parcels match your filters" : "No parcels yet"} text={filter === "VIDEO_SUBMITTED" ? "Nothing is waiting for verification." : ""} />
        )}
        {!loading && rows.length > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />}
      </section>

      {/* WORKSPACE */}
      <Modal open={open} onClose={close} className="w-full max-w-[900px] max-h-[92vh] overflow-y-auto p-7 max-[600px]:p-5 dark:bg-night-panel">
        <button onClick={close} aria-label="Close" className="absolute top-[15px] right-[17px] w-8 h-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] text-[21px] leading-none dark:bg-night-head">×</button>

        {detailLoading && <p className="py-16 text-center text-[#999]">Loading parcel…</p>}
        {detailError && <p role="alert" className="py-10 text-center text-[#d94a4a]">{detailError}</p>}

        {p && (
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-3 pr-10">
              <h2 className="text-[20px] font-bold font-mono">{p.parcel_id}</h2>
              <StatusBadge status={p.status} />
              <DiscreetStatusBadge
                discreteItem={p.discrete_item}
                discreetStatus={p.discreet_status}
              />
            </div>

            {p.declaration_flagged && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-[#f5bcbc] bg-[#fff5f5] p-4 text-[13px] text-[#9b2c2c] dark:border-[#d94a4a]/40 dark:bg-[#d94a4a]/10 dark:text-[#f5a3a3]"
              >
                <strong className="flex items-center gap-2 text-[14px] font-bold">
                  <i className="fa-solid fa-triangle-exclamation text-[#d94a4a]" />
                  Flagged Declaration — Requires Careful Coordinator Inspection
                </strong>
                <p className="mt-1 leading-relaxed">
                  {p.declaration_flag_reason ||
                    "This parcel declaration was flagged for potential inconsistency or non-standard discreet handling. Verify the packing video carefully before approving."}
                </p>
              </div>
            )}

            <dl className="mb-5 grid grid-cols-2 gap-4 text-[14px] max-[600px]:grid-cols-1">
              {[
                ["Transaction number", p.transaction_number],
                ["Seller", `${p.seller_name} (${p.seller_email})`],
                ["Receiver", p.receiver_name],
                ["Receiver address", getParcelAddress(p)],
                ["Receiver contact", p.receiver_contact],
                ["Created", formatDate(p.created_at)],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-[12px] uppercase text-[#999]">{k}</dt><dd className="break-words font-medium">{v || "—"}</dd></div>
              ))}
            </dl>

            {/* Declared Content Category & Discreet Handling Verification Card */}
            <div className="mb-6 rounded-xl border border-[#eadfd8] bg-[#fffaf7] p-4 dark:border-night-line dark:bg-night-head">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#eadfd8] pb-2.5 dark:border-night-line">
                <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                  <i className="fa-solid fa-clipboard-check text-brand" />
                  Content Declaration &amp; Discreet Handling Review
                </h3>
                <DiscreetStatusBadge
                  discreteItem={p.discrete_item}
                  discreetStatus={p.discreet_status}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-[13.5px] max-[600px]:grid-cols-1">
                <div>
                  <span className="block text-[11.5px] font-semibold uppercase text-[#888]">
                    Declared Item Category
                  </span>
                  <strong className="mt-0.5 block text-[#27364f] dark:text-[#f1eeeb]">
                    {categoryDisplay}
                  </strong>
                </div>
                <div>
                  <span className="block text-[11.5px] font-semibold uppercase text-[#888]">
                    Item Description / Contents
                  </span>
                  <strong className="mt-0.5 block text-[#27364f] dark:text-[#f1eeeb]">
                    {p.contents || "—"}
                  </strong>
                </div>
                <div>
                  <span className="block text-[11.5px] font-semibold uppercase text-[#888]">
                    Discreet Handling Requested
                  </span>
                  <strong className="mt-0.5 block text-[#27364f] dark:text-[#f1eeeb]">
                    {p.discrete_item ? "Yes" : "No"}
                  </strong>
                </div>
                <div>
                  <span className="block text-[11.5px] font-semibold uppercase text-[#888]">
                    Parcel Verification Status
                  </span>
                  <strong className="mt-0.5 block text-[#27364f] dark:text-[#f1eeeb]">
                    {statusInfo(p.status).label}
                  </strong>
                </div>
                {p.discrete_item && (
                  <div className="col-span-2 max-[600px]:col-span-1">
                    <span className="block text-[11.5px] font-semibold uppercase text-[#888]">
                      Seller&apos;s Explanation for Discreet Handling
                    </span>
                    <p className="mt-1 rounded-lg border border-[#e7dcd4] bg-white p-3 text-[13px] text-[#333] dark:border-night-line dark:bg-night-panel dark:text-[#f1eeeb]">
                      {p.discreet_reason || "No explanation provided by seller."}
                    </p>
                  </div>
                )}
              </div>

              {p.discrete_item && (
                <div className="mt-4 border-t border-[#eadfd8] pt-3.5 dark:border-night-line">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="discreet-remarks" className="text-[12.5px] font-semibold text-[#555] dark:text-[#d1c9c2]">
                      Discreet Handling Review Note{" "}
                      <span className="font-normal text-[#888]">(required if rejecting discreet handling)</span>
                    </label>
                    {p.discreet_reviewed_at && (
                      <span className="text-[11.5px] text-[#888]">
                        Last reviewed {formatDate(p.discreet_reviewed_at)}
                        {p.discreet_reviewer_name ? ` by ${p.discreet_reviewer_name}` : ""}
                      </span>
                    )}
                  </div>
                  <input
                    id="discreet-remarks"
                    type="text"
                    value={discreetRemarks}
                    onChange={(e) => setDiscreetRemarks(e.target.value)}
                    placeholder="e.g. Verified personal care item in video; discreet label approved."
                    className={`${inputCls} mb-3 bg-white dark:bg-night-panel`}
                  />
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={discreetBusy}
                      onClick={() => handleDiscreetDecision("APPROVE")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#29945a] px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#217a49] disabled:opacity-50"
                    >
                      <i className="fa-solid fa-user-check" /> Approve Discreet Request
                    </button>
                    <button
                      type="button"
                      disabled={discreetBusy}
                      onClick={() => handleDiscreetDecision("REJECT")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#d94747] px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#b83737] disabled:opacity-50"
                    >
                      <i className="fa-solid fa-ban" /> Reject Discreet Request
                    </button>
                    <span className="text-[11.5px] text-[#777]">
                      Approving discreet handling does not automatically verify the parcel. You must still verify the packing video below.
                    </span>
                  </div>
                </div>
              )}
            </div>

            <h3 className="mb-2 text-[15px] font-bold">Video proof</h3>
            {detail.videos.length === 0 ? (
              <p className="mb-5 rounded-lg bg-[#f7f7f7] p-4 text-[14px] text-[#888] dark:bg-night-head">The seller has not uploaded a video yet.</p>
            ) : (
              <div className="mb-5">
                <div className="mb-2 flex flex-wrap gap-2">
                  {detail.videos.map((v, i) => (
                    <button key={v.video_id} onClick={() => playVideo(v.video_id)} className={`${videoId === v.video_id ? "border-brand text-brand" : "border-[#e5e5e5] text-[#777]"} rounded-lg border px-3 py-1.5 text-[13px]`}>
                      {i === 0 ? "Latest" : `Older #${detail.videos.length - i}`} · {formatDate(v.uploaded_at)}
                    </button>
                  ))}
                </div>
                {videoLoading && <p className="py-10 text-center text-[14px] text-[#999]">Loading video…</p>}
                {videoError && <p role="alert" className="rounded-lg bg-[#fff1f1] px-4 py-3 text-[14px] text-[#d94a4a]">{videoError}</p>}
                {videoUrl && <video key={videoUrl} src={videoUrl} controls className="max-h-[360px] w-full rounded-xl bg-black" />}
                {videoId && (() => { const v = detail.videos.find((x) => x.video_id === videoId); return v ? <p className="mt-1 text-[12px] text-[#999]">{v.file_name} · {formatSize(v.file_size)}</p> : null; })()}
              </div>
            )}

            {detail.declaration_history?.length > 0 && (
              <div className="mb-5">
                <h3 className="mb-2 text-[15px] font-bold">Declaration &amp; Discreet Audit History</h3>
                <ul className="space-y-2 text-[12.5px]">
                  {detail.declaration_history.map((h) => (
                    <li key={h.log_id} className="rounded-lg bg-[#f7f7f7] p-3 dark:bg-night-head">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{h.action}</strong>
                        <span className="text-[#888]">
                          {h.actor_name} ({h.actor_role}) · {formatDate(h.created_at)}
                        </span>
                      </div>
                      {h.detail && <p className="mt-1 text-[#666] dark:text-[#d1c9c2]">{h.detail}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.verification_records.length > 0 && (
              <div className="mb-5">
                <h3 className="mb-2 text-[15px] font-bold">Decision history</h3>
                <ul className="space-y-2 text-[13px]">
                  {detail.verification_records.map((r) => (
                    <li key={r.verification_id} className="rounded-lg bg-[#f7f7f7] p-3 dark:bg-night-head">
                      <strong>{r.decision.replace("_", " ")}</strong> by {r.coordinator_name} · {formatDate(r.verified_at)}
                      {r.remarks && <p className="mt-1 whitespace-pre-wrap text-[#777]">{r.remarks}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canDecide ? (
              <div>
                <label htmlFor="remarks" className="mb-1.5 block text-[13px] font-semibold">Remarks <span className="font-normal text-[#999]">(required for reject or reupload)</span></label>
                <textarea id="remarks" rows={3} value={remarks} onChange={(e) => { setRemarks(e.target.value); setRemarksError(""); }} className={textareaCls} placeholder="e.g. The video is too dark. Please record the sealing again." />
                {remarksError && <p role="alert" className="mt-1 text-[13px] text-[#d94a4a]">{remarksError}</p>}
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <button disabled={deciding} className={btnPrimary} onClick={() => decide("verify", "Verified parcel")}><i className="fa-solid fa-check" /> Verify Parcel</button>
                  <button disabled={deciding} className={btnGhost} onClick={() => decide("request-reupload", "Requested reupload")}><i className="fa-solid fa-rotate-left" /> Request reupload</button>
                  <button disabled={deciding} className={btnDanger} onClick={() => decide("reject", "Rejected parcel")}><i className="fa-solid fa-ban" /> Reject Parcel</button>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-[#f7f7f7] p-3 text-[13px] text-[#888] dark:bg-night-head">
                {p.status === "VIDEO_SUBMITTED" ? "No video to review." : `No decision needed. Current status: ${statusInfo(p.status).label}.`}
              </p>
            )}

            <div className="mt-5 text-right">
              <Link to={`/messages?contact=${p.seller_id}`} onClick={close} className="text-[14px] text-brand hover:underline"><i className="fa-regular fa-message mr-1" />Message seller</Link>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
