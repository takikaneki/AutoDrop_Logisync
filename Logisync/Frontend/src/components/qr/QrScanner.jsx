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
  windowSize = "default",
  compactIdle = false,
  startLabel = "Scan with camera",
  showHint = true,
}) {
  const regionId = useRef(`qr-region-${Math.random().toString(36).slice(2)}`).current;
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
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

  const boxWidthCls = windowSize === "large" ? "max-w-[560px]" : compactIdle ? "max-w-[440px]" : "max-w-sm";
  const boxShapeCls =
    windowSize === "large"
      ? compactIdle && !running
        ? "h-[240px] sm:h-[270px]"
        : "h-[280px] sm:h-[320px]"
      : compactIdle && !running
      ? "h-[200px]"
      : "aspect-square";

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div
        className={`relative mx-auto w-full ${boxShapeCls} ${boxWidthCls} overflow-hidden rounded-2xl border border-slate-800/40 bg-gradient-to-b from-[#25211e] to-[#1c1917] shadow-inner`}
      >
        <div id={regionId} className="h-full w-full" />

        {/* Subtle QR Viewfinder Corner Brackets */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="relative h-full max-h-[210px] w-full max-w-[230px]">
            <span className="absolute top-0 left-0 h-6 w-6 rounded-tl-lg border-t-[3px] border-l-[3px] border-brand/80" />
            <span className="absolute top-0 right-0 h-6 w-6 rounded-tr-lg border-t-[3px] border-r-[3px] border-brand/80" />
            <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-[3px] border-l-[3px] border-brand/80" />
            <span className="absolute right-0 bottom-0 h-6 w-6 rounded-br-lg border-r-[3px] border-b-[3px] border-brand/80" />
          </div>
        </div>

        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-6 text-center text-slate-300">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-brand ring-1 ring-white/10">
              <i className={`fa-solid fa-qrcode ${windowSize === "large" ? "text-3xl" : "text-2xl"}`} />
            </span>
            <div>
              <p className="text-[13.5px] font-semibold text-white/90">
                {starting ? "Starting camera…" : "Camera is off"}
              </p>
              <p className="mt-0.5 text-[12px] text-slate-400">
                Press <strong className="font-semibold text-slate-200">{startLabel}</strong> below to scan the parcel QR code.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mx-auto mt-3 max-w-[560px] rounded-lg bg-[#fff0f0] px-3.5 py-2 text-center text-[13px] text-[#c23a3a] dark:bg-[#d94747]/15 dark:text-[#f2a1a1]"
        >
          {error}
        </p>
      )}

      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2.5">
        {!running ? (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white shadow-xs transition disabled:opacity-60 ${btnClass}`}
          >
            <i className="fa-solid fa-camera" />
            <span>{starting ? "Starting…" : startLabel}</span>
          </button>
        ) : (
          <button type="button" onClick={stop} className={btnGhost}>
            <i className="fa-solid fa-stop mr-1.5" />
            Stop camera
          </button>
        )}
      </div>

      {showHint && (
        <p className="mt-2.5 text-center text-[12px] text-[#999]">
          Point the camera at the QR code on the parcel and keep it inside the frame.
        </p>
      )}
    </div>
  );
}
