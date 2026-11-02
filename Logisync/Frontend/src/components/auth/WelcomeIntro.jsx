import { useEffect, useRef, useState } from "react";

// Welcome screen: payak, puting background lang. Tatlong slide na swipe-only (walang Next/Prev),
// at ang "Let's Get Started" ay laging nasa ilalim-gitna.

const SLIDES = [
  {
    id: "trucks",
    image: "/images/truck-highway.jpg",
    alt: "Freight delivery truck driving on a highway",
    title: "Deliver Anywhere",
    quote: "Every parcel carries a promise — from the seller's hands straight to the customer's doorstep.",
  },
  {
    id: "warehouse",
    image: "/images/warehouse-racks.jpg",
    alt: "Modern logistics warehouse with parcels stacked on orange pallet racks",
    title: "Verified Before Dispatch",
    quote: "Trust starts at the hub. Every package is inspected, logged, and verified before it leaves.",
  },
  {
    id: "delivered",
    image: "/images/parcel-loading.jpg",
    alt: "Palletized parcel boxes being loaded into a delivery container at a warehouse dock",
    title: "Delivered with Confidence",
    quote: "From warehouse loading to proof of delivery, we keep every handoff safe, trackable, and on time.",
  },
];

const SWIPE_THRESHOLD = 50; // px

export default function WelcomeIntro({ onComplete }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const axis = useRef(null); // "x" | "y" | null

  const go = (i) => setIndex(Math.max(0, Math.min(SLIDES.length - 1, i)));

  // Swipe lang ang paraan ng paglipat; sa desktop, puwede ring arrow keys at mouse-drag.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const begin = (x, y) => {
    startX.current = x;
    startY.current = y;
    axis.current = null;
    setDragging(true);
  };
  const move = (x, y) => {
    if (startX.current === null) return;
    const dx = x - startX.current;
    const dy = y - startY.current;
    if (!axis.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (axis.current === "x") setDrag(dx);
  };
  const end = () => {
    if (startX.current === null) return;
    if (axis.current === "x") {
      if (drag <= -SWIPE_THRESHOLD) go(index + 1);
      else if (drag >= SWIPE_THRESHOLD) go(index - 1);
    }
    startX.current = null;
    axis.current = null;
    setDrag(0);
    setDragging(false);
  };

  const start = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onComplete?.(), 450);
  };

  return (
    <div
      className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-slate-900 transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Logo */}
      <header className="flex items-center justify-center gap-2.5 pt-6 sm:pt-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
          <i className="fa-solid fa-box" />
        </span>
        <span className="text-xl font-extrabold tracking-tight">LogiSync</span>
      </header>

      {/* Swipeable slides (swipe-only, no Next/Previous buttons) */}
      <div
        className="relative min-h-0 flex-1 cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing"
        onTouchStart={(e) => begin(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={end}
        onTouchCancel={end}
        onMouseDown={(e) => begin(e.clientX, e.clientY)}
        onMouseMove={(e) => move(e.clientX, e.clientY)}
        onMouseUp={end}
        onMouseLeave={end}
        role="region"
        aria-roledescription="carousel"
        aria-label="Introduction slides. Swipe left or right."
      >
        <div
          className={`flex h-full ${dragging ? "" : "transition-transform duration-500 ease-out"}`}
          style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))` }}
        >
          {SLIDES.map((s, i) => (
            <section
              key={s.id}
              aria-hidden={i !== index}
              className="flex h-full w-full shrink-0 flex-col items-center justify-center px-6 sm:px-10"
            >
              <div
                className={`w-full max-w-[560px] transition-all duration-500 ${
                  i === index ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                }`}
              >
                <img
                  src={s.image}
                  alt={s.alt}
                  draggable={false}
                  className="aspect-[4/3] max-h-[44dvh] w-full rounded-3xl object-cover shadow-[0_12px_32px_rgba(15,23,42,0.12)] sm:aspect-[16/10]"
                />
                <h1 className="mt-6 text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {s.title}
                </h1>
                <p className="mx-auto mt-2 max-w-[420px] text-center text-[15px] leading-relaxed text-slate-500">
                  {s.quote}
                </p>
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Indicators + CTA (bottom center) */}
      <footer className="flex flex-col items-center gap-5 px-6 pb-8 pt-3 sm:pb-10">
        <div className="flex items-center gap-2" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <span
              key={s.id}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? "w-7 bg-brand" : "w-2 bg-slate-200"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={start}
          className="w-full max-w-[340px] rounded-full bg-brand px-8 py-3.5 text-base font-bold text-white shadow-md shadow-orange-500/25 transition hover:bg-brand-dark active:scale-[0.98]"
        >
          Let&apos;s Get Started
        </button>
      </footer>
    </div>
  );
}
