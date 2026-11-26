import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import DeliveryTabs from "../../components/rider/DeliveryTabs.jsx";
import FailureReasonSelect from "../../components/rider/FailureReasonSelect.jsx";
import { EmptyState, Modal, CodBadge } from "../../components/ui.jsx";
import { Notice } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, textareaCls } from "../../components/styles.js";
import { reportIncident, riderRescheduleParcel, riderRequestRth } from "../../services/parcelService.js";
import {
  MAX_RESCHEDULES,
  STAGE,
  addDaysIso,
  applyServerFailureResult,
  filterDeliveriesByStage,
  getAttemptOrdinalLabel,
  isImmediateRthReason,
  isPriorityReattempt,
  markDelivered,
  markFailed,
  reattempt,
  syncRiderDeliveriesWithServer,
  todayIso,
  useMyDeliveries,
  useRiderDeliverySyncState,
} from "../../store/riderDeliveries.js";
import { useNetworkStatus } from "../../utils/network.js";
import {
  CachedDataNotice,
  OfflineState,
  ParcelCardListSkeleton,
} from "../../components/Skeletons.jsx";
import { compressImage } from "../../utils/image.js";
import {
  formatDate,
  formatDay,
  formatDeliveryDayLabel,
  formatShortDay,
  getManilaDateKey,
  parseValidTimestamp,
} from "../../utils/format.js";
import { latestFor, reportFailure, useFailedDeliveries, withdrawFailure } from "../../store/failedDeliveries.js";
import { toast } from "../../store/toast.js";
import Icon from "../../components/Icon.jsx";
import { FilterSelect, SearchFilterBar, SearchInput } from "../../components/SearchFilterBar.jsx";
import Pagination from "../../components/Pagination.jsx";

const PAGE_SIZE = 10;

const COPY = {
  [STAGE.TO_DELIVER]: {
    title: "To Be Delivered",
    subtitle:
      "Active parcels ready for delivery. Select Delivered or Failed Delivery to record the outcome.",
    icon: "truck",
    empty: "Nothing to deliver",
    emptyText: "Scan a parcel's QR code and it will appear here.",
  },
  [STAGE.DELIVERED]: {
    title: "Delivered",
    subtitle: "Your delivery history, with proof of delivery.",
    icon: "package-check",
    empty: "No delivered parcels yet",
    emptyText: "Completed deliveries will be listed here.",
  },
  [STAGE.RESCHEDULED]: {
    title: "Rescheduled",
    subtitle:
      "Parcels automatically rescheduled for next-day delivery (maximum of 2 reschedule attempts).",
    icon: "calendar-days",
    empty: "No rescheduled parcels",
    emptyText: "Parcels rescheduled due to recipient unavailability will appear here.",
  },
  [STAGE.FAILED]: {
    title: "Failed & Return to Hub",
    subtitle: "Parcels marked for Return to Hub after 2 reschedule attempts or immediate return reasons.",
    icon: "undo-2",
    empty: "No failed or Return to Hub parcels",
    emptyText: "Parcels marked for Return to Hub will appear here.",
  },
};

