import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import DeliveryTabs from "../../components/rider/DeliveryTabs.jsx";
import { EmptyState, Modal } from "../../components/ui.jsx";
import { Notice } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, textareaCls } from "../../components/styles.js";
import {
  FAIL_REASONS,
  MAX_RESCHEDULES,
  STAGE,
  addDaysIso,
  markDelivered,
  markFailed,
  reattempt,
  todayIso,
  useMyDeliveries,
} from "../../store/riderDeliveries.js";
import { compressImage } from "../../utils/image.js";
import { formatDate, formatDay } from "../../utils/format.js";
import { latestFor, reportFailure, useFailedDeliveries, withdrawFailure } from "../../store/failedDeliveries.js";
import { toast } from "../../store/toast.js";

const STEP = 15; // ilang card ang idinadagdag ng "Show more"

const SHOW_NAVIGATE = true;
const mapsUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const COPY = {
  [STAGE.TO_DELIVER]: {
    title: "To Be Delivered",
    subtitle:
      "Parcels you scanned. Undelivered parcels are automatically rescheduled for up to 3 days before being marked Return to Hub.",
    icon: "fa-truck-fast",
    empty: "Nothing to deliver",
    emptyText: "Scan a parcel's QR code and it will appear here.",
  },
  [STAGE.DELIVERED]: {
    title: "Delivered",
    subtitle: "Your delivery history, with proof of delivery.",
    icon: "fa-circle-check",
    empty: "No delivered parcels yet",
    emptyText: "Completed deliveries will be listed here.",
  },
  [STAGE.FAILED]: {
    title: "Failed & Return to Hub",
    subtitle: "Parcels that reached the 3-day rescheduling limit (Return to Hub) or failed delivery attempts.",
    icon: "fa-warehouse",
    empty: "No failed or Return to Hub parcels",
    emptyText: "Parcels that reach the 3-day rescheduling limit will appear here as Return to Hub.",
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

const dayKey = (ts) => new Date(ts).toDateString();
function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const card =
  "rounded-2xl border border-[#e5e8ee] bg-white p-5 dark:border-night-line dark:bg-night-panel max-[420px]:p-4";
const bigBtn = "!py-3.5 !text-[15px] w-full";

function Navigate({ address }) {
  if (!SHOW_NAVIGATE || !address) return null;
  return (
    <a
      href={mapsUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline"
    >
      <i className="fa-solid fa-location-arrow" /> Navigate
    </a>
  );
}

// Pinagsamang ulo ng card: receiver (malaki), address, at maliit na detalye
function CardHead({ d, badge }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-[18px] font-bold leading-snug text-[#27364f] dark:text-[#f1eeeb]">
          {d.receiver || "—"}
        </h3>
        {badge}
      </div>
      {d.address ? (
        <p className="mt-1.5 flex items-start gap-2 text-[14px] text-[#52627a] dark:text-[#d1c9c2]">
          <i className="fa-solid fa-location-dot mt-1 text-brand" />{" "}
          <span className="min-w-0 break-words">{d.address}</span>
        </p>
      ) : null}
      <p className="mt-2 text-[12.5px] text-[#999]">
        {d.transaction_number}
        {d.contents ? ` · ${d.contents}` : ""}
        {d.seller ? ` · ${d.seller}` : ""}
        {d.contact ? ` · ${d.contact}` : ""}
      </p>
    </>
  );
}

// History ng mga nakaraang delivery attempts, rescheduled dates, at failure reasons
function AttemptHistory({ attempts = [], rescheduleCount = 0, returnToHub = false }) {
  const [open, setOpen] = useState(false);
  if (!Array.isArray(attempts) || attempts.length === 0) return null;

  const shownAttempts = open ? attempts : attempts.slice(-2);

  return (
    <div className="mt-3 rounded-xl border border-[#eee] bg-[#fafafa] p-3 text-[12.5px] dark:border-night-line dark:bg-night-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-[#445268] dark:text-[#e5e0db]">
          <i className="fa-solid fa-clock-rotate-left mr-1.5 text-brand" />
          Delivery Attempts & Reschedule History ({attempts.length})
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            returnToHub
              ? "bg-[#f2ecff] text-[#7c3aed]"
              : "bg-[#fff4d8] text-[#c98200]"
          }`}
        >
          {returnToHub
            ? `3/${MAX_RESCHEDULES} Days Reached · Return to Hub`
            : `Reschedule Day ${rescheduleCount || 1} of ${MAX_RESCHEDULES}`}
        </span>
      </div>

      <ol className="mt-2.5 space-y-2 border-l-2 border-[#e5e8ee] pl-3 dark:border-night-line">
        {shownAttempts.map((att, idx) => {
          const isRth = att.outcome === "return_to_hub";
          const isDelivered = att.outcome === "delivered";
          return (
            <li key={att.id || idx} className="relative">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-bold text-[#27364f] dark:text-[#f1eeeb]">
                  Attempt #{att.attempt || idx + 1} · {formatDay(att.scheduledDate)}
                </span>
                {isRth ? (
                  <span className="rounded bg-[#f2ecff] px-1.5 py-0.5 text-[11px] font-bold text-[#7c3aed]">
                    Marked Return to Hub
                  </span>
                ) : isDelivered ? (
                  <span className="rounded bg-[#eaf8ef] px-1.5 py-0.5 text-[11px] font-bold text-[#29945a]">
                    Delivered
                  </span>
                ) : att.rescheduledTo ? (
                  <span className="rounded bg-[#fff4d8] px-1.5 py-0.5 text-[11px] font-bold text-[#c98200]">
                    Rescheduled → {formatDay(att.rescheduledTo)} (Day {att.rescheduleDay || 1}/{MAX_RESCHEDULES})
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[#d94747] font-medium">
                Reason: {att.reason || "Undelivered on scheduled date"}
                {att.auto ? " (Auto-rescheduled)" : ""}
              </p>
              {att.note && <p className="mt-0.5 text-[11.5px] text-[#888]">{att.note}</p>}
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
          {open ? "Show fewer attempts" : `View all ${attempts.length} attempts`}
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
  const stage = [STAGE.DELIVERED, STAGE.FAILED].includes(tab) ? tab : STAGE.TO_DELIVER;
  const copy = COPY[stage];
  const all = useMyDeliveries();
  const failures = useFailedDeliveries();
  const [limit, setLimit] = useState(STEP);
  const [search, setSearch] = useState("");
  const [byArea, setByArea] = useState(false);
  const [action, setAction] = useState(null); // { type: "delivered" | "failed", d }
  const [proof, setProof] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState(null);

  // Tinitiyak na ang mga "Return to Hub" ay HINDI na lumalabas sa "To Be Delivered"
  const mine = useMemo(() => {
    if (stage === STAGE.TO_DELIVER) {
      return all.filter((d) => d.stage === STAGE.TO_DELIVER && !d.returnToHub);
    }
    if (stage === STAGE.FAILED) {
      return all.filter((d) => d.stage === STAGE.FAILED || d.stage === STAGE.RETURN_TO_HUB || d.returnToHub);
    }
    return all.filter((d) => d.stage === stage);
  }, [all, stage]);

  const returnToHubCount = useMemo(
    () => all.filter((d) => d.returnToHub || d.stage === STAGE.RETURN_TO_HUB).length,
    [all]
  );

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const found = q
      ? mine.filter((d) =>
          [d.receiver, d.transaction_number, d.address, d.seller, d.contents].some((v) =>
            String(v || "").toLowerCase().includes(q)
          )
        )
      : mine;
    return [...found].sort((a, b) => {
      if (stage === STAGE.TO_DELIVER && !!a.rescheduled !== !!b.rescheduled) return a.rescheduled ? -1 : 1;
      return (b.doneAt || b.returnToHubAt || b.scannedAt || 0) - (a.doneAt || a.returnToHubAt || a.scannedAt || 0);
    });
  }, [mine, search, stage]);

  const shown = list.slice(0, limit);

  const switchTab = (next) => {
    setSearch("");
    setLimit(STEP);
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

  const confirm = () => {
    const { type, d } = action;
    if (type === "delivered") {
      if (!proof) return setError("Please add a photo as proof of delivery.");
      markDelivered(d.parcel_id, { proof, note: note.trim() });
      toast(`${d.transaction_number} marked as delivered.`);
    } else {
      if (!reason) return setError("Please choose why the delivery failed.");
      if (reason === "Other" && !note.trim()) return setError("Please explain the reason in the notes.");
      const result = markFailed(d.parcel_id, { reason, note: note.trim() });
      reportFailure(d, { reason, note: note.trim(), result });
      if (result?.outcome === "return_to_hub") {
        toast(
          `${d.transaction_number} reached the ${MAX_RESCHEDULES}-day rescheduling limit and was marked as Return to Hub. Coordinator notified.`,
          "error"
        );
      } else {
        toast(
          `${d.transaction_number} automatically rescheduled for ${formatDay(result?.scheduledFor)} (Day ${result?.rescheduleCount} of ${MAX_RESCHEDULES}).`,
          "info"
        );
      }
    }
    close();
  };

  const tryAgain = (d) => {
    if (d.returnToHub || d.stage === STAGE.RETURN_TO_HUB || Number(d.rescheduleCount || 0) >= MAX_RESCHEDULES) {
      toast("Maximum 3-day rescheduling period reached. This parcel must be returned to the hub.", "error");
      return;
    }
    withdrawFailure(d.parcel_id);
    const ok = reattempt(d.parcel_id);
    if (ok) toast(`${d.transaction_number} moved back to To Be Delivered.`);
  };

  // ---- Mga card
  const deliverCard = (d) => {
    const reschedCount = Number(d.rescheduleCount || 0);
    const isResched = Boolean(d.rescheduled && reschedCount > 0);
    const remainingDays = Math.max(0, MAX_RESCHEDULES - reschedCount);

    return (
      <article key={d.parcel_id} className={card}>
        <CardHead
          d={d}
          badge={
            isResched ? (
              <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-bold text-brand">
                <i className="fa-solid fa-calendar-day mr-1" />
                Rescheduled (Day {reschedCount}/{MAX_RESCHEDULES}) · {formatDay(d.scheduledFor)}
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-[#eaf8ef] px-2.5 py-1 text-[12px] font-bold text-[#29945a]">
                Scheduled · {formatDay(d.scheduledFor || todayIso())}
              </span>
            )
          }
        />

        {isResched && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fff8eb] px-3 py-2 text-[12.5px] text-[#9a6700] dark:bg-[#2d2416] dark:text-[#f6c453]">
            <span>
              <i className="fa-solid fa-bell mr-1.5" />
              Latest Rescheduled Date: <strong>{formatDay(d.scheduledFor)}</strong>
            </span>
            <span className="font-bold">
              {remainingDays > 0
                ? `${remainingDays} reschedule day${remainingDays > 1 ? "s" : ""} remaining`
                : "Final delivery day before Return to Hub"}
            </span>
          </div>
        )}

        {d.lastFailure && (
          <p className="mt-2 text-[13px] font-semibold text-[#d94747]">
            <i className="fa-solid fa-rotate-left mr-1.5" />
            Last attempt failed: {d.lastFailure}
          </p>
        )}

        <AttemptHistory
          attempts={d.attempts}
          rescheduleCount={reschedCount}
          returnToHub={Boolean(d.returnToHub)}
        />

        <div className="mt-3">
          <Navigate address={d.address} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => open("delivered", d)} className={`${btnPrimary} ${bigBtn}`}>
            <i className="fa-solid fa-circle-check" /> Delivered
          </button>
          <button onClick={() => open("failed", d)} className={`${btnGhost} ${bigBtn}`}>
            <i className="fa-solid fa-xmark" /> Failed
          </button>
        </div>
      </article>
    );
  };

  const deliveredCard = (d) => (
    <article key={d.parcel_id} className={`${card} flex flex-col gap-3`}>
      <div className="flex gap-4">
        {d.proof ? (
          <button onClick={() => setViewer(d)} aria-label="View proof of delivery" className="shrink-0">
            <img
              src={d.proof}
              alt="Proof of delivery"
              className="h-[76px] w-[76px] rounded-xl border border-[#eee] object-cover dark:border-night-line"
            />
          </button>
        ) : (
          <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-xl bg-[#f1f1f1] text-[#bbb] dark:bg-night-line">
            <i className="fa-regular fa-image text-[22px]" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 break-words text-[16px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
              {d.receiver || "—"}
            </h3>
            <span className="shrink-0 text-[13px] font-semibold text-[#29945a]">
              {new Date(d.doneAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-[#999]">
            {d.transaction_number}
            {d.seller ? ` · ${d.seller}` : ""}
          </p>
          {d.note && <p className="mt-1.5 text-[13px] text-[#666] dark:text-[#d1c9c2]">“{d.note}”</p>}
          {d.proof && (
            <button onClick={() => setViewer(d)} className="mt-2 text-[13px] font-semibold text-brand hover:underline">
              View proof
            </button>
          )}
        </div>
      </div>
      {d.attempts?.length > 1 && (
        <AttemptHistory attempts={d.attempts} rescheduleCount={d.rescheduleCount} returnToHub={false} />
      )}
    </article>
  );

  const failedCard = (d) => {
    const isReturnToHub = Boolean(d.returnToHub || d.stage === STAGE.RETURN_TO_HUB);
    const f = latestFor(failures, d.parcel_id);

    return (
      <article key={d.parcel_id} className={card}>
        <CardHead
          d={d}
          badge={
            isReturnToHub ? (
              <span className="shrink-0 rounded-full bg-[#f2ecff] px-3 py-1 text-[12px] font-bold text-[#7c3aed]">
                <i className="fa-solid fa-warehouse mr-1.5" />
                Return to Hub
              </span>
            ) : (
              <span className="shrink-0 text-[12.5px] text-[#aaa]">{formatDate(d.doneAt)}</span>
            )
          }
        />

        <div
          className={`mt-3 rounded-xl px-4 py-3 ${
            isReturnToHub
              ? "border border-[#d8b4fe] bg-[#f8f5ff] dark:border-[#5b21b6] dark:bg-[#241b35]"
              : "bg-[#fff1f1] dark:bg-[#3a2626]"
          }`}
        >
          <strong className={`block text-[14.5px] ${isReturnToHub ? "text-[#6d28d9] dark:text-[#c4b5fd]" : "text-[#d94747]"}`}>
            {isReturnToHub
              ? `Undelivered after ${MAX_RESCHEDULES}-day rescheduling limit · Marked as Return to Hub`
              : d.reason || d.lastFailure || "Delivery attempt failed"}
          </strong>
          <span className="mt-1 block text-[13px] text-[#666] dark:text-[#d1c9c2]">
            Last failure reason: <strong>{d.lastFailure || d.reason || "Missed scheduled delivery date"}</strong>
          </span>
          {d.returnCoordinated ? (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#eaf8ef] px-2.5 py-0.5 text-[12px] font-bold text-[#29945a]">
              <i className="fa-solid fa-circle-check" /> Coordinator coordinated return to seller ({d.seller || "Seller"})
            </span>
          ) : isReturnToHub ? (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#fff4d8] px-2.5 py-0.5 text-[12px] font-bold text-[#c98200]">
              <i className="fa-solid fa-bell" /> Coordinator notified · Return parcel to the hub
            </span>
          ) : null}
        </div>

        <AttemptHistory
          attempts={d.attempts}
          rescheduleCount={d.rescheduleCount || MAX_RESCHEDULES}
          returnToHub={isReturnToHub}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Navigate address={d.address} />
          {isReturnToHub && (
            <span className="text-[12px] font-semibold text-[#888]">
              <i className="fa-solid fa-lock mr-1" /> Maximum {MAX_RESCHEDULES}-day limit reached (cannot reschedule again)
            </span>
          )}
        </div>

        {!isReturnToHub && f?.status !== "confirmed" && (
          <button onClick={() => tryAgain(d)} className={`${btnPrimary} ${bigBtn} mt-4`}>
            <i className="fa-solid fa-rotate-left" /> Try again
          </button>
        )}
      </article>
    );
  };

  // ---- Buod sa itaas ng bawat listahan
  const strip = {
    [STAGE.TO_DELIVER]: [
      [`${mine.length} left to deliver`, "text-brand bg-brand-soft"],
      ...(mine.some((d) => d.rescheduled)
        ? [[`${mine.filter((d) => d.rescheduled).length} rescheduled (max ${MAX_RESCHEDULES} days)`, "text-[#c98200] bg-[#fff4d8]"]]
        : []),
    ],
    [STAGE.DELIVERED]: [
      [`Today · ${mine.filter((d) => dayKey(d.doneAt) === new Date().toDateString()).length} delivered`, "text-[#29945a] bg-[#eaf8ef]"],
      [`${mine.length} in total`, "text-[#777] bg-[#f1f1f1]"],
    ],
    [STAGE.FAILED]: [
      [`${mine.filter((d) => d.returnToHub || d.stage === STAGE.RETURN_TO_HUB).length} Return to Hub`, "text-[#7c3aed] bg-[#f2ecff]"],
      ...(mine.some((d) => !d.returnToHub && d.stage === STAGE.FAILED)
        ? [[`${mine.filter((d) => !d.returnToHub && d.stage === STAGE.FAILED).length} failed`, "text-[#d94747] bg-[#fff1f1]"]]
        : []),
    ],
  }[stage];

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
  } else if (stage === STAGE.TO_DELIVER) {
    if (byArea) {
      const groups = new Map();
      shown.forEach((d) => {
        const k = areaOf(d.address);
        groups.set(k, [...(groups.get(k) || []), d]);
      });
      body = [...groups].map(([area, items]) => (
        <div key={area}>
          <GroupTitle count={items.length}>
            <i className="fa-solid fa-map-pin text-brand" /> {area}
          </GroupTitle>
          <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">{items.map(deliverCard)}</div>
        </div>
      ));
    } else {
      body = <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">{shown.map(deliverCard)}</div>;
    }
  } else if (stage === STAGE.DELIVERED) {
    const days = new Map();
    shown.forEach((d) => {
      const k = dayKey(d.doneAt);
      days.set(k, { ts: d.doneAt, items: [...(days.get(k)?.items || []), d] });
    });
    body = [...days].map(([k, g]) => (
      <div key={k}>
        <GroupTitle count={list.filter((d) => dayKey(d.doneAt) === k).length}>{dayLabel(g.ts)}</GroupTitle>
        <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">{g.items.map(deliveredCard)}</div>
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
              tone="text-[#7c3aed]"
            >
              <i className="fa-solid fa-warehouse" /> Return to Hub (3-Day Rescheduling Limit Reached)
            </GroupTitle>
            <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">{rthItems.map(failedCard)}</div>
          </div>
        )}
        {otherFailed.length > 0 && (
          <div>
            <GroupTitle count={otherFailed.length} tone="text-[#d94747]">
              <i className="fa-solid fa-circle-exclamation" /> Failed Attempts
            </GroupTitle>
            <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">{otherFailed.map(failedCard)}</div>
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
        {stage !== STAGE.TO_DELIVER ? (
          <Link to="/rider/parcels?report=1" className={btnGhost}>
            <i className="fa-solid fa-file-lines" /> Generate Report
          </Link>
        ) : (
          <Link to="/rider/scan" className={btnPrimary}>
            <i className="fa-solid fa-qrcode" /> Scan QR Code
          </Link>
        )}
      </Topbar>

      <DeliveryTabs value={stage} onChange={switchTab} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {strip.map(([label, cls]) => (
          <span key={label} className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${cls}`}>
            {label}
          </span>
        ))}
        {stage === STAGE.TO_DELIVER && returnToHubCount > 0 && (
          <button
            type="button"
            onClick={() => switchTab(STAGE.FAILED)}
            className="rounded-full bg-[#f2ecff] px-3.5 py-1.5 text-[13px] font-bold text-[#7c3aed] transition hover:bg-[#e5d8ff]"
          >
            <i className="fa-solid fa-warehouse mr-1.5" />
            {returnToHubCount} Return to Hub (removed from pending) →
          </button>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(STEP);
            }}
            placeholder="Search receiver, address, transaction no."
            aria-label="Search"
            className={`${inputCls} pl-10`}
          />
        </div>
        {stage === STAGE.TO_DELIVER && (
          <button
            onClick={() => setByArea((v) => !v)}
            aria-pressed={byArea}
            className={`${byArea ? btnPrimary : btnGhost} !px-5`}
          >
            <i className="fa-solid fa-map-pin" /> Group by area
          </button>
        )}
      </div>

      <section className={stage === STAGE.TO_DELIVER && list.length === 0 ? `${panel} p-6` : ""}>
        {body}
        {list.length > shown.length && (
          <div className="mt-6 text-center">
            <button onClick={() => setLimit((n) => n + STEP)} className={`${btnGhost} !px-8`}>
              Show more ({list.length - shown.length} left)
            </button>
          </div>
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
              <i className="fa-solid fa-xmark" />
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
                <div
                  className={`mb-4 rounded-xl border p-3.5 text-[13px] ${
                    modalWillReturnToHub
                      ? "border-[#d8b4fe] bg-[#f8f5ff] text-[#6d28d9] dark:border-[#5b21b6] dark:bg-[#241b35] dark:text-[#c4b5fd]"
                      : "border-[#fde68a] bg-[#fffbeb] text-[#92400e] dark:border-[#78350f] dark:bg-[#2d2416] dark:text-[#fcd34d]"
                  }`}
                >
                  {modalWillReturnToHub ? (
                    <>
                      <strong className="block font-bold">
                        <i className="fa-solid fa-warehouse mr-1.5" />
                        3-Day Rescheduling Limit Reached ({MAX_RESCHEDULES}/{MAX_RESCHEDULES} Days)
                      </strong>
                      <p className="mt-1">
                        This parcel has already used all {MAX_RESCHEDULES} rescheduling days. Confirming this failed
                        delivery will automatically mark it as <strong>“Return to Hub”</strong>, remove it from your
                        pending deliveries, and notify the Coordinator.
                      </p>
                    </>
                  ) : (
                    <>
                      <strong className="block font-bold">
                        <i className="fa-solid fa-calendar-check mr-1.5" />
                        Automatic Rescheduling (Day {modalReschedCount + 1} of {MAX_RESCHEDULES})
                      </strong>
                      <p className="mt-1">
                        This parcel will be automatically rescheduled to the next available delivery date:{" "}
                        <strong>{formatDay(modalNextDate)}</strong> ({MAX_RESCHEDULES - (modalReschedCount + 1)}{" "}
                        reschedule day{MAX_RESCHEDULES - (modalReschedCount + 1) === 1 ? "" : "s"} remaining before
                        Return to Hub).
                      </p>
                    </>
                  )}
                </div>

                <label className={labelCls} htmlFor="reason">
                  Failure Reason
                </label>
                <select
                  id="reason"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setError("");
                  }}
                  className={inputCls}
                >
                  <option value="">Select a reason…</option>
                  {FAIL_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-4">
              <label className={labelCls} htmlFor="note">
                Notes {action.type === "failed" && reason === "Other" ? "(required)" : "(optional)"}
              </label>
              <textarea
                id="note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                className={textareaCls}
                placeholder={
                  action.type === "delivered"
                    ? "e.g. Received by the recipient's sister"
                    : "Add details about the delivery attempt if needed"
                }
              />
            </div>

            {error && (
              <div className="mt-4">
                <Notice tone="error" icon="fa-circle-exclamation" role="alert">
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
                  ? "Confirm delivered"
                  : modalWillReturnToHub
                  ? "Confirm & Mark Return to Hub"
                  : `Reschedule to ${formatDay(modalNextDate)}`}
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
              <i className="fa-solid fa-xmark" />
            </button>
            <p className="mb-3 pr-8 text-[14px] font-bold">{viewer.transaction_number} · Proof of delivery</p>
            <img src={viewer.proof} alt="Proof of delivery" className="max-h-[70vh] w-full rounded-xl object-contain" />
            <p className="mt-2 text-[12px] text-[#999]">{formatDate(viewer.doneAt)}</p>
          </>
        )}
      </Modal>
    </>
  );
}
