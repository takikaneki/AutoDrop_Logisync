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
export default function QrScanner({ onScan, btnClass = "bg-brand hover:bg-brand-dark" }) {
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

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-[#2a2522]">
        <div id={regionId} className="h-full w-full" />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-300">
            <i className="fa-solid fa-qrcode text-5xl opacity-60" />
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

      <div className="mt-4 flex justify-center gap-3">
        {!running ? (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className={`rounded-lg px-5 py-2.5 text-[14px] font-bold text-white transition disabled:opacity-60 ${btnClass}`}
          >
            <i className="fa-solid fa-camera mr-2" />
            Start scanning
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className={btnGhost}
          >
            <i className="fa-solid fa-stop mr-2" />
            Stop
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-[12px] text-[#999]">
        Point the camera at the QR code on the parcel and keep it inside the frame.
      </p>
    </div>
  );
}
