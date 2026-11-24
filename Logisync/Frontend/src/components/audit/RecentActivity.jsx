import { useEffect } from "react";
import { getUser } from "../../api.js";
import { EmptyState } from "../ui.jsx";
import { PanelLink, PanelTitle } from "../portal.jsx";
import { panel } from "../styles.js";
import { listAudit } from "../../services/auditService.js";
import { timeAgo } from "../../store/notifications.js";
import { metaOf } from "../../utils/activity.js";
import { useNetworkResource } from "../../hooks/useNetworkResource.js";
import {
  ActivityListSkeleton,
  CachedDataNotice,
  LoadErrorState,
  OfflineState,
} from "../Skeletons.jsx";
import Icon from "../Icon.jsx";

// "Recent Activity" para sa dashboard ng Coordinator, Seller at Rider. Totoong data mula sa /api/audit-logs;
// ang backend ang nagtatakda kung ano ang makikita ng bawat role. Nagre-refresh bawat 30 segundo.
export default function RecentActivity({ to, limit = 8, title = "Recent Activity" }) {
  const me = Number(getUser()?.user_id);
  const {
    data: logs,
    loading,
    error,
    offlineEmpty,
    isStaleOffline,
    cachedAt,
    reload,
    silentReload,
  } = useNetworkResource(
    `recent-activity-${limit}`,
    async () => {
      const res = await listAudit({ limit });
      return Array.isArray(res?.logs) ? res.logs : [];
    },
    { initialData: [], deps: [limit] }
  );

  useEffect(() => {
    const t = setInterval(() => silentReload(), 30000);
    return () => clearInterval(t);
  }, [silentReload]);

  return (
    <section className={`${panel} p-[30px] max-[600px]:p-4`}>
      <PanelTitle icon="history" action={to && <PanelLink to={to}>View all</PanelLink>}>{title}</PanelTitle>

      {isStaleOffline && <CachedDataNotice updatedAt={cachedAt} />}
      {error && !logs.length && (
        <LoadErrorState compact title="Unable to load recent activity" message={error} onRetry={reload} />
      )}
      {!error && loading && <ActivityListSkeleton count={5} label="Loading recent activity" />}
      {!error && !loading && offlineEmpty && (
        <OfflineState compact title="Recent activity unavailable offline" text="Reconnect to load the latest activity history." onRetry={reload} />
      )}
      {!error && !loading && !offlineEmpty && logs.length === 0 && (
        <EmptyState icon="history" title="No activity yet" text="Actions will be listed here as they happen." />
      )}

      {!error && logs.length > 0 && (
        <ul>
          {logs.map((l) => {
            const m = metaOf(l.category);
            const mine = Number(l.actor_id) === me;
            return (
              <li key={l.log_id} className="flex items-start gap-3.5 border-b border-[#f1f1f1] py-3.5 last:border-b-0 dark:border-night-line">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] ${m.tone}`}>
                  <Icon name={m.icon} />
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
