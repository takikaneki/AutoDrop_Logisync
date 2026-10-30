import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import DeliveryTabs from "../../components/rider/DeliveryTabs.jsx";
import { EmptyState, Modal } from "../../components/ui.jsx";
import { Notice } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, inputCls, labelCls, panel, textareaCls } from "../../components/styles.js";
import { FAIL_REASONS, STAGE, markDelivered, markFailed, reattempt, useMyDeliveries } from "../../store/riderDeliveries.js";
import { compressImage } from "../../utils/image.js";
import { formatDate, formatDay } from "../../utils/format.js";
import { latestFor, reportFailure, useFailedDeliveries, withdrawFailure } from "../../store/failedDeliveries.js";
import { toast } from "../../store/toast.js";

const STEP = 15; // ilang card ang idinadagdag ng "Show more"

// "Navigate" = simpleng link na nagbubukas ng Google Maps sa address (walang API o tracking).
// Ilagay sa false kung ayaw ipakita.
const SHOW_NAVIGATE = true;
const mapsUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const COPY = {
  [STAGE.TO_DELIVER]: { title: "To Be Delivered", subtitle: "Parcels you scanned. Mark each one as delivered (with proof) or failed (with a reason).", icon: "fa-truck-fast", empty: "Nothing to deliver", emptyText: "Scan a parcel's QR code and it will appear here." },
  [STAGE.DELIVERED]: { title: "Delivered", subtitle: "Your delivery history, with proof of delivery.", icon: "fa-circle-check", empty: "No delivered parcels yet", emptyText: "Completed deliveries will be listed here." },
  [STAGE.FAILED]: { title: "Failed Delivery", subtitle: "Parcels you could not deliver, grouped by what happens next.", icon: "fa-triangle-exclamation", empty: "No failed deliveries", emptyText: "Failed attempts and their reasons will be listed here." },
};

