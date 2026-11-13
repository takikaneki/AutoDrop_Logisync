import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import ScanPanel from "../../components/qr/ScanPanel.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { Notice, PanelTitle } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, panel } from "../../components/styles.js";
import { findParcel, getSellerParcel, uploadVideo } from "../../services/parcelService.js";
import { formatDate, formatDay, formatSize } from "../../utils/format.js";

const MAX_MB = 50;
const ALLOWED = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/mpeg"];
const UPLOADABLE = ["WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED"];

function shortParcelId(id) {
  const str = String(id || "").trim();
  if (!str) return "—";
  if (str.length <= 10) return str;
  return `${str.slice(0, 2)}-${str.slice(-6)}`;
}

function InfoField({ label, value, title, mono = false, full = false }) {
  return (
    <div className={`min-w-0 ${full ? "sm:col-span-2" : ""}`}>
      <dt className="text-[11px] font-bold uppercase tracking-[0.4px] text-[#8a94a6] dark:text-[#9c948c]">
        {label}
      </dt>
      <dd
        title={title}
        className={`mt-1 break-words text-[14px] font-semibold text-[#27364f] dark:text-[#f1eeeb] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function buildSteps({ parcel, videos = [], verification_records: records = [] }) {
  const s = parcel.status;
  const isPostVerify = ["VERIFIED", "OUT_FOR_DELIVERY", "RESCHEDULED", "DELIVERED", "RETURN_TO_HUB", "DELIVERY_FAILED"].includes(s);
  const hasVideo = videos.length > 0 || ["VIDEO_SUBMITTED", "REJECTED"].includes(s) || isPostVerify;
  const decision = records[0];
  const decided = ["REJECTED", "REUPLOAD_REQUESTED"].includes(s) || isPostVerify;

  const verifyStep = decided
    ? isPostVerify
      ? { label: "Verified", state: "done" }
      : s === "REJECTED"
      ? { label: "Rejected", state: "fail" }
      : { label: "Reupload requested", state: "fail" }
    : { label: "Decision", state: "todo" };

  const steps = [
    { label: "Parcel registered", note: formatDate(parcel.created_at), state: "done" },
    {
      label: s === "REUPLOAD_REQUESTED" ? "New video needed" : "Video proof uploaded",
      note: videos[0] ? formatDate(videos[0].uploaded_at) : hasVideo ? "" : "Waiting for your upload",
      state: s === "REUPLOAD_REQUESTED" ? "current" : hasVideo ? "done" : "current",
    },
    {
      label: "Coordinator review",
      note: s === "VIDEO_SUBMITTED" ? "In progress" : decided ? "Reviewed" : "",
      state: s === "VIDEO_SUBMITTED" ? "current" : decided ? "done" : "todo",
    },
    { ...verifyStep, note: decided && decision ? formatDate(decision.verified_at) : "" },
  ];

  if (isPostVerify && s !== "VERIFIED") {
    if (s === "DELIVERED") {
      steps.push({ label: "Delivered to customer", note: "Completed", state: "done" });
    } else if (s === "RETURN_TO_HUB" || parcel.returnToHub) {
      steps.push({
        label: "Return to Hub",
        note: parcel.lastFailure || "Delivery unsuccessful · Sent back to hub",
        state: "done",
      });
    } else if (s === "RESCHEDULED") {
      steps.push({
        label: `Rescheduled (Day ${parcel.rescheduleCount || 1} of ${parcel.maxReschedules || 3})`,
        note: parcel.scheduledFor ? `Next delivery: ${formatDay(parcel.scheduledFor)}` : "",
        state: "current",
      });
    } else if (s === "OUT_FOR_DELIVERY") {
      steps.push({ label: "Out for Delivery", note: parcel.scheduledFor ? formatDay(parcel.scheduledFor) : "", state: "current" });
    }
  }

  return steps;
}

export default function ScanUpload() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [success, setSuccess] = useState("");
  const input = useRef(null);

  const lookup = async (value) => {
    setLooking(true);
    setLookupError("");
    setSuccess("");
    try {
      setData(await findParcel(value, "seller"));
    } catch (err) {
      setData(null);
      setLookupError(err.message);
    } finally {
      setLooking(false);
    }
  };

  useEffect(() => {
    const txn = params.get("txn");
    if (txn) lookup(txn);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const clearFile = () => {
    setFile(null);
    setPreviewUrl("");
    setFileError("");
    setProgress(0);
    if (input.current) input.current.value = "";
  };

  const reset = () => {
    setData(null);
    setLookupError("");
    setSuccess("");
    clearFile();
    params.delete("txn");
    setParams(params, { replace: true });
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    clearFile();
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return setFileError("Unsupported file. Use MP4, WebM, MOV, AVI or MPEG.");
    if (f.size > MAX_MB * 1024 * 1024) return setFileError(`File is too large (${formatSize(f.size)}). Maximum is ${MAX_MB} MB.`);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const onUpload = async () => {
    if (!file || !data) return;
    setUploading(true);
    setUploadError("");
    setProgress(0);
    try {
      await uploadVideo(data.parcel.parcel_id, file, setProgress);
      clearFile();
      setData(await getSellerParcel(data.parcel.parcel_id));
      setSuccess("Video uploaded. Your parcel is now waiting for coordinator verification.");
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const parcel = data?.parcel;
  const latestRemark = data?.verification_records?.find((r) => r.remarks) || null;
  const canUpload = parcel && UPLOADABLE.includes(parcel.status);

  const categoryDisplay = parcel?.content_category
    ? parcel.content_category === "Other" && parcel.other_category_description
      ? `Other (${parcel.other_category_description})`
      : parcel.content_category
    : "Unspecified";

  const discreetStatusLabel = parcel?.discrete_item
    ? parcel.discreet_status === "APPROVED"
      ? "Yes — Approved by Coordinator"
      : parcel.discreet_status === "REJECTED"
      ? "Yes — Rejected by Coordinator (Standard handling applied)"
      : "Yes — Pending Coordinator Review"
    : "No (Standard handling)";

  return (
    <>
      <Topbar title="Scan QR / Upload Video" subtitle="Scan the QR code on the parcel (or type its transaction number), then upload your video proof.">
        {parcel && (
          <button onClick={reset} className={btnGhost}>
            <i className="fa-solid fa-qrcode" /> Scan another parcel
          </button>
        )}
      </Topbar>

      {!parcel && (
        <section className={`${panel} p-[30px] max-[600px]:p-5`}>
          <ScanPanel onValue={lookup} busy={looking} centered allowImageUpload={false} />
          {looking && <p className="mt-4 text-center text-[14px] text-[#999]">Looking up parcel…</p>}
          {lookupError && (
            <div className="mt-4">
              <Notice tone="error" icon="fa-circle-exclamation" role="alert">
                {lookupError}{" "}
                {/not found/i.test(lookupError) && (
                  <>
                    Not registered yet? <Link to="/seller/create" className="font-bold underline">Create the parcel first</Link>.
                  </>
                )}
              </Notice>
            </div>
          )}
        </section>
      )}

      {parcel && (
        <div className="grid grid-cols-[1.45fr_1fr] items-start gap-6 max-[1100px]:grid-cols-1">
          {/* LEFT COLUMN: 4 Organized Information Groups + Notices + Attempts + Video Upload */}
          <div className="min-w-0 space-y-5">
            {/* 1. Parcel Information */}
            <section className={`${panel} p-6 max-[600px]:p-4`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f4] pb-3.5 dark:border-night-line">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff0e5] text-brand dark:bg-brand/15">
                    <i className="fa-solid fa-box text-sm" />
                  </span>
                  <h2 className="text-[15.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                    Parcel Information
                  </h2>
                </div>
                <StatusBadge status={parcel.status} />
              </div>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoField
                  label="Parcel ID"
                  value={shortParcelId(parcel.parcel_id)}
                  title={parcel.parcel_id}
                  mono
                />
                <InfoField
                  label="Transaction Number"
                  value={parcel.transaction_number}
                  mono
                />
              </dl>
            </section>

            {/* 2. Receiver Information */}
            <section className={`${panel} p-6 max-[600px]:p-4`}>
              <div className="mb-4 flex items-center gap-2.5 border-b border-[#edf0f4] pb-3.5 dark:border-night-line">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff0e5] text-brand dark:bg-brand/15">
                  <i className="fa-solid fa-user text-sm" />
                </span>
                <h2 className="text-[15.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                  Receiver Information
                </h2>
              </div>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoField label="Receiver Name" value={parcel.receiver_name} />
                <InfoField label="Contact Number" value={parcel.receiver_contact} mono />
                <InfoField label="Complete Delivery Address" value={parcel.receiver_address} full />
              </dl>
            </section>

            {/* 3. Parcel Contents */}
            <section className={`${panel} p-6 max-[600px]:p-4`}>
              <div className="mb-4 flex items-center gap-2.5 border-b border-[#edf0f4] pb-3.5 dark:border-night-line">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff0e5] text-brand dark:bg-brand/15">
                  <i className="fa-solid fa-boxes-stacked text-sm" />
                </span>
                <h2 className="text-[15.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                  Parcel Contents
                </h2>
              </div>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoField label="Declared Category" value={categoryDisplay} />
                <InfoField label="Item Description" value={parcel.contents} />
                <InfoField label="Discreet Handling Request" value={discreetStatusLabel} full />
                {parcel.discrete_item && parcel.discreet_reason && (
                  <InfoField label="Discreet Explanation" value={parcel.discreet_reason} full />
                )}
                {parcel.discreet_review_remarks && (
                  <InfoField label="Discreet Review Note" value={parcel.discreet_review_remarks} full />
                )}
              </dl>
            </section>

            {/* 4. Delivery Information */}
            <section className={`${panel} p-6 max-[600px]:p-4`}>
              <div className="mb-4 flex items-center gap-2.5 border-b border-[#edf0f4] pb-3.5 dark:border-night-line">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff0e5] text-brand dark:bg-brand/15">
                  <i className="fa-solid fa-truck text-sm" />
                </span>
                <h2 className="text-[15.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                  Delivery Information
                </h2>
              </div>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <InfoField
                  label="Scheduled Delivery Date"
                  value={
                    parcel.scheduledFor && !parcel.returnToHub
                      ? `${formatDay(parcel.scheduledFor)}${
                          parcel.rescheduled && parcel.status !== "DELIVERED"
                            ? ` (Day ${parcel.rescheduleCount || 1}/${parcel.maxReschedules || 3})`
                            : ""
                        }`
                      : "—"
                  }
                />
                <InfoField label="Created Date" value={formatDate(parcel.created_at)} />
                <InfoField label="Last Updated" value={formatDate(parcel.updated_at)} />
              </dl>
            </section>

            {success && <Notice tone="success" icon="fa-circle-check" role="status">{success}</Notice>}

            {parcel.returnToHub && (
              <Notice tone="error" icon="fa-warehouse">
                <strong className="block">
                  Return to Hub — Reached 3-Day Rescheduling Limit
                </strong>
                <p className="mt-1">
                  This parcel remained undelivered after the maximum 3-day rescheduling period ({parcel.lastFailure || "undelivered"}).{" "}
                  {parcel.returnCoordinated
                    ? `The coordinator has coordinated returning this parcel to you.${parcel.returnNote ? ` Note: "${parcel.returnNote}"` : ""}`
                    : "The coordinator has been notified to coordinate its return from the hub to you."}
                </p>
              </Notice>
            )}

            {parcel.rescheduled && !parcel.returnToHub && parcel.status !== "DELIVERED" && (
              <Notice tone="warn" icon="fa-calendar-day">
                <strong className="block">
                  Delivery Rescheduled (Day {parcel.rescheduleCount || 1} of {parcel.maxReschedules || 3})
                </strong>
                <p className="mt-1">
                  Latest rescheduled delivery date: <strong>{formatDay(parcel.scheduledFor)}</strong>.{" "}
                  {parcel.lastFailure ? `Last attempt failed: ${parcel.lastFailure}.` : ""}
                </p>
              </Notice>
            )}

            {Array.isArray(parcel.attempts) && parcel.attempts.length > 0 && (
              <section className={`${panel} p-6 max-[600px]:p-4`}>
                <PanelTitle icon="fa-clock-rotate-left">Delivery Attempts &amp; Reschedule History</PanelTitle>
                <ol className="space-y-3 border-l-2 border-[#e5e8ee] pl-4 text-[13px] dark:border-night-line">
                  {parcel.attempts.map((att, i) => (
                    <li key={att.id || i}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-[#27364f] dark:text-[#f1eeeb]">
                          Attempt #{att.attempt || i + 1} · {formatDay(att.scheduledDate)}
                        </strong>
                        {att.outcome === "return_to_hub" ? (
                          <span className="rounded-full bg-[#f2ecff] px-2.5 py-0.5 text-[11px] font-bold text-[#7c3aed]">
                            Marked Return to Hub
                          </span>
                        ) : att.outcome === "delivered" ? (
                          <span className="rounded-full bg-[#eaf8ef] px-2.5 py-0.5 text-[11px] font-bold text-[#29945a]">
                            Delivered
                          </span>
                        ) : att.rescheduledTo ? (
                          <span className="rounded-full bg-[#fff4d8] px-2.5 py-0.5 text-[11px] font-bold text-[#c98200]">
                            Rescheduled → {formatDay(att.rescheduledTo)} (Day {att.rescheduleDay || 1}/3)
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 font-medium text-[#d94747]">Reason: {att.reason}</p>
                      {att.note && <p className="mt-0.5 text-[12px] text-[#888]">{att.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {latestRemark && ["REUPLOAD_REQUESTED", "REJECTED"].includes(parcel.status) && (
              <Notice tone="warn" icon="fa-comment-dots">
                <strong className="block">Coordinator remarks</strong>
                <p className="mt-1 whitespace-pre-wrap">{latestRemark.remarks}</p>
                <small className="opacity-70">{formatDate(latestRemark.verified_at)}</small>
              </Notice>
            )}
            {parcel.status === "VIDEO_SUBMITTED" && (
              <Notice tone="info" icon="fa-hourglass-half">Your video is under verification. You can upload again only if the coordinator requests it.</Notice>
            )}
            {parcel.status === "VERIFIED" && (
              <Notice tone="success" icon="fa-circle-check">Verified by the coordinator. Note: verified does not mean delivered yet.</Notice>
            )}
            {parcel.status === "REJECTED" && (
              <Notice tone="error" icon="fa-ban">This parcel was rejected. Please message your coordinator for the next step.</Notice>
            )}

            {canUpload && (
              <section className={`${panel} p-6 max-[600px]:p-4`}>
                <PanelTitle icon="fa-video">{parcel.status === "REUPLOAD_REQUESTED" ? "Upload a New Video" : "Upload Video Proof"}</PanelTitle>
                <p className="-mt-3 mb-4 text-[13px] text-[#999]">MP4, WebM, MOV, AVI or MPEG. Up to {MAX_MB} MB.</p>

                <input
                  ref={input}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg"
                  onChange={onPick}
                  disabled={uploading}
                  aria-label="Choose video"
                  className="block w-full text-[14px] file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2.5 file:text-[14px] file:font-bold file:text-white hover:file:bg-brand-dark"
                />
                {fileError && <p role="alert" className="mt-2 text-[13px] text-[#d94747]">{fileError}</p>}

                {file && (
                  <div className="mt-4">
                    <video src={previewUrl} controls className="max-h-72 w-full rounded-xl bg-black" />
                    <p className="mt-2 text-[14px]"><strong>{file.name}</strong> · {formatSize(file.size)}</p>
                  </div>
                )}

                {uploading && (
                  <div className="mt-4" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-2 overflow-hidden rounded-full bg-[#eee] dark:bg-night-line">
                      <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1 text-[12px] text-[#999]">Uploading… {progress}%</p>
                  </div>
                )}
                {uploadError && <div className="mt-3"><Notice tone="error" icon="fa-circle-exclamation" role="alert">{uploadError}</Notice></div>}

                <button onClick={onUpload} disabled={!file || uploading} className={`${btnPrimary} mt-5 px-6`}>
                  <i className="fa-solid fa-cloud-arrow-up" /> {uploading ? "Uploading…" : "Submit video"}
                </button>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: 5. Progress Timeline & 6. Submitted Videos */}
          <div className="min-w-0 space-y-5">
            {/* 5. Progress Timeline */}
            <section className={`${panel} p-6 max-[600px]:p-4`}>
              <div className="mb-4 flex items-center gap-2.5 border-b border-[#edf0f4] pb-3.5 dark:border-night-line">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff0e5] text-brand dark:bg-brand/15">
                  <i className="fa-solid fa-route text-sm" />
                </span>
                <h2 className="text-[15.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                  Progress Timeline
                </h2>
              </div>

              <ol className="relative space-y-3">
                {buildSteps(data).map((step, idx, arr) => {
                  const isDone = step.state === "done";
                  const isCurrent = step.state === "current";
                  const isFail = step.state === "fail";
                  const dotCls = isDone
                    ? "bg-[#29945a] text-white border-[#29945a]"
                    : isCurrent
                    ? "bg-brand text-white border-brand"
                    : isFail
                    ? "bg-[#d94747] text-white border-[#d94747]"
                    : "bg-white text-[#999] border-[#d9dee7] dark:bg-night-head dark:border-night-line";
                  const icon = isDone
                    ? "fa-check"
                    : isFail
                    ? "fa-xmark"
                    : isCurrent
                    ? "fa-circle-dot"
                    : "fa-circle";

                  return (
                    <li key={step.label} className="relative flex gap-3.5">
                      {idx < arr.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={`absolute left-[13px] top-7 h-[calc(100%-10px)] w-0.5 ${
                            isDone ? "bg-[#29945a]/40" : "bg-[#e5e8ee] dark:bg-night-line"
                          }`}
                        />
                      )}
                      <span
                        className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] ${dotCls}`}
                      >
                        <i className={`fa-solid ${icon}`} />
                      </span>
                      <div
                        className={`min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 ${
                          isCurrent
                            ? "border-brand/40 bg-[#fffaf7] dark:border-brand/40 dark:bg-night-head"
                            : "border-[#edf0f4] bg-[#fcfcfd] dark:border-night-line dark:bg-night-head/60"
                        }`}
                      >
                        <p className="text-[13.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                          {step.label}
                        </p>
                        {step.note && (
                          <p className="mt-0.5 text-[12px] text-[#777] dark:text-[#b8b0a8]">
                            {step.note}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            {/* 6. Submitted Videos */}
            <section className={`${panel} p-6 max-[600px]:p-4`}>
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-[#edf0f4] pb-3.5 dark:border-night-line">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff0e5] text-brand dark:bg-brand/15">
                    <i className="fa-solid fa-film text-sm" />
                  </span>
                  <h2 className="text-[15.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                    Submitted Videos
                  </h2>
                </div>
                {data.videos?.length > 0 && (
                  <span className="rounded-full bg-[#fff0e5] px-2.5 py-0.5 text-[11px] font-bold text-brand dark:bg-brand/15">
                    {data.videos.length}
                  </span>
                )}
              </div>

              {data.videos?.length > 0 ? (
                <ul className="space-y-2.5 text-[13.5px]">
                  {data.videos.map((v) => (
                    <li
                      key={v.video_id}
                      className="flex items-start gap-3 rounded-xl border border-[#edf0f4] bg-[#fcfcfd] p-3 dark:border-night-line dark:bg-night-head/60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff0e5] text-brand dark:bg-brand/15">
                        <i className="fa-solid fa-file-video text-xs" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block break-all font-semibold text-[#27364f] dark:text-[#f1eeeb]">
                          {v.file_name}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-[#888] dark:text-[#b8b0a8]">
                          {formatSize(v.file_size)} · {formatDate(v.uploaded_at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-[#e5e8ee] py-5 text-center text-[13px] text-[#888] dark:border-night-line dark:text-[#b8b0a8]">
                  No video proof submitted yet.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