function areaOf(address) {
  const parts = String(address || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return "No address";
  return parts.find((p) => /^(brgy|barangay)\b/i.test(p)) || (parts.length > 1 ? parts[parts.length - 1] : "Other");
}

function getDeliveryTimestamp(d) {
  return (
    parseValidTimestamp(d?.doneAt) ||
    parseValidTimestamp(d?.delivered_at) ||
    parseValidTimestamp(d?.deliveredAt) ||
    parseValidTimestamp(d?.returnToHubAt) ||
    parseValidTimestamp(d?.return_to_hub_at) ||
    parseValidTimestamp(d?.updated_at) ||
    parseValidTimestamp(d?.updatedAt) ||
    parseValidTimestamp(d?.attempts?.[d?.attempts?.length - 1]?.failedAt) ||
    parseValidTimestamp(d?.scannedAt) ||
    parseValidTimestamp(d?.scanned_at) ||
    parseValidTimestamp(d?.created_at) ||
    parseValidTimestamp(d?.createdAt) ||
    Date.now()
  );
}

const card =
  "rounded-xl border border-[#e5e8ee] bg-white p-3.5 dark:border-night-line dark:bg-night-panel max-[420px]:p-3";
const bigBtn = "!py-2 !px-2.5 !text-[12.5px] w-full whitespace-nowrap";

function hasValue(val) {
  if (val === null || val === undefined) return false;
  const s = String(val).trim();
  return Boolean(
    s &&
      s !== "-" &&
      s !== "—" &&
      s !== "–" &&
      s.toLowerCase() !== "n/a" &&
      s.toLowerCase() !== "null" &&
      s.toLowerCase() !== "undefined"
  );
}

function cleanText(val) {
  return hasValue(val) ? String(val).trim() : "";
}

// Pinagsamang ulo ng card: receiver (clickable sa mobile at desktop para mag-expand/collapse), address, at detalye
function CardHead({ d, badge, expanded = false, onToggle, copiedId, onCopyAddress }) {
  const cardKey = d.parcel_id || d.transaction_number;
  const receiver = cleanText(d.receiver || d.receiver_name) || "Receiver";
  const contact = cleanText(d.contact || d.receiver_contact);
  const address = cleanText(d.address || d.receiver_address);
  const txn = cleanText(d.transaction_number || d.parcel_id);
  const isCopied = copiedId === cardKey;

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="group flex min-w-0 flex-1 items-center gap-1.5 text-left focus:outline-none"
        >
          <h3 className="min-w-0 break-words text-[15px] font-bold leading-snug text-[#27364f] transition-colors group-hover:text-brand dark:text-[#f1eeeb] inline-flex items-center gap-1.5 flex-wrap">
            <span>{receiver}</span>
            {(d.is_cod || d.payment_method === "COD" || d.paymentMethod === "COD") && <CodBadge />}
          </h3>
          <span
            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f4f6f9] text-[10px] text-[#64748b] transition-transform duration-200 group-hover:bg-brand-soft group-hover:text-brand dark:bg-night-line dark:text-[#d1c9c2] ${
              expanded ? "rotate-180 bg-brand-soft text-brand" : ""
            }`}
            aria-hidden="true"
          >
            <Icon name="chevron-down" />
          </span>
        </button>
        {badge}
      </div>

      {/* Default collapsed view: display receiver's complete address directly below receiver's name */}
      {!expanded && (
        <p className="mt-1 break-words text-[12.5px] leading-snug text-[#52627a] dark:text-[#d1c9c2]">
          {address || "No delivery address provided"}
        </p>
      )}

      {/* Expanded view: show ONLY Transaction Number, Receiver Contact Number, and Complete Address with Copy Address button */}
      {expanded && (
        <div className="mt-2.5 space-y-2.5 border-t border-[#f0f2f6] pt-2.5 dark:border-night-line">
          <div>
            <span className="block text-[12px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
              Transaction Number
            </span>
            <p className="mt-0.5 break-words text-[13px] text-[#52627a] dark:text-[#d1c9c2]">
              {txn || "—"}
            </p>
          </div>

          <div>
            <span className="block text-[12px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
              Contact Number
            </span>
            {contact ? (
              <a
                href={`tel:${contact}`}
                className="mt-0.5 inline-block text-[13px] font-medium text-[#52627a] hover:text-brand hover:underline dark:text-[#d1c9c2]"
              >
                {contact}
              </a>
            ) : (
              <p className="mt-0.5 text-[13px] text-[#94a3b8]">No contact number provided</p>
            )}
          </div>

          <div>
            <span className="block text-[12px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
              Address
            </span>
            <p className="mt-0.5 break-words text-[13px] leading-snug text-[#52627a] dark:text-[#d1c9c2]">
              {address || "No delivery address provided"}
            </p>
            {address && (
              <div className="mt-2.5 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => onCopyAddress?.(cardKey, address)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1 text-[12px] font-semibold text-[#2563eb] transition hover:bg-[#dbeafe] dark:border-[#1e3a8a] dark:bg-[#172554] dark:text-[#60a5fa]"
                >
                  <Icon name={isCopied ? "check" : "copy"} />
                  {isCopied ? "Copied!" : "Copy Address"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Compact history ng delivery attempts
function AttemptHistory({ attempts = [], rescheduleCount = 0, returnToHub = false }) {
  const [open, setOpen] = useState(false);
  if (!Array.isArray(attempts) || attempts.length === 0) return null;

  const shownAttempts = open ? attempts : attempts.slice(-2);

  return (
    <div className="mt-3 rounded-xl border border-[#eee] bg-[#fafafa] p-3 text-[12.5px] dark:border-night-line dark:bg-night-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-[#445268] dark:text-[#e5e0db]">
          <Icon name="history" className="mr-1.5 text-brand" />
          Attempts ({attempts.length})
        </span>
        <span
          className={`text-[11.5px] font-bold ${
            returnToHub
              ? "text-[#dc2626] dark:text-[#ff7b7b]"
              : "text-[#b45309] dark:text-[#fcd34d]"
          }`}
        >
          {returnToHub ? "Return to Hub" : `Attempt ${Math.min(rescheduleCount || 1, MAX_RESCHEDULES)}/${MAX_RESCHEDULES}`}
        </span>
      </div>

      <ol className="mt-2 space-y-2 border-l-2 border-[#e5e8ee] pl-3 dark:border-night-line">
        {shownAttempts.map((att, idx) => {
          const isRth = att.outcome === "return_to_hub";
          const isDelivered = att.outcome === "delivered";
          return (
            <li key={att.id || idx} className="relative">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-bold text-[#27364f] dark:text-[#f1eeeb]">
                  #{att.attempt || idx + 1} · {formatDay(att.scheduledDate)}
                </span>
                {isRth ? (
                  <span className="text-[11px] font-bold text-[#dc2626] dark:text-[#ff7b7b]">
                    Return to Hub
                  </span>
                ) : isDelivered ? (
                  <span className="text-[11px] font-bold text-[#15803d] dark:text-[#4ade80]">
                    Delivered
                  </span>
                ) : att.rescheduledTo ? (
                  <span className="text-[11px] font-bold text-[#b45309] dark:text-[#fcd34d]">
                    Resched → {formatDay(att.rescheduledTo)}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[12px] text-[#64748b] dark:text-[#b8b0a8]">
                {att.reason || "Undelivered"}
              </p>
            </li>
          );
        })}
      </ol>

      {attempts.length > 2 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-[12px] font-semibold text-brand hover:underline"
        >
          {open ? "Show less" : `View all (${attempts.length})`}
        </button>
      )}
    </div>
  );
}

function GroupTitle({ children, count, tone = "" }) {
  return (
    <h2 className={`mb-3 mt-6 flex items-center gap-2 text-[15px] font-bold first:mt-0 ${tone}`}>
      {children}{" "}
      <span className="rounded-full bg-[#f1f1f1] px-2 py-0.5 text-[12px] font-bold text-[#777] dark:bg-night-line dark:text-[#d1c9c2]">
        {count}
      </span>
    </h2>
  );
}

export default function RiderDeliveries() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab");
  const stage = [STAGE.DELIVERED, STAGE.RESCHEDULED, STAGE.FAILED].includes(tab) ? tab : STAGE.TO_DELIVER;
  const copy = COPY[stage];
  const all = useMyDeliveries();
  const syncState = useRiderDeliverySyncState();
  const { online } = useNetworkStatus();
  const failures = useFailedDeliveries();
  const isInitialSyncLoading = online && syncState.syncing && all.length === 0;
  const isOfflineEmpty = !online && all.length === 0 && !syncState.syncedOnce;
  const showCachedNotice = !online && all.length > 0;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [byArea, setByArea] = useState(false);
  const [action, setAction] = useState(null); // { type: "delivered" | "failed", d }
  const [proof, setProof] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentType, setIncidentType] = useState("Vehicle Breakdown");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [incidentError, setIncidentError] = useState("");

  const handleReportIncident = async () => {
    if (!incidentDesc.trim()) {
      return setIncidentError("Please describe what happened (location, situation, impact).");
    }
    setIncidentSubmitting(true);
    setIncidentError("");
    try {
      await reportIncident({ incident_type: incidentType, description: incidentDesc.trim() });
      toast("Incident report submitted. Coordinator notified to review delivery hold.", "info");
      setIncidentOpen(false);
      setIncidentDesc("");
    } catch (err) {
      setIncidentError(err.message || "Failed to submit incident report.");
    } finally {
      setIncidentSubmitting(false);
    }
  };

  const toggleCard = (id) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyAddress = async (cardKey, addressText) => {
    const clean = cleanText(addressText);
    if (!clean) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clean);
      } else {
        const ta = document.createElement("textarea");
        ta.value = clean;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(cardKey);
      toast("Receiver address copied to clipboard.");
      setTimeout(() => {
        setCopiedId((prev) => (prev === cardKey ? null : prev));
      }, 2000);
    } catch {
      toast("Could not copy address.", "error");
    }
  };

  // Date-based stage filtering:
  // - Future rescheduled parcels stay strictly in Rescheduled (never jump to To Deliver on click/sync)
  // - Due rescheduled parcels (scheduledFor <= today) surface at the TOP of To Deliver with a Priority Attempt tag
  const mine = useMemo(() => filterDeliveriesByStage(all, stage), [all, stage]);

  const returnToHubCount = useMemo(
    () => all.filter((d) => d.returnToHub || d.stage === STAGE.RETURN_TO_HUB).length,
    [all]
  );

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const found = q
      ? mine.filter((d) =>
          [d.receiver, d.receiver_name, d.transaction_number, d.address, d.receiver_address, d.contact, d.receiver_contact].some(
            (v) => String(v || "").toLowerCase().includes(q)
          )
        )
      : mine;
    return [...found].sort((a, b) => {
      if (stage === STAGE.TO_DELIVER) {
        const aPrio = isPriorityReattempt(a) ? Number(a.rescheduleCount || 1) : 0;
        const bPrio = isPriorityReattempt(b) ? Number(b.rescheduleCount || 1) : 0;
        if (aPrio !== bPrio) return bPrio - aPrio; // 3rd (Final) Attempt -> 2nd Attempt -> 1st Attempt
      }
      if (stage === STAGE.RESCHEDULED) {
        const aDate = String(a.scheduledFor || "9999-99-99").slice(0, 10);
        const bDate = String(b.scheduledFor || "9999-99-99").slice(0, 10);
        if (aDate !== bDate) return aDate.localeCompare(bDate);
      }
      return (b.doneAt || b.returnToHubAt || b.lastRescheduledAt || b.scannedAt || 0) - (a.doneAt || a.returnToHubAt || a.lastRescheduledAt || a.scannedAt || 0);
    });
  }, [mine, search, stage]);

  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const switchTab = (next) => {
    setSearch("");
    setPage(1);
    setParams(next === STAGE.TO_DELIVER ? {} : { tab: next }, { replace: true });
  };

  const open = (type, d) => {
    setAction({ type, d });
    setProof("");
    setReason("");
    setNote("");
    setError("");
  };
  const close = () => setAction(null);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setProof(await compressImage(file));
    } catch (err) {
      setProof("");
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (busy) return;
    const { type, d } = action;
    if (type === "delivered") {
      if (!proof) return setError("Please add a photo as proof of delivery.");
      markDelivered(d.parcel_id, { proof, note: note.trim() });
      toast(`${d.transaction_number} marked as delivered.`);
      close();
      return;
    }

    if (!reason) return setError("Please choose why the delivery failed.");
    if (!proof) {
      return setError("Please upload or capture a proof photo as evidence before submitting.");
    }
    if (!note.trim()) {
      return setError("Please enter notes explaining the failed delivery attempt.");
    }

    setBusy(true);
    setError("");
    try {
      const immediateRth = isImmediateRthReason(reason);
      const trimmedNote = note.trim();
      const result = markFailed(d.parcel_id, {
        reason,
        note: trimmedNote,
        proof,
        customDate: modalNextDate,
        skipRemoteSync: true,
      });
      reportFailure(d, { reason, note: trimmedNote, proof, result });

      const targetId = d.parcel_id || d.transaction_number;
      let serverRes = null;
      if (result?.outcome === "recipient_refused" || result?.outcome === "return_to_hub" || immediateRth) {
        serverRes = await riderRequestRth(targetId, {
          reason,
          notes: trimmedNote,
          proof,
        }).catch(() => null);
      } else {
        serverRes = await riderRescheduleParcel(targetId, {
          reason,
          scheduledFor: result?.scheduledFor || modalNextDate,
          notes: trimmedNote,
          proof,
        }).catch(() => null);
      }

      if (serverRes) {
        applyServerFailureResult(d.parcel_id, serverRes);
      }

      const finalIsRth = Boolean(
        serverRes?.return_to_hub ||
          serverRes?.status === "RETURN_TO_HUB" ||
          result?.outcome === "recipient_refused" ||
          result?.outcome === "return_to_hub" ||
          immediateRth
      );
      const finalDate = serverRes?.scheduled_for || result?.scheduledFor || modalNextDate;
      const finalCount = Math.max(
        Number(serverRes?.reschedule_count || 0),
        Number(serverRes?.next_day_attempt_count || 0),
        Number(result?.rescheduleCount || 1)
      );

      if (result?.outcome === "recipient_refused" || immediateRth) {
        toast(
          `${d.transaction_number} marked as Return to Hub (${reason}). Coordinator has been notified.`,
          "error"
        );
      } else if (finalIsRth) {
        toast(
          `${d.transaction_number} reached the ${MAX_RESCHEDULES}-attempt reschedule limit and was marked as Return to Hub. Coordinator notified.`,
          "error"
        );
      } else {
        toast(
          `${d.transaction_number} rescheduled for ${formatDay(finalDate)} (${getAttemptOrdinalLabel(finalCount)}).`,
          "info"
        );
      }

      syncRiderDeliveriesWithServer().catch(() => {});
      close();
    } finally {
      setBusy(false);
    }
  };

  const tryAgain = (d) => {
    if (d.returnToHub || d.stage === STAGE.RETURN_TO_HUB || Number(d.rescheduleCount || 0) >= MAX_RESCHEDULES) {
      toast("Maximum 2-attempt limit reached. This parcel must be returned to the hub.", "error");
      return;
    }
    withdrawFailure(d.parcel_id);
    const ok = reattempt(d.parcel_id);
    if (ok) toast(`${d.transaction_number} moved back to To Be Delivered.`);
  };

  // ---- Mga card
  const deliverCard = (d) => {
    const cardKey = d.parcel_id || d.transaction_number;
    const expanded = Boolean(expandedCards[cardKey]);
    const reschedCount = Math.min(MAX_RESCHEDULES, Math.max(0, Number(d.rescheduleCount || 0)));
    const isResched = isPriorityReattempt(d);
    const attemptLabel = getAttemptOrdinalLabel(reschedCount);
    const isPriorityInToDeliver = isResched && stage === STAGE.TO_DELIVER;
    const isFinalAttempt = reschedCount >= MAX_RESCHEDULES;

    const actionButtons = (
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => open("delivered", d)} className={`${btnPrimary} ${bigBtn}`}>
          <Icon name="circle-check" /> Delivered
        </button>
        <button type="button" onClick={() => open("failed", d)} className={`${btnGhost} ${bigBtn}`}>
          <Icon name="x" /> Failed Delivery
        </button>
      </div>
    );

    const latestReason =
      cleanText(d.lastFailure) ||
      cleanText(d.attempts?.[d.attempts.length - 1]?.reason) ||
      "";
    const latestReschedTs =
      parseValidTimestamp(d.lastRescheduledAt) ||
      parseValidTimestamp(d.attempts?.[d.attempts.length - 1]?.failedAt) ||
      parseValidTimestamp(d.updated_at) ||
      null;

    return (
      <article
        key={cardKey}
        className={`${card} ${
          isPriorityInToDeliver
            ? isFinalAttempt
              ? "border-l-4 border-l-[#dc2626] ring-1 ring-red-200/70 dark:ring-red-900/40"
              : "border-l-4 border-l-brand ring-1 ring-orange-200/70 dark:ring-orange-900/40"
            : ""
        }`}
      >
        {isPriorityInToDeliver && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                isFinalAttempt
                  ? "bg-red-100 text-[#dc2626] dark:bg-red-950/60 dark:text-[#ff7b7b]"
                  : "bg-[#ffedd5] text-[#c2410c] dark:bg-orange-500/20 dark:text-[#fb923c]"
              }`}
            >
              <Icon name="star" className="text-[11px]" />
              {attemptLabel} to Deliver · Priority
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Resched {reschedCount}/{MAX_RESCHEDULES}
            </span>
          </div>
        )}

        <CardHead
          d={d}
          expanded={expanded}
          onToggle={() => toggleCard(cardKey)}
          copiedId={copiedId}
          onCopyAddress={copyAddress}
          badge={
            isResched ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  isFinalAttempt
                    ? "bg-[#fee2e2] text-[#dc2626] dark:bg-red-500/20 dark:text-[#ff7b7b]"
                    : "bg-brand-soft text-brand"
                }`}
              >
                <Icon name="calendar-days" className="mr-1" />
                {attemptLabel} · {formatDay(d.scheduledFor)}
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-[#eaf8ef] px-2 py-0.5 text-[11px] font-bold text-[#29945a]">
                Scheduled · {formatDay(d.scheduledFor || todayIso())}
              </span>
            )
          }
        />

        {isResched && (
          <div className="mt-2.5 flex flex-col gap-0.5 rounded-lg bg-[#fff8eb] px-2.5 py-2 text-[11.5px] font-medium text-[#9a6700] dark:bg-[#2d2416] dark:text-[#f6c453]">
            <div className="flex items-start gap-1.5">
              <Icon name="calendar-days" className="mt-0.5 shrink-0" />
              <span>
                Parcel will be delivered on <strong>{formatDay(d.scheduledFor)}</strong> ({attemptLabel})
                {latestReason ? ` due to ${latestReason}` : ""}.
              </span>
            </div>
            {latestReschedTs && (
              <span className="pl-4 text-[10.5px] text-[#b47b09] dark:text-[#fcd34d]/80">
                Rescheduled at {formatDate(latestReschedTs)}
              </span>
            )}
          </div>
        )}

        {(d.delivery_hold || d.deliveryHold) && (
          <div className="mt-2.5 rounded-lg border border-[#fbbf24] bg-[#fffbeb] p-2.5 text-[11.5px] text-[#92400e] dark:border-[#b45309] dark:bg-[#2d2416] dark:text-[#fde68a]">
            <Icon name="circle-pause" className="mr-1.5 font-bold" />
            <strong>Delivery On Hold (Incident):</strong> Rescheduling counter is paused by Coordinator.
          </div>
        )}

        {!expanded ? (
          <>
            <div className="mt-3">{actionButtons}</div>
            <div className="mt-2.5 border-t border-[#f0f2f6] pt-2 text-center dark:border-night-line">
              <button
                type="button"
                onClick={() => toggleCard(cardKey)}
                className="inline-flex items-center justify-center gap-1 text-[11.5px] font-semibold text-[#64748b] transition hover:text-brand dark:text-[#d1c9c2]"
              >
                <span>Tap receiver name to expand</span>
                <Icon name="chevron-down" className="text-[10px]" />
              </button>
            </div>
          </>
        ) : (
          <div className="mt-2.5">
            {!isResched && cleanText(d.lastFailure) && (
              <p className="mb-2 text-[12px] font-semibold text-[#d94747]">
                <Icon name="undo-2" className="mr-1.5" />
                Last attempt failed: {cleanText(d.lastFailure)}
              </p>
            )}

            <div className="mt-3 border-t border-[#f0f2f6] pt-3 dark:border-night-line">
              {actionButtons}
            </div>
          </div>
        )}
      </article>
    );
  };

  const deliveredCard = (d) => {
    const cardKey = d.parcel_id || d.transaction_number;
    const expanded = Boolean(expandedCards[cardKey]);
    const deliveryTs = getDeliveryTimestamp(d);
    const doneTime = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(deliveryTs));

    return (
      <article key={cardKey} className={card}>
        <CardHead
          d={d}
          expanded={expanded}
          onToggle={() => toggleCard(cardKey)}
          copiedId={copiedId}
          onCopyAddress={copyAddress}
          badge={
            <span className="shrink-0 rounded-full bg-[#eaf8ef] px-2 py-0.5 text-[11px] font-bold text-[#29945a]">
              {doneTime}
            </span>
          }
        />

        {(d.delivery_hold || d.deliveryHold) && (
          <div className="mt-2.5 rounded-lg border border-[#fbbf24] bg-[#fffbeb] p-2.5 text-[11.5px] text-[#92400e] dark:border-[#b45309] dark:bg-[#2d2416] dark:text-[#fde68a]">
            <Icon name="circle-pause" className="mr-1.5 font-bold" />
            <strong>Delivery On Hold (Incident):</strong> Rescheduling counter is paused by Coordinator.
          </div>
        )}

        {!expanded ? (
          <>
            {d.proof && (
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => setViewer(d)}
                  className={`${btnGhost} ${bigBtn} flex items-center justify-center gap-1.5`}
                >
                  <Icon name="image" /> View Proof of Delivery
                </button>
              </div>
            )}
            <div className="mt-2.5 border-t border-[#f0f2f6] pt-2 text-center dark:border-night-line">
              <button
                type="button"
                onClick={() => toggleCard(cardKey)}
                className="inline-flex items-center justify-center gap-1 text-[11.5px] font-semibold text-[#64748b] transition hover:text-brand dark:text-[#d1c9c2]"
              >
                <span>Tap receiver name to expand</span>
                <Icon name="chevron-down" className="text-[10px]" />
              </button>
            </div>
          </>
        ) : (
          <div className="mt-2.5 space-y-2">
            <div className="rounded-lg border border-[#e5e8ee] bg-[#f8fafc] p-2.5 text-[12px] text-[#52627a] dark:border-night-line dark:bg-night-soft dark:text-[#d1c9c2]">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-semibold text-[#27364f] dark:text-[#f1eeeb]">Delivered:</span>
                <span className="font-bold text-[#29945a]">{formatDate(deliveryTs)}</span>
              </div>
              {(d.scannedAt || d.created_at) && (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                  <span>Initial Registration / Scan:</span>
                  <span>{formatDate(d.scannedAt || d.created_at)}</span>
                </div>
              )}
            </div>

            {cleanText(d.note) && (
              <p className="text-[12px] text-[#666] dark:text-[#d1c9c2]">“{cleanText(d.note)}”</p>
            )}
            {d.attempts?.length > 1 && (
              <AttemptHistory attempts={d.attempts} rescheduleCount={d.rescheduleCount} returnToHub={false} />
            )}
            {d.proof && (
              <div className="mt-3 border-t border-[#f0f2f6] pt-3 dark:border-night-line">
                <button
                  type="button"
                  onClick={() => setViewer(d)}
                  className={`${btnGhost} ${bigBtn} flex items-center justify-center gap-1.5`}
                >
                  <Icon name="image" /> View Proof of Delivery
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  const failedCard = (d) => {
    const cardKey = d.parcel_id || d.transaction_number;
    const expanded = Boolean(expandedCards[cardKey]);
    const isReturnToHub = Boolean(d.returnToHub || d.stage === STAGE.RETURN_TO_HUB);
    const f = latestFor(failures, d.parcel_id);
    const canRetry = !isReturnToHub && f?.status !== "confirmed";

    return (
      <article key={cardKey} className={card}>
        <CardHead
          d={d}
          expanded={expanded}
          onToggle={() => toggleCard(cardKey)}
          copiedId={copiedId}
          onCopyAddress={copyAddress}
          badge={
            isReturnToHub ? (
              <span className="shrink-0 text-[11px] font-bold text-[#dc2626] dark:text-[#ff7b7b]">
                <Icon name="undo-2" className="mr-1" />
                Return to Hub
              </span>
            ) : (
              <span className="shrink-0 text-[11.5px] text-[#aaa]">{formatDate(d.doneAt)}</span>
            )
          }
        />

        {(d.delivery_hold || d.deliveryHold) && (
          <div className="mt-2.5 rounded-lg border border-[#fbbf24] bg-[#fffbeb] p-2.5 text-[11.5px] text-[#92400e] dark:border-[#b45309] dark:bg-[#2d2416] dark:text-[#fde68a]">
            <Icon name="circle-pause" className="mr-1.5 font-bold" />
            <strong>Delivery On Hold (Incident):</strong> Rescheduling counter is paused by Coordinator.
          </div>
        )}

        {!expanded ? (
          <>
            {d.proof && (
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => setViewer(d)}
                  className={`${btnGhost} ${bigBtn} flex items-center justify-center gap-1.5`}
                >
                  <Icon name="image" /> View Proof Photo
                </button>
              </div>
            )}
            {canRetry && (
              <button type="button" onClick={() => tryAgain(d)} className={`${btnPrimary} ${bigBtn} mt-2.5`}>
                <Icon name="undo-2" /> Try again
              </button>
            )}
            <div className="mt-2.5 border-t border-[#f0f2f6] pt-2 text-center dark:border-night-line">
              <button
                type="button"
                onClick={() => toggleCard(cardKey)}
                className="inline-flex items-center justify-center gap-1 text-[11.5px] font-semibold text-[#64748b] transition hover:text-brand dark:text-[#d1c9c2]"
              >
                <span>Tap receiver name to expand</span>
                <Icon name="chevron-down" className="text-[10px]" />
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className="mt-2.5 rounded-lg border border-red-200/80 bg-[#fff5f5] px-3 py-2 dark:border-red-900/50 dark:bg-red-950/25">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-[12.5px] text-[#dc2626] dark:text-[#ff7b7b]">
                  {isReturnToHub ? "Return to Hub" : "Failed Delivery"}
                </strong>
                {d.returnCoordinated ? (
                  <span className="text-[11px] font-bold text-[#15803d] dark:text-[#4ade80]">
                    <Icon name="circle-check" className="mr-1" />Confirmed at Hub
                  </span>
                ) : isReturnToHub ? (
                  <span className="text-[11px] font-bold text-[#b45309] dark:text-[#fcd34d]">
                    Return to hub
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[12px] text-[#475569] dark:text-[#d1c9c2]">
                {cleanText(d.lastFailure || d.reason) || "Missed delivery"}
              </p>
            </div>

            {d.proof && (
              <div className="mt-2.5">
                <button
                  type="button"
                  onClick={() => setViewer(d)}
                  className={`${btnGhost} ${bigBtn} flex items-center justify-center gap-1.5`}
                >
                  <Icon name="image" /> View Proof Photo
                </button>
              </div>
            )}

            <AttemptHistory
              attempts={d.attempts}
              rescheduleCount={d.rescheduleCount || MAX_RESCHEDULES}
              returnToHub={isReturnToHub}
            />

            {canRetry && (
              <div className="mt-4 border-t border-[#f0f2f6] pt-4 dark:border-night-line">
                <button type="button" onClick={() => tryAgain(d)} className={`${btnPrimary} ${bigBtn}`}>
                  <Icon name="undo-2" /> Try again
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  // ---- Buod sa itaas ng bawat listahan
  const strip = {
    [STAGE.TO_DELIVER]: [
      [`${mine.length} left to deliver`, "text-brand bg-brand-soft"],
    ],
    [STAGE.DELIVERED]: [
      [
        `Today · ${
          mine.filter((d) => getManilaDateKey(getDeliveryTimestamp(d)) === getManilaDateKey(Date.now())).length
        } delivered`,
        "text-[#29945a] bg-[#eaf8ef]",
      ],
      [`${mine.length} in total`, "text-[#777] bg-[#f1f1f1]"],
    ],
    [STAGE.RESCHEDULED]: [
      [`${mine.length} rescheduled (max ${MAX_RESCHEDULES} attempts)`, "text-[#c98200] bg-[#fff4d8]"],
    ],
    [STAGE.FAILED]: [
      [`${mine.filter((d) => d.returnToHub || d.stage === STAGE.RETURN_TO_HUB).length} Return to Hub`, "text-[#dc2626] bg-[#fff0f0] dark:bg-red-500/15 dark:text-[#ff7b7b]"],
      ...(mine.some((d) => !d.returnToHub && d.stage === STAGE.FAILED)
        ? [[`${mine.filter((d) => !d.returnToHub && d.stage === STAGE.FAILED).length} failed`, "text-[#d94747] bg-[#fff1f1]"]]
        : []),
    ],
  }[stage] || [];

  // ---- Ang laman ayon sa stage
  let body;
  if (list.length === 0) {
    body = (
      <EmptyState
        icon={copy.icon}
        title={search ? "No parcels match your search" : copy.empty}
        text={search ? "Try a different name, address or transaction number." : copy.emptyText}
      />
    );
  } else if (stage === STAGE.TO_DELIVER || stage === STAGE.RESCHEDULED) {
    if (byArea) {
      const groups = new Map();
      shown.forEach((d) => {
        const k = areaOf(d.address);
        groups.set(k, [...(groups.get(k) || []), d]);
      });
      body = [...groups].map(([area, items]) => (
        <div key={area}>
          <GroupTitle count={items.length}>
            <Icon name="map-pin" className="text-brand" /> {area}
          </GroupTitle>
          <div className="grid grid-cols-2 gap-3.5 max-[760px]:grid-cols-1">{items.map(deliverCard)}</div>
        </div>
      ));
    } else {
      body = <div className="grid grid-cols-2 gap-3.5 max-[760px]:grid-cols-1">{shown.map(deliverCard)}</div>;
    }
  } else if (stage === STAGE.DELIVERED) {
    const days = new Map();
    shown.forEach((d) => {
      const ts = getDeliveryTimestamp(d);
      const k = getManilaDateKey(ts);
      days.set(k, { ts, items: [...(days.get(k)?.items || []), d] });
    });
    body = [...days].map(([k, g]) => (
      <div key={k}>
        <GroupTitle count={list.filter((d) => getManilaDateKey(getDeliveryTimestamp(d)) === k).length}>
          {formatDeliveryDayLabel(g.ts)}
        </GroupTitle>
        <div className="grid grid-cols-2 gap-3.5 max-[760px]:grid-cols-1">{g.items.map(deliveredCard)}</div>
      </div>
    ));
  } else {
    const rthItems = shown.filter((d) => d.returnToHub || d.stage === STAGE.RETURN_TO_HUB);
    const otherFailed = shown.filter((d) => !d.returnToHub && d.stage !== STAGE.RETURN_TO_HUB);
    body = (
      <>
        {rthItems.length > 0 && (
          <div>
            <GroupTitle
              count={list.filter((d) => d.returnToHub || d.stage === STAGE.RETURN_TO_HUB).length}
              tone="text-[#dc2626] dark:text-[#ff7b7b]"
            >
              <Icon name="undo-2" /> Return to Hub
            </GroupTitle>
            <div className="grid grid-cols-2 gap-3.5 max-[760px]:grid-cols-1">{rthItems.map(failedCard)}</div>
          </div>
        )}
        {otherFailed.length > 0 && (
          <div>
            <GroupTitle count={otherFailed.length} tone="text-[#d94747]">
              <Icon name="circle-alert" /> Failed Attempts
            </GroupTitle>
            <div className="grid grid-cols-2 gap-3.5 max-[760px]:grid-cols-1">{otherFailed.map(failedCard)}</div>
          </div>
        )}
      </>
    );
  }

  const modalReschedCount = Number(action?.d?.rescheduleCount || 0);
  const modalWillReturnToHub = modalReschedCount >= MAX_RESCHEDULES;
  const modalBaseDate =
    action?.d?.scheduledFor && action.d.scheduledFor >= todayIso() ? action.d.scheduledFor : todayIso();
  const modalNextDate = addDaysIso(modalBaseDate, 1);

  return (
    <>
      <Topbar title="Deliveries" subtitle={copy.subtitle}>
        <div className="flex items-center gap-2 flex-wrap">
          {stage !== STAGE.TO_DELIVER ? (
            <Link to="/rider/parcels?report=1" className={btnGhost}>
              <Icon name="file-text" /> Generate Report
            </Link>
          ) : (
            <Link to="/rider/scan" className={btnPrimary}>
              <Icon name="qr-code" /> Scan QR Code
            </Link>
          )}
        </div>
      </Topbar>

      {showCachedNotice && <CachedDataNotice updatedAt={syncState.lastSyncedAt} />}

      <DeliveryTabs value={stage} onChange={switchTab} />

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {strip.map(([label, cls]) => (
            <span key={label} className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold ${cls}`}>
              {label}
            </span>
          ))}
        </div>
        {stage === STAGE.TO_DELIVER && returnToHubCount > 0 && (
          <button
            type="button"
            onClick={() => switchTab(STAGE.FAILED)}
            className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-[#fff0f0] px-3 py-1 text-[12px] font-bold text-[#d94747] transition hover:bg-[#fee2e2] dark:bg-red-500/20 dark:text-red-300"
          >
            <Icon name="undo-2" className="mr-1" />
            {returnToHubCount} Return to Hub →
          </button>
        )}
      </div>

      <SearchFilterBar
        hasActiveFilters={Boolean(search.trim() || byArea)}
        onReset={() => {
          setSearch("");
          setByArea(false);
          setPage(1);
        }}
      >
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search receiver, address, transaction no."
          ariaLabel="Search deliveries"
        />
        {stage === STAGE.TO_DELIVER && (
          <button
            type="button"
            onClick={() => {
              setByArea((v) => !v);
              setPage(1);
            }}
            aria-pressed={byArea}
            className={`inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-bold transition max-[640px]:flex-1 ${
              byArea
                ? "bg-brand text-white shadow-xs hover:bg-brand-dark"
                : "border border-slate-200/95 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-head dark:text-slate-200 dark:hover:border-brand dark:hover:text-brand"
            }`}
          >
            <Icon name="map-pin" className="h-4 w-4" />
            <span>Group by area</span>
          </button>
        )}
      </SearchFilterBar>

      <section className={stage === STAGE.TO_DELIVER && list.length === 0 && !isInitialSyncLoading ? `${panel} p-6` : ""}>
        {isInitialSyncLoading ? (
          <ParcelCardListSkeleton count={4} label="Loading deliveries" />
        ) : isOfflineEmpty ? (
          <OfflineState
            title="Deliveries unavailable offline"
            text="Reconnect to sync your assigned deliveries."
            onRetry={() => syncRiderDeliveriesWithServer()}
          />
        ) : (
          body
        )}
        {!isInitialSyncLoading && !isOfflineEmpty && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.length} onPage={setPage} />
        )}
      </section>

      {/* Delivered / Failed Modal */}
      <Modal
        open={!!action}
        onClose={close}
        z="z-[3500]"
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto p-7 dark:bg-night-panel"
      >
        {action && (
          <>
            <button
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 h-8 w-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
            >
              <Icon name="x" />
            </button>
            <h3 className="mb-1 pr-8 text-[18px] font-bold">
              {action.type === "delivered" ? "Mark as delivered" : "Report Failed Delivery Attempt"}
            </h3>
            <p className="mb-4 text-[13px] text-[#999]">
              {action.d.transaction_number} · {action.d.receiver}
            </p>

            {action.type === "delivered" ? (
              <div>
                <label className={labelCls} htmlFor="pod">
                  Proof of delivery (photo)
                </label>
                <input
                  id="pod"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={pickPhoto}
                  className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-[13px] file:font-bold file:text-brand"
                />
                {busy && <p className="mt-2 text-[13px] text-[#999]">Preparing photo…</p>}
                {proof && (
                  <img
                    src={proof}
                    alt="Proof preview"
                    className="mt-3 max-h-[220px] w-full rounded-xl border border-[#eee] object-contain dark:border-night-line"
                  />
                )}
              </div>
            ) : (
              <div>
                {modalWillReturnToHub && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-[#fff5f5] p-3 text-[13px] text-[#dc2626] dark:border-red-900/60 dark:bg-red-950/30 dark:text-[#ff7b7b]">
                    <strong className="block font-bold">
                      <Icon name="undo-2" className="mr-1.5" />
                      Return to Hub ({MAX_RESCHEDULES}/{MAX_RESCHEDULES} attempts)
                    </strong>
                    <p className="mt-1 text-[12.5px]">
                      Max attempts reached — this parcel will be marked Return to Hub.
                    </p>
                  </div>
                )}

                <label className={labelCls} htmlFor="reason">
                  Failure Reason <span className="text-[#dc2626]">*</span>
                </label>
                <FailureReasonSelect
                  id="reason"
                  value={reason}
                  disabled={busy}
                  onChange={(val) => {
                    setReason(val);
                    setError("");
                  }}
                />

                {reason && !isImmediateRthReason(reason) && !modalWillReturnToHub && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    <strong className="block font-bold">
                      <Icon name="calendar-days" className="mr-1.5" />
                      Automatic Reschedule ({getAttemptOrdinalLabel(modalReschedCount + 1)} · {modalReschedCount + 1}/{MAX_RESCHEDULES})
                    </strong>
                    <p className="mt-1">
                      This parcel will automatically be rescheduled for delivery on{" "}
                      <strong>{formatDay(modalNextDate)}</strong> and moved to the <strong>Rescheduled</strong> tab.
                    </p>
                  </div>
                )}

                {isImmediateRthReason(reason) && (
                  <div className="mt-3 rounded-xl border border-[#f87171] bg-[#fef2f2] p-3 text-[12.5px] text-[#b91c1c] dark:border-[#991b1b] dark:bg-[#2e1818] dark:text-[#fca5a5]">
                    <strong className="block font-bold">
                      <Icon name="undo-2" className="mr-1.5" />
                      Automatic Return to Hub (RTH)
                    </strong>
                    <p className="mt-1">
                      Selecting <strong>{reason}</strong> will automatically mark this parcel as{" "}
                      <strong>Return to Hub</strong> and notify the Coordinator for physical arrival confirmation.
                    </p>
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-night-line dark:bg-night-head/60">
                  <label className={labelCls} htmlFor="failedProofPhoto">
                    Upload Proof / Evidence Photo <span className="text-[#dc2626]">*</span>{" "}
                    <span className="font-normal text-[#64748b] dark:text-[#b8b0a8]">(Required)</span>
                  </label>
                  <input
                    id="failedProofPhoto"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={pickPhoto}
                    className="block w-full text-[13px] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3.5 file:py-2 file:text-[12.5px] file:font-bold file:text-white hover:file:bg-brand-dark"
                  />
                  {busy && <p className="mt-2 text-[12px] text-[#888]">Processing proof photo…</p>}
                  {proof && (
                    <div className="mt-3 space-y-2">
                      <img
                        src={proof}
                        alt="Failed delivery evidence preview"
                        className="max-h-[200px] w-full rounded-xl border border-[#eee] bg-white object-contain dark:border-night-line"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setProof("")}
                          className="text-[12px] font-semibold text-[#dc2626] hover:underline dark:text-[#ff7b7b]"
                        >
                          Remove photo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className={labelCls} htmlFor="note">
                {action.type === "failed" ? (
                  <>
                    Notes <span className="text-[#dc2626]">*</span>{" "}
                    <span className="font-normal text-[#64748b] dark:text-[#b8b0a8]">(Required)</span>
                  </>
                ) : (
                  "Notes (optional)"
                )}
              </label>
              <textarea
                id="note"
                rows={2}
                value={note}
                required={action.type === "failed"}
                onChange={(e) => {
                  setNote(e.target.value);
                  if (error) setError("");
                }}
                maxLength={300}
                className={textareaCls}
                placeholder={
                  action.type === "delivered"
                    ? "e.g. Received by the recipient's sister"
                    : "Explain what happened during the delivery attempt (required)…"
                }
              />
            </div>

            {error && (
              <div className="mt-4">
                <Notice tone="error" icon="circle-alert" role="alert">
                  {error}
                </Notice>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <button onClick={close} className={btnGhost}>
                Cancel
              </button>
              <button onClick={confirm} disabled={busy} className={btnPrimary}>
                {action.type === "delivered"
                  ? "Confirm Delivered"
                  : isImmediateRthReason(reason) || modalWillReturnToHub
                  ? "Submit & Mark Return to Hub"
                  : `Submit & Reschedule (${formatShortDay(modalNextDate)})`}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Malaking proof */}
      <Modal
        open={!!viewer}
        onClose={() => setViewer(null)}
        z="z-[3500]"
        className="w-full max-w-[520px] p-5 dark:bg-night-panel"
      >
        {viewer && (
          <>
            <button
              onClick={() => setViewer(null)}
              aria-label="Close"
              className="absolute right-3 top-3 h-8 w-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
            >
              <Icon name="x" />
            </button>
            <p className="mb-3 pr-8 text-[14px] font-bold">{viewer.transaction_number} · Proof of delivery</p>
            <img src={viewer.proof} alt="Proof of delivery" className="max-h-[70vh] w-full rounded-xl object-contain" />
            <p className="mt-2 text-[12px] text-[#999]">{formatDate(viewer.doneAt)}</p>
          </>
        )}
      </Modal>

      {/* Incident Report Modal */}
      <Modal
        open={incidentOpen}
        onClose={() => setIncidentOpen(false)}
        z="z-[3500]"
        className="w-full max-w-[500px] p-6 dark:bg-night-panel"
      >
        <button
          onClick={() => setIncidentOpen(false)}
          aria-label="Close"
          className="absolute right-3.5 top-3.5 h-8 w-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"
        >
          <Icon name="x" />
        </button>
        <div className="mb-3 flex items-center gap-2.5 text-[#d97706]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fef3c7] text-[18px]">
            <Icon name="triangle-alert" />
          </span>
          <h2 className="text-[18px] font-bold text-[#27364f] dark:text-[#f1eeeb]">Report Incident</h2>
        </div>
        <p className="mb-4 text-[13px] text-[#64748b] dark:text-[#cbd5e1]">
          Report road incidents, vehicle breakdowns, or emergencies. The Coordinator will review and place your undelivered parcels on delivery hold (pausing the 3-day reschedule counter).
        </p>

        <label className={labelCls} htmlFor="incident-type">Incident Type</label>
        <FilterSelect
          id="incident-type"
          value={incidentType}
          onChange={(e) => setIncidentType(e.target.value)}
          icon="triangle-alert"
          fullWidth
          inline
          ariaLabel="Incident Type"
        >
          <option value="Vehicle Breakdown">Vehicle Breakdown</option>
          <option value="Accident / Road Incident">Accident / Road Incident</option>
          <option value="Medical Emergency">Medical Emergency</option>
          <option value="Severe Weather / Flooding">Severe Weather / Flooding</option>
          <option value="Personal Emergency">Personal Emergency</option>
          <option value="Other">Other Emergency</option>
        </FilterSelect>

        <div className="mt-4">
          <label className={labelCls} htmlFor="incident-desc">Details / Description</label>
          <textarea
            id="incident-desc"
            rows={3}
            value={incidentDesc}
            onChange={(e) => setIncidentDesc(e.target.value)}
            placeholder="Describe what happened, current location, condition..."
            className={textareaCls}
          />
        </div>

        {incidentError && (
          <div className="mt-4">
            <Notice tone="error" icon="circle-alert">{incidentError}</Notice>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={() => setIncidentOpen(false)} className={btnGhost}>Cancel</button>
          <button onClick={handleReportIncident} disabled={incidentSubmitting} className={btnPrimary}>
            {incidentSubmitting ? "Submitting…" : "Submit Report"}
          </button>
        </div>
      </Modal>
    </>
  );
}
