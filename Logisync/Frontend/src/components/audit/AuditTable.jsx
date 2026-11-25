import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../../api.js";
import { EmptyState, TableSkeleton } from "../ui.jsx";
import { inputCls, panel, stickyThead, tableScroll, td, th } from "../styles.js";
import { listAudit } from "../../services/auditService.js";
import { CATEGORIES, ROLE_BADGE, metaOf } from "../../utils/activity.js";
import { useNetworkResource } from "../../hooks/useNetworkResource.js";
import {
  CachedDataNotice,
  LoadErrorState,
  OfflineState,
  ParcelCardListSkeleton,
} from "../Skeletons.jsx";
import Icon from "../Icon.jsx";
import { FilterSelect, SearchFilterBar, SearchInput } from "../SearchFilterBar.jsx";

const FETCH_LIMIT = 200;

// Buong talaan ng audit log (may search, filter at scrollable fixed container). Iisang component para sa
// Audit Log ng coordinator at Activity Log ng seller/rider; ang backend ang nagsasala ayon sa role.
export default function AuditTable({ note }) {
  const navigate = useNavigate();
  const me = Number(getUser()?.user_id);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  // Hintayin muna ang user na tumigil sa pagta-type bago maghanap
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const cacheKey = category === "All" && !q ? "audit-table-all" : "";
  const {
    data,
    loading,
    error,
    offlineEmpty,
    isStaleOffline,
    cachedAt,
    reload,
  } = useNetworkResource(
    cacheKey,
    () => listAudit({ limit: FETCH_LIMIT, offset: 0, category: category === "All" ? "" : category, q }),
    { initialData: { logs: [], total: 0 }, deps: [category, q] }
  );

  const destinationFor = (log) => {
    const target = String(log.target || "").trim();
    const encodedTarget = encodeURIComponent(target);
    switch (log.category) {
      case "Accounts": return "/accounts";
      case "Verification":
      case "Video": return "/verification";
      case "Delivery": return target && target !== "—" ? `/parcels/${encodedTarget}` : "/parcels";
      case "Parcels": return target && target !== "—" ? `/parcels/${encodedTarget}` : "/parcels";
      default: return "/dashboard";
    }
  };

  return (
    <section className={`${panel} p-6`}>
      {note && <p className="mb-4 text-[13px] text-[#999]"><Icon name="lock" className="mr-1.5" />{note}</p>}

      <SearchFilterBar
        hasActiveFilters={Boolean(search.trim() || category !== "All")}
        onReset={() => {
          setSearch("");
          setCategory("All");
        }}
      >
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, parcel, person or detail..."
          ariaLabel="Search activity log"
        />
        <FilterSelect
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          ariaLabel="Filter by category"
          icon="filter"
          active={category !== "All"}
          className="min-w-[190px]"
        >
          {["All", ...CATEGORIES].map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "All categories" : c}
            </option>
          ))}
        </FilterSelect>
      </SearchFilterBar>

      {isStaleOffline && <CachedDataNotice updatedAt={cachedAt} />}
      {error && (
        <div className="mb-4">
          <LoadErrorState compact title="Unable to load activity log" message={error} onRetry={reload} />
        </div>
      )}

      {!error && (
        <>
          <div className={`hidden min-[701px]:block ${tableScroll}`}>
            <table className="w-full min-w-[760px] border-collapse">
              <thead className={stickyThead}>
                <tr>{["When", "Who", "Action", "Target", "Details"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              {loading ? (
                <TableSkeleton rows={6} cols={5} />
              ) : (
              <tbody>
                {data.logs.map((l) => {
                  const m = metaOf(l.category);
                  return (
                    <tr
                      key={l.log_id}
                      onClick={() => navigate(destinationFor(l))}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(destinationFor(l)); } }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open ${l.category} section for ${l.action}`}
                      title="Click to open the related section"
                      className="cursor-pointer text-[#666] hover:bg-[#fffaf7] focus:bg-[#fffaf7] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand dark:text-[#d1c9c2] dark:hover:bg-night-head"
                    >
                      <td className={`${td} whitespace-nowrap`}>{new Date(l.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                      <td className={td}>
                        {Number(l.actor_id) === me ? <strong>You</strong> : l.actor_name}{" "}
                        <span className={`ml-1.5 text-[11.5px] font-bold capitalize ${ROLE_BADGE[l.actor_role] || ""}`}>{l.actor_role}</span>
                      </td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-2 font-semibold text-[#333] dark:text-[#f1eeeb]">
                          <Icon name={m.icon} className="h-4 w-4 text-[13px] text-brand" />{l.action}
                        </span>
                      </td>
                      <td className={`${td} font-mono text-[13px]`}>{l.target || "—"}</td>
                      <td className={`${td} max-w-[280px]`}>{l.detail || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              )}
            </table>
            {!loading && offlineEmpty && (
              <div className="p-4">
                <OfflineState compact title="Activity log unavailable offline" text="Reconnect to load activity records." onRetry={reload} />
              </div>
            )}
            {!loading && !offlineEmpty && data.logs.length === 0 && <EmptyState icon="clipboard-list" title="No log entries" text="Nothing matches your search yet." />}
          </div>

          {/* Mobile Card List */}
          <div className="min-[701px]:hidden max-h-[calc(100vh-330px)] min-h-[320px] overflow-y-auto space-y-3 pr-1">
            {loading ? (
              <ParcelCardListSkeleton count={4} label="Loading activity log" />
            ) : offlineEmpty ? (
              <OfflineState compact title="Activity log unavailable offline" text="Reconnect to load activity records." onRetry={reload} />
            ) : data.logs.length === 0 ? (
              <EmptyState icon="clipboard-list" title="No log entries" text="Nothing matches your search yet." />
            ) : (
              data.logs.map((l) => {
                const m = metaOf(l.category);
                return (
                  <div
                    key={l.log_id}
                    onClick={() => navigate(destinationFor(l))}
                    className="cursor-pointer rounded-xl border border-[#eee] bg-[#fcfcfd] p-3.5 transition active:scale-[0.99] dark:border-night-line dark:bg-night-head"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#27364f] dark:text-[#f1eeeb]">
                          <Icon name={m.icon} className="text-brand text-[12px]" />
                          {l.action}
                        </span>
                        {l.target && l.target !== "—" && (
                          <span className="block truncate font-mono text-[12px] text-brand mt-0.5">
                            {l.target}
                          </span>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${ROLE_BADGE[l.actor_role] || ""}`}>
                        {Number(l.actor_id) === me ? "You" : l.actor_name || l.actor_role}
                      </span>
                    </div>
                    {l.detail && l.detail !== "—" && (
                      <p className="mt-1.5 text-[12px] text-[#777] line-clamp-2 dark:text-[#aaa]">
                        {l.detail}
                      </p>
                    )}
                    <div className="mt-2 text-right text-[11px] text-[#aaa]">
                      {new Date(l.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

    </section>
  );
}
