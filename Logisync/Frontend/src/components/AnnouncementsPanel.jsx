import { Link } from "react-router-dom";

const when = (ts) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// Announcements ng Coordinator. Magkaiba ang kulay (orange) sa regular na notifications at laging nasa itaas ng table.
// items = [{ id, title, text, ts, read?, toRiders?, toSellers? }]  ·  onOpen(item) = markahan bilang nabasa
// manageTo = link para pamahalaan ang announcements (Coordinator lang)
export default function AnnouncementsPanel({ items, onOpen, manageTo, heading = "Announcements from the Coordinator", limit }) {
  if (!items.length) return null;
  const shown = limit ? items.slice(0, limit) : items;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#ffd2b8] bg-[#fff4ec] dark:border-[#5a4030] dark:bg-[#3f3128]" aria-label={heading}>
      <div className="flex items-center gap-2.5 border-b border-[#ffd9c4] px-6 py-4 dark:border-[#5a4030]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white"><i className="fa-solid fa-bullhorn" /></span>
        <h2 className="text-[17px] font-bold text-[#c2410c] dark:text-[#ffb27a]">{heading}</h2>
        <span className="ml-auto rounded-full bg-brand px-2.5 py-0.5 text-[12px] font-bold text-white">{items.length}</span>
      </div>
      <ul>
        {shown.map((a, i) => (
          <li key={a.id} className="border-b border-[#ffe3d2] last:border-0 dark:border-[#5a4030]">
            <button onClick={() => onOpen?.(a)} className="flex w-full gap-4 px-6 py-4 text-left hover:bg-[#ffede0] dark:hover:bg-[#4a382c]">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-[15px] font-bold">
                    {a.title}
                    {i === 0 && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 align-middle text-[11px] font-bold uppercase text-white">Latest</span>}
                    {a.read === false && <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-brand align-middle" aria-label="Unread" />}
                  </h3>
                  <small className="text-[12px] text-[#b07a58]">{when(a.ts)}</small>
                </div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#6b4a35] dark:text-[#e8d6c9]">{a.text}</p>
                {(a.toRiders !== undefined || a.toSellers !== undefined) && (
                  <div className="mt-2.5 flex gap-2">
                    {a.toRiders && <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[#4285c5] dark:bg-night-head">Riders</span>}
                    {a.toSellers && <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-brand dark:bg-night-head">Sellers</span>}
                  </div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {manageTo && (
        <div className="border-t border-[#ffe3d2] px-6 py-3 text-right dark:border-[#5a4030]">
          <Link to={manageTo} className="text-[13px] font-bold text-brand hover:underline">Manage announcements →</Link>
        </div>
      )}
    </section>
  );
}
