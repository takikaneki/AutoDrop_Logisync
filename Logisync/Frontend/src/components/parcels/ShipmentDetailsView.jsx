import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRole } from "../../api.js";
import { getVideoUrl, fetchParcelHistory } from "../../services/parcelService.js";
import { getParcelAddress } from "../../store/customers.js";
import { toast } from "../../store/toast.js";
import { formatDate, formatDay, formatSize } from "../../utils/format.js";
import { btnGhost, btnPrimary, panel } from "../styles.js";
import UnifiedQrModal from "../qr/UnifiedQrModal.jsx";
import StatusBadge from "../StatusBadge.jsx";
import Icon from "../Icon.jsx";
import { ActivityListSkeleton, SkeletonBlock } from "../Skeletons.jsx";
import deliveryJourneyImg from "../../assets/delivery-journey.jpg";

function shortParcelId(id) {
  const str = String(id || "").trim();
  if (!str) return "—";
  if (str.length <= 10) return str;
  return `${str.slice(0, 2)}-${str.slice(-6)}`;
}

function deriveOrderId(parcel) {
  if (parcel?.order_id) return String(parcel.order_id);
  const raw = String(parcel?.transaction_number || parcel?.parcel_id || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (!raw) return "—";
  const d = parcel?.created_at ? new Date(parcel.created_at) : null;
  const prefix =
    d && !Number.isNaN(d.getTime())
      ? `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
      : "261029";
  const suffix = raw.slice(-6).padStart(6, "0");
  return `${prefix}V6${suffix}`;
}

function buildShipmentMilestones({ parcel, videos = [], verificationRecords = [], isSeller = false }) {
  const s = String(parcel?.status || "").toUpperCase();
  const isPostVerify = ["VERIFIED", "OUT_FOR_DELIVERY", "RESCHEDULED", "DELIVERED", "RETURN_TO_HUB", "RTH_PENDING", "RTH_CONFIRMED", "DELIVERY_FAILED"].includes(s);
  const hasVideo = videos.length > 0 || ["VIDEO_SUBMITTED", "REJECTED"].includes(s) || isPostVerify;
  const decision = verificationRecords[0] || null;
  const decided = ["REJECTED", "REUPLOAD_REQUESTED"].includes(s) || isPostVerify;
  const isDelivered = s === "DELIVERED" || String(parcel?.delivery_status || "").toUpperCase() === "DELIVERED" || Boolean(parcel?.delivered_at);
  const isFailedDelivery = ["RETURN_TO_HUB", "DELIVERY_FAILED"].includes(s) || Boolean(parcel?.returnToHub);
  const scannedAt = parcel?.scanned_at || parcel?.deliveryRecord?.scannedAt || null;
  const hasRiderScanned = Boolean(
    scannedAt ||
      isDelivered ||
      ["OUT_FOR_DELIVERY", "RESCHEDULED", "RETURN_TO_HUB", "RTH_PENDING", "RTH_CONFIRMED", "DELIVERY_FAILED"].includes(s) ||
      parcel?.delivery_status
  );

  const steps = [
    {
      label: "Parcel registered",
      note: formatDate(parcel?.created_at),
      state: "done",
    },
    {
      label: "Video proof uploaded",
      note: videos[0]?.uploaded_at
        ? formatDate(videos[0].uploaded_at)
        : hasVideo
        ? formatDate(parcel?.updated_at || parcel?.created_at)
        : s === "REUPLOAD_REQUESTED"
        ? "New video requested by coordinator"
        : "Waiting for video upload",
      state: hasVideo ? "done" : "current",
    },
    {
      label: "Coordinator review",
      note: decided ? "Reviewed" : s === "VIDEO_SUBMITTED" ? "In progress" : "Pending",
      state: decided ? "done" : s === "VIDEO_SUBMITTED" ? "current" : "todo",
    },
    {
      label: "Verified",
      note: isPostVerify
        ? formatDate(decision?.verified_at || parcel?.scanned_at || parcel?.updated_at)
        : s === "REJECTED"
        ? decision?.remarks || "Rejected by coordinator"
        : s === "REUPLOAD_REQUESTED"
        ? decision?.remarks || "Re-upload requested"
        : "Pending verification",
      state: isPostVerify ? "done" : ["REJECTED", "REUPLOAD_REQUESTED"].includes(s) ? "fail" : "todo",
    },
    {
      label: "Scanned by rider",
      note: hasRiderScanned
        ? formatDate(scannedAt || parcel?.delivered_at || parcel?.updated_at)
        : isPostVerify
        ? "Waiting for rider scan"
        : "Pending",
      state: hasRiderScanned ? "done" : isPostVerify ? "current" : "todo",
    },
    {
      label: "Delivered to customer",
      note: isDelivered
        ? formatDate(parcel?.delivered_at || parcel?.deliveryRecord?.doneAt || parcel?.updated_at)
        : isFailedDelivery
        ? parcel?.lastFailure || "Delivery unsuccessful"
        : parcel?.rescheduled && parcel?.scheduledFor
        ? `Rescheduled · ${formatDay(parcel.scheduledFor)}`
        : hasRiderScanned
        ? "Out for delivery"
        : "Pending",
      state: isDelivered ? "done" : isFailedDelivery ? "fail" : hasRiderScanned ? "current" : "todo",
    },
  ];
  return isSeller ? steps.slice(0, 4) : steps;
}

function buildLifecycleTimestamps({ parcel, videos = [], verificationRecords = [], isSeller = false }) {
  const s = String(parcel?.status || "").toUpperCase();
  const isPostVerify = ["VERIFIED", "OUT_FOR_DELIVERY", "RESCHEDULED", "DELIVERED", "RETURN_TO_HUB", "RTH_PENDING", "RTH_CONFIRMED", "DELIVERY_FAILED"].includes(s);
  const hasVideo = videos.length > 0 || ["VIDEO_SUBMITTED", "REJECTED"].includes(s) || isPostVerify;
  const decision = verificationRecords[0] || null;
  const isDelivered =
    s === "DELIVERED" ||
    String(parcel?.delivery_status || "").toUpperCase() === "DELIVERED" ||
    Boolean(parcel?.delivered_at);
  const scannedAt = parcel?.scanned_at || parcel?.deliveryRecord?.scannedAt || null;
  const hasRiderScanned = Boolean(
    scannedAt ||
      isDelivered ||
      ["OUT_FOR_DELIVERY", "RESCHEDULED", "RETURN_TO_HUB", "RTH_PENDING", "RTH_CONFIRMED", "DELIVERY_FAILED"].includes(s) ||
      parcel?.delivery_status
  );
  const deliveredAt = parcel?.delivered_at || parcel?.deliveryRecord?.doneAt || (isDelivered ? parcel?.updated_at : null);

  const items = [
    {
      label: "Parcel Created",
      value: parcel?.created_at ? formatDate(parcel.created_at) : "—",
      done: Boolean(parcel?.created_at),
    },
    {
      label: "Video Proof Uploaded",
      value: videos[0]?.uploaded_at
        ? formatDate(videos[0].uploaded_at)
        : hasVideo
        ? formatDate(parcel?.created_at)
        : "Pending",
      done: Boolean(hasVideo),
    },
    {
      label: "Coordinator Verified",
      value: isPostVerify
        ? formatDate(decision?.verified_at || scannedAt || parcel?.updated_at)
        : "Pending",
      done: Boolean(isPostVerify),
    },
    {
      label: "Scanned by Rider",
      value: hasRiderScanned
        ? formatDate(scannedAt || deliveredAt || parcel?.updated_at)
        : "Pending",
      done: Boolean(hasRiderScanned),
    },
    {
      label: "Delivered by Rider",
      value: isDelivered && deliveredAt ? formatDate(deliveredAt) : "Pending",
      done: Boolean(isDelivered && deliveredAt),
    },
  ];
  return isSeller ? items.slice(0, 3) : items;
}

function resolveDeliveryBanner(parcel) {
  const s = String(parcel?.status || "").toUpperCase();
  const delStatus = String(parcel?.delivery_status || "").toUpperCase();
  const rthConfirmed =
    parcel?.rth_status === "CONFIRMED" ||
    s === "RTH_CONFIRMED" ||
    s === "RETURN TO HUB – CONFIRMED" ||
    s === "RETURN TO HUB - CONFIRMED";
  const rthPending =
    parcel?.rth_status === "PENDING_CONFIRMATION" ||
    s === "RTH_PENDING" ||
    s === "RETURN TO HUB – PENDING CONFIRMATION" ||
    s === "RETURN TO HUB - PENDING CONFIRMATION";

  if (rthConfirmed) {
    return {
      status: "Return to Hub – Confirmed",
      timestamp: formatDate(parcel?.rth_confirmed_at || parcel?.updated_at),
      bg: "bg-[#f3e8ff] border-[#d8b4fe] text-[#6b21a8] dark:bg-[#581c87]/30 dark:border-[#9333ea]/40 dark:text-[#d8b4fe]",
      iconBg: "bg-[#7c3aed] text-white",
      icon: "undo-2",
    };
  }

  if (rthPending) {
    return {
      status: "Return to Hub – Pending Confirmation",
      timestamp: formatDate(parcel?.rth_requested_at || parcel?.updated_at),
      bg: "bg-[#fff7ed] border-[#fed7aa] text-[#9a3412] dark:bg-[#7c2d12]/30 dark:border-[#ea580c]/40 dark:text-[#fed7aa]",
      iconBg: "bg-[#ea580c] text-white",
      icon: "history",
    };
  }

  if (s === "DELIVERED" || delStatus === "DELIVERED" || parcel?.delivered_at) {
    return {
      status: "Delivered",
      timestamp: formatDate(parcel?.delivered_at || parcel?.updated_at),
      bg: "bg-[#d6f2e2] border-[#b5e4c9] text-[#145a35] dark:bg-[#145a35]/30 dark:border-[#29945a]/40 dark:text-[#8ce9b5]",
      iconBg: "bg-[#29945a] text-white",
      icon: "check",
    };
  }

  if (
    ["DELIVERY_FAILED", "RETURN_TO_HUB", "REJECTED"].includes(s) ||
    delStatus === "FAILED" ||
    parcel?.returnToHub
  ) {
    return {
      status: "Failed",
      timestamp: formatDate(parcel?.return_to_hub_at || parcel?.updated_at || parcel?.created_at),
      bg: "bg-[#fde8e8] border-[#f6c3c3] text-[#9b2c2c] dark:bg-[#9b2c2c]/30 dark:border-[#d94747]/40 dark:text-[#fca5a5]",
      iconBg: "bg-[#d94747] text-white",
      icon: "x",
    };
  }

  return {
    status: "Rescheduled",
    timestamp: parcel?.scheduledFor
      ? formatDay(parcel.scheduledFor)
      : formatDate(parcel?.updated_at || parcel?.created_at),
    bg: "bg-[#fff2d6] border-[#f5d598] text-[#8a4f00] dark:bg-[#8a4f00]/30 dark:border-[#c98200]/40 dark:text-[#fcd34d]",
    iconBg: "bg-[#d98218] text-white",
    icon: "clock",
  };
}

function DeliveryJourneyIllustration({ compact = false }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[#efe4d6] bg-[#faf4ec] shadow-xs dark:border-night-line dark:bg-night-head"
      aria-label="Delivery journey illustration from SPX Hub to Customer"
    >
      <div className="relative w-full overflow-hidden">
        <img
          src={deliveryJourneyImg}
          alt="SPX Hub to Rider to Customer delivery route"
          className={`block w-full object-cover select-none ${
            compact ? "aspect-[16/9]" : "aspect-[4/3]"
          } dark:brightness-95`}
          loading="lazy"
          draggable={false}
        />
        {/* Clean stage pill badges */}
        <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md border border-[#e7dac8]/90 bg-white/90 px-2 py-0.5 text-[10.5px] font-bold text-[#1e293b] shadow-2xs backdrop-blur-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c]" />
          SPX Hub
        </span>
        <span className="pointer-events-none absolute left-1/2 top-[63%] -translate-x-1/2 inline-flex items-center gap-1 rounded-md border border-[#fed7aa]/90 bg-white/92 px-2 py-0.5 text-[10.5px] font-bold text-[#c2410c] shadow-2xs backdrop-blur-xs">
          Rider
        </span>
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-md border border-[#e7dac8]/90 bg-white/90 px-2 py-0.5 text-[10.5px] font-bold text-[#1e293b] shadow-2xs backdrop-blur-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
          Customer
        </span>
      </div>
    </div>
  );
}

function SidebarWidgets({ parcel, lifecycleTimestamps = [], compactIllustration = false }) {
  const banner = resolveDeliveryBanner(parcel);
  const receiverName = parcel?.receiver_name || parcel?.recipient_name || parcel?.receiver || "—";
  const receiverContact = parcel?.receiver_contact || parcel?.contact || "—";
  const riderName =
    parcel?.rider_name ||
    parcel?.assigned_rider_name ||
    parcel?.rider?.name ||
    parcel?.deliveryRecord?.rider_name ||
    "Unassigned";
  const riderContact =
    parcel?.rider_contact ||
    parcel?.rider_phone ||
    parcel?.rider?.phone ||
    parcel?.deliveryRecord?.rider_contact ||
    "—";

  return (
    <div className="space-y-3">
      {/* A. Decorative Delivery Illustration */}
      <DeliveryJourneyIllustration compact={compactIllustration} />

      {/* B. Single Delivery Status Indicator */}
      <div className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 shadow-sm ${banner.bg}`}>
        <div className="min-w-0">
          <p className="text-[14.5px] font-extrabold leading-tight">{banner.status}</p>
          <p className="mt-0.5 truncate text-[11.5px] font-medium opacity-85">{banner.timestamp}</p>
        </div>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] shadow-sm ${banner.iconBg}`}>
          <Icon name={banner.icon} />
        </span>
      </div>

      {/* C. Receiver Information Card */}
      <section className="rounded-2xl border border-[#eceef2] bg-white p-3.5 shadow-sm dark:border-night-line dark:bg-night-panel">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fff0e5] text-[#d97736] dark:bg-brand/15">
            <Icon name="user-round" className="text-[11px]" />
          </span>
          <h3 className="text-[13px] font-bold text-[#1e293b] dark:text-white">Receiver Information</h3>
        </div>
        <div className="space-y-1.5 pl-8 text-[12px]">
          <div>
            <span className="block text-[10.5px] text-[#8a94a6] dark:text-[#9c948c]">Name</span>
            <strong className="block break-words font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
              {receiverName}
            </strong>
          </div>
          <div>
            <span className="block text-[10.5px] text-[#8a94a6] dark:text-[#9c948c]">Contact Number</span>
            <strong className="block font-mono font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
              {receiverContact}
            </strong>
          </div>
        </div>
      </section>

      {/* D. Rider Information Card */}
      <section className="rounded-2xl border border-[#eceef2] bg-white p-3.5 shadow-sm dark:border-night-line dark:bg-night-panel">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fff0e5] text-[#d97736] dark:bg-brand/15">
            <Icon name="bike" className="text-[11px]" />
          </span>
          <h3 className="text-[13px] font-bold text-[#1e293b] dark:text-white">Rider Information</h3>
        </div>
        <div className="space-y-1.5 pl-8 text-[12px]">
          <div>
            <span className="block text-[10.5px] text-[#8a94a6] dark:text-[#9c948c]">Name</span>
            <strong className="block break-words font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
              {riderName}
            </strong>
          </div>
          <div>
            <span className="block text-[10.5px] text-[#8a94a6] dark:text-[#9c948c]">Contact Number</span>
            <strong className="block font-mono font-semibold text-[#1e293b] dark:text-[#f1eeeb]">
              {riderContact}
            </strong>
          </div>
        </div>
      </section>

      {/* E. Parcel Lifecycle Timestamps Card (Created -> Scanned by Rider -> Delivered) */}
      {lifecycleTimestamps.length > 0 && (
        <section className="rounded-2xl border border-[#eceef2] bg-white p-3.5 shadow-sm dark:border-night-line dark:bg-night-panel">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fff0e5] text-[#d97736] dark:bg-brand/15">
              <Icon name="clock" className="text-[11px]" />
            </span>
            <h3 className="text-[13px] font-bold text-[#1e293b] dark:text-white">Shipment Timestamps</h3>
          </div>
          <dl className="space-y-2 text-[11.5px]">
            {lifecycleTimestamps.map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-2 border-b border-[#f1f4f8] pb-1.5 last:border-b-0 last:pb-0 dark:border-night-line"
              >
                <dt className="flex items-center gap-1.5 text-[#64748b] dark:text-[#9c948c]">
                  <span
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      item.done ? "bg-[#29945a]" : "bg-[#cbd5e1] dark:bg-night-line"
                    }`}
                  />
                  <span>{item.label}</span>
                </dt>
                <dd
                  className={`text-right font-mono text-[11px] ${
                    item.done
                      ? "font-semibold text-[#1e293b] dark:text-[#f1eeeb]"
                      : "font-medium text-[#94a3b8] dark:text-[#7c756e]"
                  }`}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

