import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import ScanPanel from "../../components/qr/ScanPanel.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { DetailList, Notice, PanelTitle, Steps } from "../../components/portal.jsx";
import { btnGhost, btnPrimary, panel } from "../../components/styles.js";
import { findParcel, getSellerParcel, uploadVideo } from "../../services/parcelService.js";
import { formatDate, formatSize } from "../../utils/format.js";

// Dapat tugma sa backend (middleware/upload.js): mp4, webm, quicktime, avi, mpeg at MAX_VIDEO_SIZE_MB (default 50).
const MAX_MB = 50;
const ALLOWED = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/mpeg"];
const UPLOADABLE = ["WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED"];

// Progress ng parcel, galing lang sa totoong status/petsa na ibinalik ng backend
function buildSteps({ parcel, videos = [], verification_records: records = [] }) {
  const s = parcel.status;
  const hasVideo = videos.length > 0 || ["VIDEO_SUBMITTED", "VERIFIED", "REJECTED"].includes(s);
  const decision = records[0];
  const decided = ["VERIFIED", "REJECTED", "REUPLOAD_REQUESTED"].includes(s);

  const last = decided
    ? s === "VERIFIED"
      ? { label: "Verified", state: "done" }
      : s === "REJECTED"
        ? { label: "Rejected", state: "fail" }
        : { label: "Reupload requested", state: "fail" }
    : { label: "Decision", state: "todo" };

  return [
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
    { ...last, note: decided && decision ? formatDate(decision.verified_at) : "" },
  ];
}

export default function ScanUpload() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null); // { parcel, videos, verification_records }
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
      // Backend ang nagsisiguro na sa seller mismo ang parcel (404 kung hindi)
      setData(await findParcel(value, "seller"));
    } catch (err) {
      setData(null);
      setLookupError(err.message);
    } finally {
      setLooking(false);
    }
  };

  // Galing sa Parcel Records / Dashboard: /seller/scan?txn=...
  useEffect(() => {
    const txn = params.get("txn");
    if (txn) lookup(txn);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Linisin ang preview URL
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
      setData(await getSellerParcel(data.parcel.parcel_id)); // i-refresh ang status mula sa backend
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
                  ["Contact", parcel.receiver_contact],
                  ["Contents", parcel.contents],
                  ["Created", formatDate(parcel.created_at)],
                  ["Last updated", formatDate(parcel.updated_at)],
                ]}
              />
            </section>

            {success && <Notice tone="success" icon="fa-circle-check" role="status">{success}</Notice>}

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
