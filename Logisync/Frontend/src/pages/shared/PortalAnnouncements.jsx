import Topbar from "../../components/Topbar.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { panel } from "../../components/styles.js";
import useBase from "../../hooks/useBase.js";
import { useAnnouncements } from "../../store/announcements.js";

const when = (ts) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// Announcements ng Coordinator para sa Seller o Rider. Ang lumalabas lang ay ang para sa role ng naka-login.
export default function PortalAnnouncements() {
  const role = useBase().slice(1); // "seller" | "rider"
  const list = useAnnouncements().filter((a) => (role === "rider" ? a.toRiders : a.toSellers));

  return (
    <>
      <Topbar title="Announcements" subtitle="Notices from your coordinator." />
      <section className={`${panel} p-2`}>
        {list.length === 0 ? (
          <EmptyState icon="fa-bullhorn" title="No announcements yet" text="Notices from the coordinator will show up here." />
        ) : (
          <ul>
            {list.map((a, i) => (
              <li key={a.id} className="flex gap-4 border-b border-[#f3f3f3] p-5 last:border-0 dark:border-night-line">
                <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-night-line">
                  <i className="fa-solid fa-bullhorn" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-[17px] font-bold">
                      {a.title}
                      {i === 0 && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 align-middle text-[11px] font-bold uppercase text-white">Latest</span>}
                    </h3>
                    <small className="text-[13px] text-[#aaa]">{when(a.ts)}</small>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[#777] dark:text-[#d1c9c2]">{a.message}</p>
                  <p className="mt-2 text-[13px] text-[#aaa]"><i className="fa-solid fa-user-tie mr-1" />From the Coordinator</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