// Area ng address para sa "Group by area": Brgy. kung meron, kung wala ay ang huling bahagi (lungsod)
function areaOf(address) {
  const parts = String(address || "").split(",").map((s) => s.trim()).filter(Boolean);
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

const card = "rounded-2xl border border-[#e5e8ee] bg-white p-5 dark:border-night-line dark:bg-night-panel max-[420px]:p-4";
const bigBtn = "!py-3.5 !text-[15px] w-full";

// Resulta ng pagsusuri ng Coordinator sa failed delivery
function Decision({ f }) {
  if (!f || f.status === "withdrawn") return null;
  if (f.status === "pending")
    return <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-[12px] font-semibold text-[#c98200]"><i className="fa-solid fa-hourglass-half mr-1" />Awaiting coordinator</span>;
  if (f.status === "confirmed")
    return <span className="rounded-full bg-[#eaf8ef] px-3 py-1 text-[12px] font-semibold text-[#29945a]"><i className="fa-solid fa-calendar-check mr-1" />Rescheduled · {formatDay(f.scheduledFor)}</span>;
  return (
    <>
      <span className="rounded-full bg-[#f1f1f1] px-3 py-1 text-[12px] font-semibold text-[#777] dark:bg-night-line dark:text-[#d1c9c2]">Not rescheduled</span>
      {f.decisionNote && <span className="mt-1 block text-[13px] text-[#aaa]">{f.decisionNote}</span>}
    </>
  );
}

function Navigate({ address }) {
  if (!SHOW_NAVIGATE || !address) return null;
  return (
    <a href={mapsUrl(address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline">
      <i className="fa-solid fa-location-arrow" /> Navigate
    </a>
  );
}

// Pinagsamang ulo ng card: receiver (malaki), address, at maliit na detalye
function CardHead({ d, badge }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-[18px] font-bold leading-snug text-[#27364f] dark:text-[#f1eeeb]">{d.receiver || "—"}</h3>
        {badge}
      </div>
      {d.address ? (
        <p className="mt-1.5 flex items-start gap-2 text-[14px] text-[#52627a] dark:text-[#d1c9c2]">
          <i className="fa-solid fa-location-dot mt-1 text-brand" /> <span className="min-w-0 break-words">{d.address}</span>
        </p>
      ) : null}
      <p className="mt-2 text-[12.5px] text-[#999]">
        {d.transaction_number}{d.contents ? ` · ${d.contents}` : ""}{d.seller ? ` · ${d.seller}` : ""}{d.contact ? ` · ${d.contact}` : ""}
      </p>
    </>
  );
}

function GroupTitle({ children, count, tone = "" }) {
  return (
    <h2 className={`mb-3 mt-6 flex items-center gap-2 text-[15px] font-bold first:mt-0 ${tone}`}>
      {children} <span className="rounded-full bg-[#f1f1f1] px-2 py-0.5 text-[12px] font-bold text-[#777] dark:bg-night-line dark:text-[#d1c9c2]">{count}</span>
    </h2>
  );
}

// Iisang "Deliveries" page para sa tatlong listahan ng rider: To Be Delivered, Delivered at Failed.
// Ang tab ay nasa URL (?tab=delivered | failed), kaya gumagana ang links galing sa dashboard at notifications.
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

  const mine = useMemo(() => all.filter((d) => d.stage === stage), [all, stage]);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const found = q ? mine.filter((d) => [d.receiver, d.transaction_number, d.address, d.seller, d.contents].some((v) => String(v || "").toLowerCase().includes(q))) : mine;
    return [...found].sort((a, b) => {
      // Rescheduled muna (para hindi makalimutan), tapos ang pinakabago
      if (stage === STAGE.TO_DELIVER && !!a.scheduledFor !== !!b.scheduledFor) return a.scheduledFor ? -1 : 1;
      return (b.doneAt || b.scannedAt || 0) - (a.doneAt || a.scannedAt || 0);
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
      markFailed(d.parcel_id, { reason, note: note.trim() });
      // Ipinapaalam sa Coordinator para siya ang magkumpirma kung ire-reschedule bukas
      reportFailure(d, { reason, note: note.trim() });
      toast(`${d.transaction_number} marked as failed. The coordinator was notified.`, "error");
    }
    close();
  };

  const tryAgain = (d) => {
    withdrawFailure(d.parcel_id);
    reattempt(d.parcel_id);
    toast(`${d.transaction_number} moved back to To Be Delivered.`);
  };

  // ---- Mga card
  const deliverCard = (d) => (
    <article key={d.parcel_id} className={card}>
      <CardHead
        d={d}
        badge={d.scheduledFor ? <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-bold text-brand">Rescheduled · {formatDay(d.scheduledFor)}</span> : null}
      />
      {d.lastFailure && <p className="mt-2 text-[13px] text-[#d94747]"><i className="fa-solid fa-rotate-left mr-1.5" />Last attempt failed: {d.lastFailure}</p>}
      <div className="mt-3"><Navigate address={d.address} /></div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={() => open("delivered", d)} className={`${btnPrimary} ${bigBtn}`}><i className="fa-solid fa-circle-check" /> Delivered</button>
        <button onClick={() => open("failed", d)} className={`${btnGhost} ${bigBtn}`}><i className="fa-solid fa-xmark" /> Failed</button>
      </div>
    </article>
  );

  const deliveredCard = (d) => (
    <article key={d.parcel_id} className={`${card} flex gap-4`}>
      {d.proof ? (
        <button onClick={() => setViewer(d)} aria-label="View proof of delivery" className="shrink-0">
          <img src={d.proof} alt="Proof of delivery" className="h-[76px] w-[76px] rounded-xl border border-[#eee] object-cover dark:border-night-line" />
        </button>
      ) : (
        <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-xl bg-[#f1f1f1] text-[#bbb] dark:bg-night-line"><i className="fa-regular fa-image text-[22px]" /></span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-words text-[16px] font-bold text-[#27364f] dark:text-[#f1eeeb]">{d.receiver || "—"}</h3>
          <span className="shrink-0 text-[13px] font-semibold text-[#29945a]">{new Date(d.doneAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-[#999]">{d.transaction_number}{d.seller ? ` · ${d.seller}` : ""}</p>
        {d.note && <p className="mt-1.5 text-[13px] text-[#666] dark:text-[#d1c9c2]">“{d.note}”</p>}
        {d.proof && <button onClick={() => setViewer(d)} className="mt-2 text-[13px] font-semibold text-brand hover:underline">View proof</button>}
      </div>
    </article>
  );

  const failedCard = (d, group) => {
    const f = latestFor(failures, d.parcel_id);
    return (
      <article key={d.parcel_id} className={card}>
        <CardHead d={d} badge={<span className="shrink-0 text-[12.5px] text-[#aaa]">{formatDate(d.doneAt)}</span>} />
        <div className="mt-3 rounded-xl bg-[#fff1f1] px-4 py-3 dark:bg-[#3a2626]">
          <strong className="block text-[15px] text-[#d94747]">{d.reason}</strong>
          {d.note && <span className="text-[13px] text-[#a06b6b]">{d.note}</span>}
        </div>
        <div className="mt-3"><Decision f={f} /></div>
        <div className="mt-3"><Navigate address={d.address} /></div>
        {group === "action" && (
          <button onClick={() => tryAgain(d)} className={`${btnPrimary} ${bigBtn} mt-4`}><i className="fa-solid fa-rotate-left" /> Try again</button>
        )}
        {group === "waiting" && (
          <button onClick={() => tryAgain(d)} className="mt-4 text-[13px] font-semibold text-brand hover:underline">Cancel report and try again</button>
        )}
      </article>
    );
  };

  // ---- Buod sa itaas ng bawat listahan
  const strip = {
    [STAGE.TO_DELIVER]: [
      [`${mine.length} left to deliver`, "text-brand bg-brand-soft"],
      ...(mine.some((d) => d.scheduledFor) ? [[`${mine.filter((d) => d.scheduledFor).length} rescheduled`, "text-[#c98200] bg-[#fff4d8]"]] : []),
    ],
    [STAGE.DELIVERED]: [
      [`Today · ${mine.filter((d) => dayKey(d.doneAt) === new Date().toDateString()).length} delivered`, "text-[#29945a] bg-[#eaf8ef]"],
      [`${mine.length} in total`, "text-[#777] bg-[#f1f1f1]"],
    ],
    [STAGE.FAILED]: [[`${mine.length} failed`, "text-[#d94747] bg-[#fff1f1]"]],
  }[stage];

  // ---- Ang laman ayon sa stage
  let body;
  if (list.length === 0) {
    body = <EmptyState icon={copy.icon} title={search ? "No parcels match your search" : copy.empty} text={search ? "Try a different name, address or transaction number." : copy.emptyText} />;
  } else if (stage === STAGE.TO_DELIVER) {
    if (byArea) {
      const groups = new Map();
      shown.forEach((d) => {
        const k = areaOf(d.address);
        groups.set(k, [...(groups.get(k) || []), d]);
      });
      body = [...groups].map(([area, items]) => (
        <div key={area}>
          <GroupTitle count={items.length}><i className="fa-solid fa-map-pin text-brand" /> {area}</GroupTitle>
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
    const kind = (d) => {
      const f = latestFor(failures, d.parcel_id);
      if (f?.status === "pending") return "waiting";
      if (f?.status === "confirmed") return "resched";
      return "action";
    };
    const GROUPS = [
      ["action", "Needs your action", "text-[#d94747]", "fa-circle-exclamation"],
      ["waiting", "Waiting for coordinator", "text-[#c98200]", "fa-hourglass-half"],
      ["resched", "Rescheduled", "text-[#29945a]", "fa-calendar-check"],
    ];
    body = GROUPS.map(([k, label, tone, icon]) => {
      const items = shown.filter((d) => kind(d) === k);
      if (!items.length) return null;
      return (
        <div key={k}>
          <GroupTitle count={list.filter((d) => kind(d) === k).length} tone={tone}><i className={`fa-solid ${icon}`} /> {label}</GroupTitle>
          <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">{items.map((d) => failedCard(d, k))}</div>
        </div>
      );
    });
  }

  return (
    <>
      <Topbar title="Deliveries" subtitle={copy.subtitle}>
        {stage !== STAGE.TO_DELIVER ? (
          <Link to="/rider/reports" className={btnGhost}><i className="fa-solid fa-file-lines" /> My Reports</Link>
        ) : (
          <Link to="/rider/scan" className={btnPrimary}><i className="fa-solid fa-qrcode" /> Scan QR Code</Link>
        )}
      </Topbar>

      <DeliveryTabs value={stage} onChange={switchTab} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {strip.map(([label, cls]) => <span key={label} className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${cls}`}>{label}</span>)}
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setLimit(STEP); }}
            placeholder="Search receiver, address, transaction no."
            aria-label="Search"
            className={`${inputCls} pl-10`}
          />
        </div>
        {stage === STAGE.TO_DELIVER && (
          <button onClick={() => setByArea((v) => !v)} aria-pressed={byArea} className={`${byArea ? btnPrimary : btnGhost} !px-5`}>
            <i className="fa-solid fa-map-pin" /> Group by area
          </button>
        )}
      </div>

      <section className={stage === STAGE.TO_DELIVER && list.length === 0 ? `${panel} p-6` : ""}>
        {body}
        {list.length > shown.length && (
          <div className="mt-6 text-center">
            <button onClick={() => setLimit((n) => n + STEP)} className={`${btnGhost} !px-8`}>Show more ({list.length - shown.length} left)</button>
          </div>
        )}
      </section>

      {/* Delivered / Failed */}
      <Modal open={!!action} onClose={close} z="z-[3500]" className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto p-7 dark:bg-night-panel">
        {action && (
          <>
            <button onClick={close} aria-label="Close" className="absolute right-4 top-4 h-8 w-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"><i className="fa-solid fa-xmark" /></button>
            <h3 className="mb-1 pr-8 text-[18px] font-bold">
              {action.type === "delivered" ? "Mark as delivered" : "Mark as failed delivery"}
            </h3>
            <p className="mb-5 text-[13px] text-[#999]">{action.d.transaction_number} · {action.d.receiver}</p>

            {action.type === "delivered" ? (
              <div>
                <label className={labelCls} htmlFor="pod">Proof of delivery (photo)</label>
                <input id="pod" type="file" accept="image/*" capture="environment" onChange={pickPhoto} className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-[13px] file:font-bold file:text-brand" />
                {busy && <p className="mt-2 text-[13px] text-[#999]">Preparing photo…</p>}
                {proof && <img src={proof} alt="Proof preview" className="mt-3 max-h-[220px] w-full rounded-xl border border-[#eee] object-contain dark:border-night-line" />}
              </div>
            ) : (
              <div>
                <label className={labelCls} htmlFor="reason">Reason</label>
                <select id="reason" value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} className={inputCls}>
                  <option value="">Select a reason…</option>
                  {FAIL_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div className="mt-4">
              <label className={labelCls} htmlFor="note">Notes {action.type === "failed" && reason === "Other" ? "(required)" : "(optional)"}</label>
              <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={textareaCls} placeholder={action.type === "delivered" ? "e.g. Received by the recipient's sister" : "Add details if needed"} />
            </div>

            {error && <div className="mt-4"><Notice tone="error" icon="fa-circle-exclamation" role="alert">{error}</Notice></div>}

            <div className="mt-5 flex justify-end gap-2.5">
              <button onClick={close} className={btnGhost}>Cancel</button>
              <button onClick={confirm} disabled={busy} className={btnPrimary}>
                {action.type === "delivered" ? "Confirm delivered" : "Confirm failed"}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Malaking proof */}
      <Modal open={!!viewer} onClose={() => setViewer(null)} z="z-[3500]" className="w-full max-w-[520px] p-5 dark:bg-night-panel">
        {viewer && (
          <>
            <button onClick={() => setViewer(null)} aria-label="Close" className="absolute right-3 top-3 h-8 w-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"><i className="fa-solid fa-xmark" /></button>
            <p className="mb-3 pr-8 text-[14px] font-bold">{viewer.transaction_number} · Proof of delivery</p>
            <img src={viewer.proof} alt="Proof of delivery" className="max-h-[70vh] w-full rounded-xl object-contain" />
            <p className="mt-2 text-[12px] text-[#999]">{formatDate(viewer.doneAt)}</p>
          </>
        )}
      </Modal>
    </>
  );
}