export default function ShipmentDetailsView({
  parcel,
  videos = [],
  verificationRecords = [],
  backTo = "/seller/parcels",
  backLabel = "Back to Parcel Records",
  onBack = null,
  canUpload = false,
  uploadProps = null,
  coordinatorSlot = null,
}) {
  const [activeTab, setActiveTab] = useState("shipment");
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (activeTab === "history" && !historyLoaded) {
      const targetId = parcel?.parcel_id || parcel?.transaction_number;
      if (!targetId) return;
      setHistoryLoading(true);
      fetchParcelHistory(targetId)
        .then((res) => {
          if (res?.success) setHistoryList(res.history || []);
        })
        .catch(() => {})
        .finally(() => {
          setHistoryLoading(false);
          setHistoryLoaded(true);
        });
    }
  }, [activeTab, historyLoaded, parcel]);

  // Video & Photo modal viewer states
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  const isSeller = String(getRole() || "").toLowerCase() === "seller";
  const milestones = buildShipmentMilestones({ parcel, videos, verificationRecords, isSeller });
  const lifecycleTimestamps = buildLifecycleTimestamps({ parcel, videos, verificationRecords, isSeller });

  const fullAddress =
    getParcelAddress(parcel) ||
    parcel?.receiver_address ||
    parcel?.address ||
    [
      parcel?.receiver_house_number,
      parcel?.receiver_street,
      parcel?.receiver_barangay,
      parcel?.receiver_city,
      parcel?.receiver_province,
    ]
      .filter(Boolean)
      .join(", ") ||
    "—";

  const categoryDisplay = parcel?.content_category
    ? parcel.content_category === "Other" && parcel.other_category_description
      ? `Other (${parcel.other_category_description})`
      : parcel.content_category
    : "Unspecified";

  const discreetStatusLabel = parcel?.discrete_item
    ? parcel.discreet_status === "APPROVED"
      ? "Yes - Approved by Coordinator"
      : parcel.discreet_status === "REJECTED"
      ? "Yes - Rejected by Coordinator (Standard handling)"
      : "Yes - Pending Coordinator Review"
    : "No - Standard handling";

  const scheduledDateLabel =
    parcel?.scheduledFor && !parcel?.returnToHub
      ? formatDay(parcel.scheduledFor)
      : parcel?.scheduled_for && !parcel?.return_to_hub
      ? formatDay(parcel.scheduled_for)
      : formatDay(parcel?.created_at);

  const orderId = deriveOrderId(parcel);

  const handleCopyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      toast(`Order ID ${orderId} copied to clipboard.`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Unable to copy Order ID.", "error");
    }
  };

  const latestVideo = videos[0] || null;
  const proofPhotoSrc = parcel?.delivery_proof || parcel?.deliveryRecord?.proof || "";
  const isDelivered =
    String(parcel?.status || "").toUpperCase() === "DELIVERED" ||
    String(parcel?.delivery_status || "").toUpperCase() === "DELIVERED" ||
    Boolean(parcel?.delivered_at);
  const proofTimestamp =
    parcel?.delivered_at ||
    parcel?.deliveryRecord?.doneAt ||
    (proofPhotoSrc ? parcel?.updated_at : null);

  const handleViewVideo = async () => {
    if (!latestVideo) {
      toast("No video proof has been uploaded for this parcel yet.", "error");
      return;
    }
    setVideoModalOpen(true);
    setVideoError("");
    if (latestVideo.file_path && /^https?:\/\//i.test(latestVideo.file_path)) {
      setVideoSrc(latestVideo.file_path);
      return;
    }
    if (!latestVideo.video_id) {
      setVideoError("Video preview URL is unavailable.");
      return;
    }
    setVideoLoading(true);
    try {
      const url = await getVideoUrl(latestVideo.video_id);
      setVideoSrc(url);
    } catch (err) {
      setVideoError(err.message || "Unable to load video proof.");
    } finally {
      setVideoLoading(false);
    }
  };

  const handleViewPhoto = () => {
    if (!proofPhotoSrc && !isDelivered) {
      toast("Proof of delivery photo is not available yet.", "error");
      return;
    }
    setPhotoModalOpen(true);
  };

  const TABS = [
    { id: "shipment", label: "Shipment" },
    { id: "details", label: "Details" },
    { id: "history", label: "Movement History", icon: "history" },
    { id: "documents", label: "Documents", icon: "file-text" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* MAIN CENTER CONTENT COLUMN */}
        <div className="min-w-0 flex-1">
          {/* Header: Back to Parcel Records + Shipment Details (No Instructions button) */}
          <div className="mb-4">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#64748b] transition hover:text-brand dark:text-[#b8b0a8]"
              >
                <Icon name="chevron-left" className="text-[10px]" />
                <span>{backLabel}</span>
              </button>
            ) : (
              <Link
                to={backTo}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#64748b] transition hover:text-brand dark:text-[#b8b0a8]"
              >
                <Icon name="chevron-left" className="text-[10px]" />
                <span>{backLabel}</span>
              </Link>
            )}
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-[24px] sm:text-[26px] font-extrabold tracking-tight text-[#1e293b] dark:text-white">
                Shipment Details
              </h1>
              <button
                type="button"
                onClick={() => setQrModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-[13px] font-bold text-orange-700 shadow-sm transition hover:bg-orange-100 dark:border-brand/40 dark:bg-brand/10 dark:text-orange-300"
              >
                <Icon name="qr-code" />
                <span>View Unified QR Code</span>
              </button>
            </div>
          </div>

          {/* 4 Tabs directly below the page heading — strictly single-line & aligned across mobile and desktop */}
          <div
            role="tablist"
            aria-label="Shipment Details Tabs"
            className="mb-5 flex items-center justify-between sm:justify-start gap-2 sm:gap-6 overflow-x-auto no-scrollbar border-b border-[#e5e7eb] dark:border-night-line"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap pb-3 text-[12.5px] sm:text-[14px] leading-none font-semibold transition ${
                    active
                      ? "text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-[2.5px] after:rounded-t-full after:bg-brand"
                      : "text-[#64748b] hover:text-[#1e293b] dark:text-[#9c948c] dark:hover:text-white"
                  }`}
                >
                  {tab.icon && <Icon name={tab.icon} className="text-[12px] sm:text-[13px] max-[390px]:hidden" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: SHIPMENT (Progress Timeline ONLY on desktop; stacked with sidebar widgets on mobile) */}
          {activeTab === "shipment" && (
            <div className="space-y-4">
              <section className={`${panel} p-6 max-[600px]:p-4`}>
                <h2 className="mb-5 text-[16px] font-bold text-[#1e293b] dark:text-white">
                  Progress Timeline
                </h2>

                <ol className="relative space-y-5">
                  {milestones.map((step, idx, arr) => {
                    const isDone = step.state === "done";
                    const isCurrent = step.state === "current";
                    const isFail = step.state === "fail";

                    const circleCls = isDone
                      ? "bg-[#29945a] text-white border-[#29945a]"
                      : isFail
                      ? "bg-[#d94747] text-white border-[#d94747]"
                      : isCurrent
                      ? "bg-[#29945a] text-white border-[#29945a] ring-4 ring-[#29945a]/15"
                      : "bg-[#e5e7eb] text-[#94a3b8] border-[#d1d5db] dark:bg-night-head dark:border-night-line";

                    const icon = isDone
                      ? "check"
                      : isFail
                      ? "x"
                      : isCurrent
                      ? "check"
                      : "circle";

                    return (
                      <li key={step.label} className="relative flex items-start gap-3.5">
                        {idx < arr.length - 1 && (
                          <span
                            aria-hidden="true"
                            className={`absolute left-[11px] top-6 h-[calc(100%+4px)] w-[2px] ${
                              isDone ? "bg-[#29945a]" : "bg-[#e2e8f0] dark:bg-night-line"
                            }`}
                          />
                        )}
                        <span
                          className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${circleCls}`}
                        >
                          <Icon name={icon} className={icon === "circle" ? "h-2 w-2" : "h-3 w-3"} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-bold leading-snug text-[#1e293b] dark:text-white">
                            {step.label}
                          </p>
                          {step.note && (
                            <p className="mt-0.5 text-[12.5px] text-[#64748b] dark:text-[#9c948c]">
                              {step.note}
                            </p>
                          )}
                          {canUpload && step.label === "Video proof uploaded" && !videos.length && (
                            <button
                              type="button"
                              onClick={() => setActiveTab("documents")}
                              className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-bold text-brand hover:underline"
                            >
                              <Icon name="upload" />
                              Upload packing video in Documents tab
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              {/* Mobile-only stack under Shipment tab: Illustration, Status Indicator, Receiver Info, Rider Info, Lifecycle Timestamps */}
              <div className="lg:hidden">
                <SidebarWidgets
                  parcel={parcel}
                  lifecycleTimestamps={lifecycleTimestamps}
                  compactIllustration
                />
              </div>
            </div>
          )}

          {/* TAB 2: DETAILS (ONE single unified continuous card with ONLY "Parcel Info" orange heading + Order ID block) */}
          {activeTab === "details" && (
            <div className="space-y-4">
              <section className={`${panel} p-6 max-[600px]:p-4`}>
                {/* ONLY ONE orange section heading at the top of the card */}
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fff0e5] text-brand dark:bg-brand/15">
                    <Icon name="package" className="text-xs" />
                  </span>
                  <h2 className="text-[16px] font-bold text-brand">Parcel Info</h2>
                </div>

                {/* Group 1: Parcel ID & Transaction Number */}
                <div className="grid grid-cols-1 gap-4 border-b border-[#edf0f4] pb-4 sm:grid-cols-2 dark:border-night-line">
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Parcel ID</span>
                    <strong
                      className="mt-0.5 block break-all font-mono text-[13.5px] font-bold text-[#1e293b] dark:text-white"
                      title={parcel?.parcel_id || parcel?.id || ""}
                    >
                      {shortParcelId(parcel?.parcel_id || parcel?.id)}
                    </strong>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Transaction Number</span>
                    <strong className="mt-0.5 block break-all font-mono text-[13.5px] font-bold text-[#1e293b] dark:text-white">
                      {parcel?.transaction_number || "—"}
                    </strong>
                  </div>
                </div>

                {/* Group 2: Receiver Name, Contact Number, Complete Delivery Address */}
                <div className="grid grid-cols-1 gap-4 border-b border-[#edf0f4] py-4 sm:grid-cols-2 dark:border-night-line">
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Receiver Name</span>
                    <strong className="mt-0.5 block break-words text-[13.5px] font-bold text-[#1e293b] dark:text-white">
                      {parcel?.receiver_name || parcel?.recipient_name || "—"}
                    </strong>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Contact Number</span>
                    <strong className="mt-0.5 block font-mono text-[13.5px] font-bold text-[#1e293b] dark:text-white">
                      {parcel?.receiver_contact || "—"}
                    </strong>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Complete Delivery Address</span>
                    <strong className="mt-0.5 block break-words text-[13.5px] font-bold text-[#1e293b] dark:text-white">
                      {fullAddress}
                    </strong>
                  </div>
                </div>

                {/* Group 3: Declared Category, Item Description, Discreet Handling Request, Scheduled Delivery Date, Created Date, Last Updated */}
                <div className="grid grid-cols-1 gap-4 border-b border-[#edf0f4] py-4 sm:grid-cols-2 dark:border-night-line">
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Declared Category</span>
                    <strong className="mt-0.5 block break-words text-[13.5px] font-bold text-[#1e293b] dark:text-white">
                      {categoryDisplay}
                    </strong>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Item Description</span>
                    <strong className="mt-0.5 block break-words text-[13.5px] font-bold text-[#1e293b] dark:text-white">
                      {parcel?.contents || parcel?.item || "—"}
                    </strong>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Discreet Handling Request</span>
                    <strong className="mt-0.5 block break-words text-[13.5px] font-bold text-[#1e293b] dark:text-white">
                      {discreetStatusLabel}
                    </strong>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Scheduled Delivery Date</span>
                    <strong className="mt-0.5 block text-[13.5px] font-bold text-[#1e293b] dark:text-white">
                      {scheduledDateLabel}
                    </strong>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Created Date</span>
                    <strong className="mt-0.5 block text-[13.5px] font-bold text-[#1e293b] dark:text-white">
                      {formatDate(parcel?.created_at)}
                    </strong>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[12px] text-[#64748b] dark:text-[#9c948c]">Last Updated</span>
                    <strong className="mt-0.5 block text-[13.5px] font-bold text-[#1e293b] dark:text-white">
                      {formatDate(parcel?.updated_at)}
                    </strong>
                  </div>
                </div>

                {/* Order ID & Chronological Lifecycle Timestamps inside the same continuous card */}
                <div className="pt-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-[14px] font-extrabold text-[#1e293b] dark:text-white">
                      Order ID: <span className="font-mono">{orderId}</span>
                    </strong>
                    <button
                      type="button"
                      onClick={handleCopyOrderId}
                      className="rounded-md border border-[#d5dbe3] bg-[#fafbfc] px-3 py-1 text-[12px] font-semibold text-[#475569] transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-head dark:text-[#d1c9c2]"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <dl className="space-y-2.5 text-[13px]">
                    {lifecycleTimestamps.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-4">
                        <dt className="flex items-center gap-2 text-[#64748b] dark:text-[#9c948c]">
                          <span
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                              item.done ? "bg-[#29945a]" : "bg-[#cbd5e1] dark:bg-night-line"
                            }`}
                          />
                          <span>{item.label}</span>
                        </dt>
                        <dd
                          className={`text-right font-mono ${
                            item.done
                              ? "font-semibold text-[#1e293b] dark:text-white"
                              : "font-medium text-[#94a3b8] dark:text-[#7c756e]"
                          }`}
                        >
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              {coordinatorSlot}
            </div>
          )}

          {/* TAB: MOVEMENT HISTORY (Immutable Audit & Movement Timeline) */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <section className={`${panel} p-6 max-[600px]:p-4`}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-[#e5e7eb] pb-3 dark:border-night-line">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[16px] font-bold leading-snug text-[#1e293b] dark:text-white">
                      Parcel Movement & Audit History
                    </h2>
                    <p className="mt-0.5 text-[12px] text-[#64748b] dark:text-[#9c948c]">
                      Immutable audit log of all status transitions, actors, and hub confirmations.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1 font-mono text-[11.5px] font-bold text-[#475569] dark:bg-night-head dark:text-[#d1c9c2]">
                    {parcel?.transaction_number || parcel?.parcel_id}
                  </span>
                </div>

                {historyLoading ? (
                  <ActivityListSkeleton count={4} label="Loading movement history" />
                ) : historyList.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-[#64748b]">
                    <Icon name="history" className="mb-2 block text-2xl text-[#94a3b8]" />
                    No movement events recorded yet.
                  </div>
                ) : (
                  <ol className="relative space-y-4">
                    {historyList.map((item, idx, arr) => (
                      <li key={item.history_id || idx} className="relative flex items-start gap-3">
                        {idx < arr.length - 1 && (
                          <span
                            aria-hidden="true"
                            className="absolute left-[9px] top-5 h-[calc(100%+4px)] w-[2px] bg-[#e2e8f0] dark:bg-night-line"
                          />
                        )}
                        <span className="relative z-10 mt-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15">
                          <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                        </span>
                        <div className="min-w-0 flex-1 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-3.5 dark:border-night-line dark:bg-night-soft">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[14px] font-bold text-[#1e293b] dark:text-white">
                              {item.previous_status ? `${item.previous_status} → ` : ""}{item.new_status}
                            </span>
                            <span className="text-[11.5px] text-[#64748b] dark:text-[#9c948c]">
                              {formatDate(item.created_at)}
                            </span>
                          </div>

                          <div className="mt-1.5 text-[12px] text-[#64748b] dark:text-[#9c948c]">
                            Action by: <strong className="text-[#334155] dark:text-[#e2e8f0]">{item.actor_name || "System"}</strong> ({item.actor_role || "User"} #{item.actor_id || "—"})
                          </div>

                          {item.reason && (
                            <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-800 dark:bg-red-950/30 dark:text-red-300">
                              <Icon name="triangle-alert" className="mr-1.5" />
                              Reason: {item.reason}
                            </div>
                          )}

                          {item.notes && (
                            <p className="mt-1.5 text-[12px] italic text-[#475569] dark:text-[#cbd5e1]">
                              "{item.notes}"
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}

          {/* TAB 3: DOCUMENTS (Submitted Video; Proof of Delivery hidden for sellers) */}
          {activeTab === "documents" && (
            <div className="space-y-4">
              <div className={`grid grid-cols-1 gap-5 ${isSeller ? "max-w-[540px]" : "md:grid-cols-2"}`}>
                {/* 1. Submitted Video Card */}
                <section className={`${panel} flex flex-col p-5`}>
                  <h2 className="mb-3.5 text-[15.5px] font-bold text-[#1e293b] dark:text-white">
                    Submitted Video
                  </h2>

                  <button
                    type="button"
                    onClick={handleViewVideo}
                    aria-label="Preview Submitted Video"
                    className="group relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#262220] text-left focus:outline-none dark:border-night-line"
                  >
                    {latestVideo?.file_path && /^https?:\/\//i.test(latestVideo.file_path) ? (
                      <video
                        src={latestVideo.file_path}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover opacity-85 transition group-hover:scale-[1.02]"
                      />
                    ) : (
                      <svg viewBox="0 0 320 200" className="h-full w-full object-cover" aria-hidden="true">
                        <defs>
                          <linearGradient id="vidBg" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#3b322c" />
                            <stop offset="100%" stopColor="#1f1b18" />
                          </linearGradient>
                        </defs>
                        <rect width="320" height="200" fill="url(#vidBg)" />
                        {/* Stylized cardboard parcel box preview */}
                        <polygon points="95,75 160,50 225,75 160,100" fill="#d3a176" />
                        <polygon points="95,75 160,100 160,158 95,130" fill="#b88458" />
                        <polygon points="225,75 160,100 160,158 225,130" fill="#9c6b43" />
                        <line x1="127" y1="62" x2="192" y2="87" stroke="#f3e5d7" strokeWidth="5" opacity="0.7" />
                      </svg>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-[#1e293b] shadow-md backdrop-blur-sm transition group-hover:scale-105">
                        <Icon name="play" className="ml-0.5 text-sm" />
                      </span>
                    </span>
                  </button>

                  <div className="mt-3.5 space-y-1.5 text-[13px]">
                    <p className="flex items-center gap-2 font-semibold text-[#1e293b] dark:text-white">
                      <Icon name="file-video" className="text-[#64748b]" />
                      <span className="truncate">{latestVideo?.file_name || "parcel_proof_video.mp4"}</span>
                    </p>
                    <p className="flex items-center gap-2 text-[12px] text-[#64748b] dark:text-[#9c948c]">
                      <Icon name="clock" />
                      <span>
                        {latestVideo?.uploaded_at
                          ? formatDate(latestVideo.uploaded_at)
                          : "No video uploaded yet"}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleViewVideo}
                    className="mt-4 w-full rounded-xl border border-[#b68a6e] bg-white py-2 text-[13px] font-semibold text-[#2d3748] transition hover:border-brand hover:bg-[#fff8f3] hover:text-brand dark:border-night-line dark:bg-night-head dark:text-white"
                  >
                    View Video
                  </button>

                  {/* Preserve Seller video upload workflow when parcel is waiting for video or reupload */}
                  {canUpload && uploadProps && (
                    <div className="mt-4 border-t border-[#edf0f4] pt-4 dark:border-night-line">
                      <p className="mb-2 text-[12.5px] font-bold text-[#1e293b] dark:text-white">
                        {parcel?.status === "REUPLOAD_REQUESTED" ? "Upload New Packing Video" : "Upload Packing Video"}
                      </p>
                      <input
                        ref={uploadProps.inputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg"
                        onChange={uploadProps.onPick}
                        disabled={uploadProps.uploading}
                        aria-label="Choose video"
                        className="block w-full text-[12.5px] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-white hover:file:bg-brand-dark"
                      />
                      {uploadProps.fileError && (
                        <p role="alert" className="mt-1.5 text-[12px] text-[#d94747]">
                          {uploadProps.fileError}
                        </p>
                      )}
                      {uploadProps.file && (
                        <div className="mt-1.5 flex items-center justify-between text-[12px] text-[#64748b]">
                          <p>
                            <strong>{uploadProps.file.name}</strong> · {formatSize(uploadProps.file.size)}
                          </p>
                          {uploadProps.onClear && !uploadProps.uploading && (
                            <button
                              type="button"
                              onClick={uploadProps.onClear}
                              className="text-[11px] font-semibold text-[#d94747] hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                      {uploadProps.uploading && (
                        <div className="mt-2">
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#eee] dark:bg-night-line">
                            <div
                              className="h-full bg-brand transition-all"
                              style={{ width: `${uploadProps.progress}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-[#888]">Uploading… {uploadProps.progress}%</p>
                        </div>
                      )}
                      {uploadProps.uploadError && (
                        <p role="alert" className="mt-1.5 text-[12px] text-[#d94747]">
                          {uploadProps.uploadError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={uploadProps.onUpload}
                        disabled={!uploadProps.file || uploadProps.uploading}
                        className={`${btnPrimary} mt-3 w-full justify-center py-2 text-[13px]`}
                      >
                        <Icon name="upload" />{" "}
                        {uploadProps.uploading ? "Uploading…" : "Submit Video"}
                      </button>
                    </div>
                  )}
                </section>

                {/* 2. Proof of Delivery Card (hidden for Seller role) */}
                {!isSeller && (
                <section className={`${panel} flex flex-col p-5`}>
                  <h2 className="mb-3.5 text-[15.5px] font-bold text-[#1e293b] dark:text-white">
                    Proof of Delivery
                  </h2>

                  <button
                    type="button"
                    onClick={handleViewPhoto}
                    aria-label="Preview Proof of Delivery"
                    className="group relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#e9ecef] text-left focus:outline-none dark:border-night-line"
                  >
                    {proofPhotoSrc ? (
                      <img
                        src={proofPhotoSrc}
                        alt="Proof of delivery"
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    ) : (
                      <svg viewBox="0 0 320 200" className="h-full w-full object-cover" aria-hidden="true">
                        {/* Stylized doorstep parcel proof preview */}
                        <rect width="320" height="145" fill="#d8dee6" />
                        <rect x="75" y="15" width="170" height="130" fill="#5b6b79" />
                        <rect x="92" y="28" width="60" height="52" fill="#485662" />
                        <rect x="168" y="28" width="60" height="52" fill="#485662" />
                        <rect y="145" width="320" height="55" fill="#a58262" />
                        <rect x="88" y="148" width="144" height="24" rx="2" fill="#7d5d3b" />
                        {/* Parcel box at doorstep */}
                        <rect x="126" y="102" width="68" height="54" rx="3" fill="#d7a679" stroke="#b38256" strokeWidth="2" />
                        <rect x="136" y="114" width="24" height="14" rx="1" fill="#fff" opacity="0.85" />
                      </svg>
                    )}
                  </button>

                  <div className="mt-3.5 space-y-1.5 text-[13px]">
                    <p className="flex items-center gap-2 font-semibold text-[#1e293b] dark:text-white">
                      <Icon name="image" className="text-[#64748b]" />
                      <span className="truncate">
                        {proofPhotoSrc || isDelivered ? "delivery_proof_photo.jpg" : "delivery_proof_photo.jpg"}
                      </span>
                    </p>
                    <p className="flex items-center gap-2 text-[12px] text-[#64748b] dark:text-[#9c948c]">
                      <Icon name="clock" />
                      <span>
                        {proofTimestamp ? formatDate(proofTimestamp) : "Pending delivery completion"}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleViewPhoto}
                    className="mt-4 w-full rounded-xl border border-[#b68a6e] bg-white py-2 text-[13px] font-semibold text-[#2d3748] transition hover:border-brand hover:bg-[#fff8f3] hover:text-brand dark:border-night-line dark:bg-night-head dark:text-white"
                  >
                    View Photo
                  </button>
                </section>
                )}
              </div>
            </div>
          )}
        </div>

        {/* COLLAPSIBLE RIGHT SIDEBAR (Desktop >= 1024px) */}
        <aside
          aria-label="Delivery summary sidebar"
          className={`relative hidden lg:block shrink-0 border-l border-[#eceef2] pl-5 transition-all duration-200 dark:border-night-line ${
            rightCollapsed ? "w-6 pl-2" : "w-[300px] xl:w-[320px]"
          }`}
        >
          <button
            type="button"
            onClick={() => setRightCollapsed((v) => !v)}
            aria-expanded={!rightCollapsed}
            aria-label={rightCollapsed ? "Expand delivery sidebar" : "Collapse delivery sidebar"}
            title={rightCollapsed ? "Expand panel" : "Collapse panel"}
            className="absolute -left-4 top-20 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[#e2e8f0] bg-white text-[#64748b] shadow-md transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
          >
            <Icon name={rightCollapsed ? "chevrons-left" : "chevrons-right"} className="h-3.5 w-3.5" />
          </button>

          {!rightCollapsed && (
            <SidebarWidgets parcel={parcel} lifecycleTimestamps={lifecycleTimestamps} />
          )}
        </aside>
      </div>

      {/* Video Player Modal */}
      {videoModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]"
          onClick={() => setVideoModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Submitted Video Preview"
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-night-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#eee] px-5 py-3.5 dark:border-night-line">
              <strong className="text-[15px] text-[#1e293b] dark:text-white">
                {latestVideo?.file_name || "Submitted Video"}
              </strong>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                aria-label="Close video modal"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] dark:hover:bg-night-head"
              >
                <Icon name="x" />
              </button>
            </div>
            <div className="p-5">
              {videoLoading ? (
                <SkeletonBlock className="h-[320px] w-full rounded-xl" />
              ) : videoError ? (
                <p className="py-12 text-center text-sm text-[#d94747]">{videoError}</p>
              ) : videoSrc ? (
                <video src={videoSrc} controls autoPlay className="max-h-[70vh] w-full rounded-xl bg-black" />
              ) : (
                <p className="py-12 text-center text-sm text-[#64748b]">Video stream unavailable.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Proof of Delivery Photo Modal */}
      {photoModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]"
          onClick={() => setPhotoModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Proof of Delivery Photo"
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-night-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#eee] px-5 py-3.5 dark:border-night-line">
              <strong className="text-[15px] text-[#1e293b] dark:text-white">Proof of Delivery</strong>
              <button
                type="button"
                onClick={() => setPhotoModalOpen(false)}
                aria-label="Close photo modal"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] dark:hover:bg-night-head"
              >
                <Icon name="x" />
              </button>
            </div>
            <div className="p-5">
              {proofPhotoSrc ? (
                <img
                  src={proofPhotoSrc}
                  alt="Proof of delivery"
                  className="max-h-[70vh] w-full rounded-xl object-contain"
                />
              ) : (
                <div className="py-10 text-center text-sm text-[#64748b]">
                  <Icon name="package-check" className="mb-2 text-3xl text-[#29945a]" />
                  <p className="font-semibold text-[#1e293b] dark:text-white">
                    {isDelivered
                      ? `Delivered on ${formatDate(proofTimestamp)}`
                      : "Proof of delivery photo has not been uploaded yet."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unified Permanent QR Modal */}
      {qrModalOpen && (
        <UnifiedQrModal
          parcel={parcel}
          open={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
        />
      )}
    </div>
  );
}

