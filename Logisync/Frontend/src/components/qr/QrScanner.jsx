import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { btnGhost } from "../styles.js";

function friendlyError(e) {
  const msg = String(e?.message || e || "");
  if (/permission|denied|NotAllowed/i.test(msg)) return "Camera permission was denied. Allow camera access in your browser settings, or type the number below.";
  if (/NotFound|no camera|Requested device not found/i.test(msg)) return "No camera was found on this device. Type the number below instead.";
  if (/secure|https/i.test(msg)) return "The camera only works on https or localhost.";
  return `Could not start the camera. ${msg}`;
}

// Live camera scanner. Kapag may nabasang QR, titigil ang camera at tatawagin ang onScan(text).
// Gumagamit ng html5-qrcode (kailangan ng `npm install`).
export default function QrScanner({
  onScan,
  btnClass = "bg-brand hover:bg-brand-dark",
  allowImageUpload = true,
  windowSize = "default",
  compactIdle = false,
  startLabel = "Scan with camera",
  showHint = true,
}) {
  const regionId = useRef(`qr-region-${Math.random().toString(36).slice(2)}`).current;
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [scanningFile, setScanningFile] = useState(false);
  const [error, setError] = useState("");

  const stop = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch {
        /* nakahinto na */
      }
    }
    setRunning(false);
  };

  const handleFileScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setScanningFile(true);
    await stop();
    try {
      const scanner = new Html5Qrcode(regionId);
      const decodedText = await scanner.scanFile(file, false);
      try { scanner.clear(); } catch (_) {}
      onScanRef.current?.(decodedText);
    } catch (err) {
      setError("No valid QR code was detected in the selected image. Please try a clearer picture or enter the transaction number manually.");
    } finally {
      setScanningFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const start = async () => {
    setError("");
    setStarting(true);
    try {
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          stop();
          onScanRef.current?.(text);
        },
        () => {
          /* walang QR sa frame, normal lang */
        }
      );
      setRunning(true);
    } catch (e) {
      scannerRef.current = null;
      setError(friendlyError(e));
    } finally {
      setStarting(false);
    }
  };

  // Isara ang camera kapag umalis sa page
  useEffect(() => () => {
    stop();
  }, []);

  const boxWidthCls = windowSize === "large" ? "max-w-[430px]" : compactIdle ? "max-w-[380px]" : "max-w-sm";
  const boxShapeCls = compactIdle && !running ? "h-[176px]" : "aspect-square";

  return (
    <div>
      <div className={`relative mx-auto w-full ${boxShapeCls} ${boxWidthCls} overflow-hidden rounded-2xl bg-[#2a2522]`}>
        <div id={regionId} className="h-full w-full" />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-300">
            <i className="fa-solid fa-qrcode text-4xl opacity-60" />
            <p className="text-sm">{starting ? "Starting camera…" : "Camera is off. Press Start scanning."}</p>
          </div>
        )}
        {running && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[240px] w-[240px] max-w-[80%] rounded-xl border-2 border-white/80" />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mx-auto mt-3 max-w-sm rounded-lg bg-[#fff0f0] px-3 py-2 text-[13px] text-[#c23a3a] dark:bg-[#d94747]/15 dark:text-[#f2a1a1]">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-center items-center gap-2.5">
        {!running ? (
          <>
            <button
              type="button"
              onClick={start}
              disabled={starting || scanningFile}
              className={`rounded-lg px-4 py-2 text-[13.5px] font-bold text-white transition disabled:opacity-60 ${btnClass}`}
            >
              <i className="fa-solid fa-camera mr-2" />
              {starting ? "Starting…" : startLabel}
            </button>

            {allowImageUpload && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={starting || scanningFile}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#ddd] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#555] transition hover:border-brand hover:text-brand dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2]"
                >
                  <i className="fa-solid fa-image text-brand" />
                  {scanningFile ? "Scanning image…" : "Upload QR image"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileScan}
                  className="hidden"
                  aria-label="Upload QR code image"
                />
              </>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={stop}
            className={btnGhost}
          >
            <i className="fa-solid fa-stop mr-2" />
            Stop camera
          </button>
        )}
      </div>
      {showHint && (
        <p className="mt-3 text-center text-[12px] text-[#999]">
          Point the camera at the QR code on the parcel and keep it inside the frame.
        </p>
      )}
    </div>
  );
}
