import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Topbar from "../../components/Topbar.jsx";
import ScanPanel from "../../components/qr/ScanPanel.jsx";
import ShipmentDetailsView from "../../components/parcels/ShipmentDetailsView.jsx";
import { Notice } from "../../components/portal.jsx";
import { panel } from "../../components/styles.js";
import { findParcel, getSellerParcel, uploadVideo } from "../../services/parcelService.js";
import { formatSize } from "../../utils/format.js";
import { toast } from "../../store/toast.js";

const MAX_MB = 50;
const ALLOWED = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/mpeg"];
const UPLOADABLE = ["WAITING_FOR_VIDEO", "REUPLOAD_REQUESTED"];

export default function ScanUpload() {
  const { id: routeId = "" } = useParams();
  const [params] = useSearchParams();
  const initialQuery = routeId || params.get("txn") || "";

  const [data, setData] = useState(null);
  const [looking, setLooking] = useState(Boolean(initialQuery));
  const [lookupError, setLookupError] = useState("");

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRef = useRef(null);

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
    const target = routeId || params.get("txn");
    if (target) lookup(target);
  }, [routeId, params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const clearFile = () => {
    setFile(null);
    setPreviewUrl("");
    setFileError("");
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    clearFile();
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      setFileError("Unsupported file. Use MP4, WebM, MOV, AVI or MPEG.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileError(`File is too large (${formatSize(f.size)}). Maximum is ${MAX_MB} MB.`);
      return;
    }
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
      const msg = "Video uploaded. Your parcel is now waiting for coordinator verification.";
      setSuccess(msg);
      toast(msg);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const parcel = data?.parcel;
  const canUpload = Boolean(parcel && UPLOADABLE.includes(parcel.status));

  if (parcel) {
    return (
      <ShipmentDetailsView
        parcel={parcel}
        videos={data?.videos || []}
        verificationRecords={data?.verification_records || []}
        backTo="/seller/parcels"
        backLabel="Back to Parcel Records"
        canUpload={canUpload}
        uploadProps={{
          file,
          previewUrl,
          fileError,
          progress,
          uploading,
          uploadError,
          success,
          inputRef,
          onPick,
          onUpload,
        }}
      />
    );
  }

  if (initialQuery && looking) {
    return (
      <section className={`${panel} mx-auto max-w-5xl p-8 text-sm text-[#888]`}>
        Loading shipment details…
      </section>
    );
  }

  return (
    <>
      <Topbar
        title="Scan QR / Upload Video"
        subtitle="Scan the QR code on the parcel (or type its transaction number), then view shipment details or upload your video proof."
      />

      <section className={`${panel} p-[30px] max-[600px]:p-5`}>
        <ScanPanel onValue={lookup} busy={looking} />
        {looking && <p className="mt-4 text-center text-[14px] text-[#999]">Looking up parcel…</p>}
        {lookupError && (
          <div className="mx-auto mt-4 max-w-[360px]">
            <Notice tone="error" icon="fa-circle-exclamation" role="alert">
              {lookupError}{" "}
              {/not found/i.test(lookupError) && (
                <>
                  Not registered yet?{" "}
                  <Link to="/seller/create" className="font-bold underline">
                    Create the parcel first
                  </Link>
                  .
                </>
              )}
            </Notice>
          </div>
        )}
      </section>
    </>
  );
}
