import { useMemo, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { Avatar, ConfirmDialog, EmptyState, Modal, StatusBadge, TableSkeleton } from "../components/ui.jsx";
import { btnGhost, btnPrimary, inputCls, panel, td, th } from "../components/styles.js";
import { StatCard, StatGrid } from "../components/portal.jsx";
import { setSellerStatus, useParcels, useSellers } from "../store/records.js";
import { logAction } from "../store/audit.js";
import { toast } from "../store/toast.js";
import { useFakeLoading } from "../utils/useFakeLoading.js";

const tone = {
  Active: "bg-[#eaf8ef] text-[#29945a]",
  Suspended: "bg-[#fff0f0] text-[#d94747]",
};
const PAGE_SIZE = 8;

export default function Sellers() {
  const sellers = useSellers();
  const parcels = useParcels();
  const loading = useFakeLoading();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [view, setView] = useState(null);
  const [confirm, setConfirm] = useState(null); // { seller, next }

  const counts = useMemo(() => {
    const m = {};
    sellers.forEach((s) => {
      const mine = parcels.filter((p) => p.seller === s.name);
      m[s.name] = { total: mine.length, delivered: mine.filter((p) => p.status === "Delivered").length, recent: mine.slice(0, 5) };
    });
    return m;
  }, [sellers, parcels]);

  const rows = sellers.filter(
    (s) => (status === "All" || s.status === status) && (!search.trim() || [s.name, s.shop, s.email].some((v) => v.toLowerCase().includes(search.toLowerCase().trim())))
  );
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const current = view && sellers.find((s) => s.id === view);

  const actions = {
    Suspend: ["Suspended", "Suspended seller", "Suspend this seller?", "They will not be able to register new parcels.", true],
    Reactivate: ["Active", "Reactivated seller", "Reactivate this seller?", "Their account will be active again.", false],
  };
  const actionFor = (s) => (s.status === "Suspended" ? "Reactivate" : "Suspend");

  const apply = () => {
    const { seller, kind } = confirm;
    const [next, auditLabel] = actions[kind];
    // TODO: PATCH /api/users/:id/status
    setSellerStatus(seller.id, next);
    logAction({ category: "Sellers", action: auditLabel, target: seller.name, detail: seller.shop });
    toast(`${seller.name} — ${auditLabel.toLowerCase()}.`);
    setConfirm(null);
  };

  return (
    <>
      <Topbar title="Sellers" subtitle="Review, suspend and reactivate seller accounts." />

      <StatGrid cols={3}>
        <StatCard label="Total sellers" value={sellers.length} icon="fa-store" tone="orange" />
        <StatCard label="Active" value={sellers.filter((x) => x.status === "Active").length} icon="fa-circle-check" tone="green" />
        <StatCard label="Suspended" value={sellers.filter((x) => x.status === "Suspended").length} icon="fa-ban" tone="red" />
      </StatGrid>

      <section className={`${panel} p-6`}>
        <div className="grid grid-cols-[1fr_200px] gap-3 mb-5 max-[700px]:grid-cols-1">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search seller, shop or email..." className={`${inputCls} pl-9`} />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={inputCls} aria-label="Filter by status">
            {["All", "Active", "Suspended"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="w-full overflow-x-auto border border-[#eee] rounded-[10px] dark:border-night-line">
          <table className="w-full min-w-[800px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head"><tr>{["Seller", "Shop", "Contact", "Parcels", "Status", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            {loading ? <TableSkeleton rows={6} cols={6} /> : (
              <tbody>
                {pageRows.map((s) => (
                  <tr key={s.id} className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                    <td className={td}>
                      <div className="flex items-center gap-2.5"><Avatar initials={s.initials} tone={s.tone} className="w-9 h-9 text-[12px]" /><strong className="text-[#333] dark:text-[#f1eeeb]">{s.name}</strong></div>
                    </td>
                    <td className={td}>{s.shop}</td>
                    <td className={td}><span className="block">{s.email}</span><small className="text-[11px] text-[#aaa]">{s.phone}</small></td>
                    <td className={td}>{counts[s.name].total}</td>
                    <td className={td}><span className={`px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap ${tone[s.status]}`}>{s.status}</span></td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <button onClick={() => setView(s.id)} className="text-brand text-[13px] font-semibold hover:underline mr-3">View</button>
                      <button onClick={() => setConfirm({ seller: s, kind: actionFor(s) })} className={`text-[13px] font-semibold hover:underline ${actionFor(s) === "Suspend" ? "text-[#d94747]" : "text-[#29945a]"}`}>{actionFor(s)}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {!loading && rows.length === 0 && <EmptyState icon="fa-store" title="No sellers found" />}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
      </section>

      <Modal open={!!current} onClose={() => setView(null)} z="z-[3500]" className="w-full max-w-[520px] p-7 dark:bg-night-panel">
        {current && (
          <>
            <button onClick={() => setView(null)} aria-label="Close" className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f4f6f8] text-[#7c8da0] dark:bg-night-line"><i className="fa-solid fa-xmark" /></button>
            <div className="flex items-center gap-4 mb-5">
              <Avatar initials={current.initials} tone={current.tone} className="w-14 h-14 text-[18px]" />
              <div><h3 className="text-[18px] font-bold">{current.name}</h3><p className="text-[13px] text-[#999]">{current.shop} · joined {current.joined}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="rounded-xl bg-[#fffaf7] border border-[#ffe9dc] p-3.5 dark:bg-night-head dark:border-night-line"><small className="block text-[12px] text-[#999]">Total parcels</small><strong className="text-[20px]">{counts[current.name].total}</strong></div>
              <div className="rounded-xl bg-[#fffaf7] border border-[#ffe9dc] p-3.5 dark:bg-night-head dark:border-night-line"><small className="block text-[12px] text-[#999]">Delivered</small><strong className="text-[20px]">{counts[current.name].delivered}</strong></div>
            </div>
            <h4 className="text-[14px] font-bold mb-2">Parcel history</h4>
            {counts[current.name].recent.length === 0 ? (
              <p className="text-[13px] text-[#999]">No parcels yet.</p>
            ) : (
              <ul className="divide-y divide-[#f1f1f1] dark:divide-night-line">
                {counts[current.name].recent.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <span><strong>{p.id}</strong> · {p.item}</span><StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm ? actions[confirm.kind][2] : ""}
        text={confirm ? `${confirm.seller.name} (${confirm.seller.shop}). ${actions[confirm.kind][3]}` : ""}
        confirmLabel={confirm?.kind}
        danger={confirm ? actions[confirm.kind][4] : false}
        onConfirm={apply}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
