import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import ScanPanel from "../../components/qr/ScanPanel.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { DetailList, Notice, PanelTitle, Steps } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, panel } from "../../components/styles.js";
import { findParcel, getSellerParcel, uploadVideo } from "../../services/parcelService.js";
import { formatDate, formatDay, formatSize } from "../../utils/format.js";

const MAX_MB = 50;
const ALLOWED = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/mpeg"];
const UPLOADABLE = ["WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED"];

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
    } else if (s === "RETURN_TO_HUB") {
      steps.push({
        label: parcel.returnCoordinated ? "Return to Hub · Coordinated to Seller" : "Return to Hub (3-Day Limit Reached)",
        note: parcel.lastFailure || "Undelivered after 3 rescheduled days",
        state: "fail",
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
          <ScanPanel onValue={lookup} busy={looking} />
          {looking && <p className="mt-4 text-[14px] text-[#999]">Looking up parcel…</p>}
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
        <div className="grid grid-cols-[1.5fr_1fr] items-start gap-6 max-[1100px]:grid-cols-1">
          <div className="min-w-0 space-y-6">
            <section className={`${panel} p-[30px] max-[600px]:p-5`}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[.3px] text-[#999]">Parcel ID</p>
                  <p className="font-mono text-[20px] font-bold">{parcel.parcel_id}</p>
                </div>
                <StatusBadge status={parcel.status} />
              </div>
              <DetailList
                rows={[
                  ["Transaction number", parcel.transaction_number],
                  ["Receiver", parcel.receiver_name],
                  ["Address", parcel.receiver_address],
                  ["Contact", parcel.receiver_contact],
                  ["Contents", parcel.contents],
                  ...(parcel.scheduledFor && !parcel.returnToHub
                    ? [
                        [
                          "Scheduled delivery date",
                          `${formatDay(parcel.scheduledFor)}${
                            parcel.rescheduled ? ` (Reschedule Day ${parcel.rescheduleCount || 1} of ${parcel.maxReschedules || 3})` : ""
                          }`,
                        ],
                      ]
                    : []),
                  ["Created", formatDate(parcel.created_at)],
                  ["Last updated", formatDate(parcel.updated_at)],
                ]}
              />
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

            {parcel.rescheduled && !parcel.returnToHub && (
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
              <section className={`${panel} p-[24px] max-[600px]:p-4`}>
                <PanelTitle icon="fa-clock-rotate-left">Delivery Attempts & Reschedule History</PanelTitle>
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
              <section className={`${panel} p-[30px] max-[600px]:p-5`}>
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

          <div className="min-w-0 space-y-6">
            <section className={`${panel} p-[30px] max-[600px]:p-5`}>
              <PanelTitle icon="fa-route">Progress</PanelTitle>
              <Steps steps={buildSteps(data)} />
            </section>

            {data.videos?.length > 0 && (
              <section className={`${panel} p-[30px] max-[600px]:p-5`}>
                <PanelTitle icon="fa-film">Submitted Videos</PanelTitle>
                <ul className="text-[14px]">
                  {data.videos.map((v) => (
                    <li key={v.video_id} className="border-b border-[#edf0f4] py-3 first:pt-0 last:border-b-0 last:pb-0 dark:border-night-line">
                      <span className="block break-all font-semibold">{v.file_name}</span>
                      <span className="text-[12px] text-[#999]">{formatSize(v.file_size)} · {formatDate(v.uploaded_at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
