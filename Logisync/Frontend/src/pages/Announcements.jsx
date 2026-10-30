import { useState } from "react";
import Topbar from "../components/Topbar.jsx";
import AnnouncementModal from "../components/AnnouncementModal.jsx";
import { EmptyState } from "../components/ui.jsx";
import { btnPrimary, panel } from "../components/styles.js";
import { useAnnouncements } from "../store/announcements.js";

const when = (ts) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function Announcements() {
  const list = useAnnouncements();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Topbar title="Announcements" subtitle="History of notices sent to riders and sellers.">
        <button onClick={() => setOpen(true)} className={btnPrimary}><i className="fa-solid fa-bullhorn" /> New Announcement</button>
      </Topbar>

      <section className={`${panel} p-2`}>
        {list.length === 0 ? (
          <EmptyState icon="fa-bullhorn" title="No announcements yet" text="Use the megaphone icon at the top to send one." />
        ) : (
          <ul>
            {list.map((a) => (
              <li key={a.id} className="flex gap-4 p-5 border-b border-[#f3f3f3] last:border-0 dark:border-night-line">
                <span className="w-[44px] h-[44px] shrink-0 rounded-xl bg-brand-soft text-brand flex items-center justify-center dark:bg-night-line"><i className="fa-solid fa-bullhorn" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <h3 className="text-[16px] font-bold">{a.title}</h3>
                    <small className="text-[12px] text-[#aaa]">{when(a.ts)}</small>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#777] dark:text-[#d1c9c2]">{a.message}</p>
                  <div className="mt-2.5 flex gap-2">
                    {a.toRiders && <span className="px-2.5 py-1 rounded-full bg-[#eaf3ff] text-[#4285c5] text-[11px] font-semibold">Riders</span>}
                    {a.toSellers && <span className="px-2.5 py-1 rounded-full bg-[#fff0e7] text-brand text-[11px] font-semibold">Sellers</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <AnnouncementModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
