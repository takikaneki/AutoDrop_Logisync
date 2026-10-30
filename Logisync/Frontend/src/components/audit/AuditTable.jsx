import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser } from "../../api.js";
import Pagination from "../Pagination.jsx";
import { EmptyState } from "../ui.jsx";
import { Notice } from "../portal.jsx";
import { inputCls, panel, td, th } from "../styles.js";
import { listAudit } from "../../services/auditService.js";
import { CATEGORIES, ROLE_BADGE, metaOf } from "../../utils/activity.js";

const PAGE_SIZE = 12;

// Buong talaan ng audit log (may search, filter at pagination). Iisang component para sa
// Audit Log ng coordinator at Activity Log ng seller/rider; ang backend ang nagsasala ayon sa role.
export default function AuditTable({ note }) {
  const navigate = useNavigate();
  const me = Number(getUser()?.user_id);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ logs: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Hintayin muna ang user na tumigil sa pagta-type bago maghanap
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listAudit({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, category: category === "All" ? "" : category, q })
      .then((d) => alive && (setData(d), setError("")))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [category, q, page]);

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
      {note && <p className="mb-4 text-[13px] text-[#999]"><i className="fa-solid fa-lock mr-1.5" />{note}</p>}

      <div className="mb-5 grid grid-cols-[1fr_200px] gap-3 max-[700px]:grid-cols-1">
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, parcel, person or detail..." aria-label="Search" className={`${inputCls} pl-9`} />
        </div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Filter by category" className={inputCls}>
          {["All", ...CATEGORIES].map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {error && <Notice tone="error" icon="fa-circle-exclamation" role="alert">{error}</Notice>}

      {!error && (
        <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head">
              <tr>{["When", "Who", "Action", "Target", "Details"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className={`${td} text-center text-[#999]`}>Loading…</td></tr>}
              {!loading && data.logs.map((l) => {
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
                      <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${ROLE_BADGE[l.actor_role] || ""}`}>{l.actor_role}</span>
                    </td>
                    <td className={td}>
                      <span className="inline-flex items-center gap-2 font-semibold text-[#333] dark:text-[#f1eeeb]">
                        <i className={`fa-solid ${m.icon} w-4 text-[13px] text-brand`} />{l.action}
                      </span>
                    </td>
                    <td className={`${td} font-mono text-[13px]`}>{l.target || "—"}</td>
                    <td className={`${td} max-w-[280px]`}>{l.detail || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && data.logs.length === 0 && <EmptyState icon="fa-clipboard-list" title="No log entries" text="Nothing matches your search yet." />}
        </div>
      )}

      {!error && data.total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
    </section>
  );
}
