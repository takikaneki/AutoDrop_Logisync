import { useEffect, useState } from "react";
import { getUser } from "../../api.js";
import { EmptyState } from "../ui.jsx";
import { Notice, PanelLink, PanelTitle } from "../portal.jsx";
import { panel } from "../styles.js";
import { listAudit } from "../../services/auditService.js";
import { timeAgo } from "../../store/notifications.js";
import { metaOf } from "../../utils/activity.js";

// "Recent Activity" para sa dashboard ng Coordinator, Seller at Rider. Totoong data mula sa /api/audit-logs;
// ang backend ang nagtatakda kung ano ang makikita ng bawat role. Nagre-refresh bawat 30 segundo.
export default function RecentActivity({ to, limit = 8, title = "Recent Activity" }) {
  const me = Number(getUser()?.user_id);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      listAudit({ limit })
        .then(({ logs }) => alive && (setLogs(logs), setError("")))
        .catch((e) => alive && setError(e.message))
        .finally(() => alive && setLoading(false));
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [limit]);

  return (
    <section className={`${panel} p-[30px] max-[600px]:p-5`}>
      <PanelTitle icon="fa-clock-rotate-left" action={to && <PanelLink to={to}>View all</PanelLink>}>{title}</PanelTitle>

      {error && <Notice tone="error" icon="fa-circle-exclamation" role="alert">{error}</Notice>}
      {!error && loading && <p className="py-8 text-center text-[14px] text-[#999]">Loading…</p>}
      {!error && !loading && logs.length === 0 && (
        <EmptyState icon="fa-clock-rotate-left" title="No activity yet" text="Actions will be listed here as they happen." />
      )}

      {!error && logs.length > 0 && (
        <ul>
          {logs.map((l) => {
            const m = metaOf(l.category);
            const mine = Number(l.actor_id) === me;
            return (
              <li key={l.log_id} className="flex items-start gap-3.5 border-b border-[#f1f1f1] py-3.5 last:border-b-0 dark:border-night-line">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] ${m.tone}`}>
                  <i className={`fa-solid ${m.icon}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px]">
                    <strong>{mine ? "You" : l.actor_name}</strong> <span className="text-[#777] dark:text-[#d1c9c2]">{l.action.toLowerCase()}</span>
                    {l.target && <strong className="font-semibold"> {l.target}</strong>}
                  </p>
                  {l.detail && <p className="truncate text-[13px] text-[#999]">{l.detail}</p>}
                </div>
                <span className="shrink-0 whitespace-nowrap text-[12px] text-[#aaa]">{timeAgo(new Date(l.created_at).getTime())}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
