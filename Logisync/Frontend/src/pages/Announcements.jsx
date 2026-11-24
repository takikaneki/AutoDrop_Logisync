import { useEffect, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import AnnouncementModal from "../components/AnnouncementModal.jsx";
import { EmptyState } from "../components/ui.jsx";
import { btnPrimary, panel } from "../components/styles.js";
import { syncAnnouncementsFromServer, useAnnouncements } from "../store/announcements.js";
import { useNetworkStatus, useReconnectRefresh } from "../utils/network.js";
import {
  CachedDataNotice,
  NotificationListSkeleton,
  OfflineState,
} from "../components/Skeletons.jsx";
import Icon from "../components/Icon.jsx";

const when = (ts) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function Announcements() {
  const list = useAnnouncements();
  const { online } = useNetworkStatus();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(() => online && list.length === 0);

  const refresh = () => {
    if (!online) {
      setLoading(false);
      return;
    }
    if (list.length === 0) setLoading(true);
    Promise.resolve(syncAnnouncementsFromServer()).finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useReconnectRefresh(refresh);

  return (
    <>
      <Topbar title="Announcements" subtitle="History of notices sent to riders and sellers.">
        <button onClick={() => setOpen(true)} className={btnPrimary}><Icon name="megaphone" /> New Announcement</button>
      </Topbar>

      {!online && list.length > 0 && <CachedDataNotice />}

      <section className={`${panel} p-2`}>
        {loading && online && list.length === 0 ? (
          <NotificationListSkeleton count={5} label="Loading announcements" />
        ) : !online && list.length === 0 ? (
          <div className="p-4">
            <OfflineState title="Announcements unavailable offline" text="Reconnect to load announcement history." onRetry={refresh} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon="megaphone" title="No announcements yet" text="Use the megaphone icon at the top to send one." />
        ) : (
          <ul>
            {list.map((a) => (
              <li key={a.id} className="flex gap-4 p-5 border-b border-[#f3f3f3] last:border-0 dark:border-night-line">
                <span className="w-[44px] h-[44px] shrink-0 rounded-xl bg-brand-soft text-brand flex items-center justify-center dark:bg-night-line"><Icon name="megaphone" /></span>
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
