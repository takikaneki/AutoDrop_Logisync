import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Topbar from "../components/Topbar.jsx";
import { inputCls, panel } from "../components/styles.js";
import { useParcels, useRiders } from "../store/records.js";

const COLORS = { Delivered: "#16a34a", "In Transit": "#f97316", "Failed Delivery": "#d94747" };
const tick = { fontSize: 13, fill: "#8a8a8a" };

export default function Analytics() {
  const parcels = useParcels();
  const riders = useRiders();
  const [days, setDays] = useState("14");

  const data = useMemo(() => {
    const delivered = parcels.filter((p) => p.status === "Delivered");
    const failed = parcels.filter((p) => p.status === "Failed Delivery").length;
    const avg = delivered.length ? delivered.reduce((n, p) => n + p.hours, 0) / delivered.length : 0;

    const all = [...new Set(parcels.map((p) => p.iso))].sort();
    const dates = all.slice(-Number(days));
    const perDay = dates.map((iso) => {
      const day = parcels.filter((p) => p.iso === iso);
      return {
        day: new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        Delivered: day.filter((p) => p.status === "Delivered").length,
        "In Transit": day.filter((p) => p.status === "In Transit").length,
        "Failed Delivery": day.filter((p) => p.status === "Failed Delivery").length,
      };
    });

    const pie = Object.keys(COLORS).map((s) => ({ name: s, value: parcels.filter((p) => p.status === s).length }));
    const top = riders
      .map((r) => {
        const mine = parcels.filter((p) => p.rider === r.name && p.status === "Delivered");
        return { name: r.name.split(" ")[0], Delivered: mine.length };
      })
      .sort((a, b) => b.Delivered - a.Delivered);

    return {
      rate: delivered.length + failed ? Math.round((delivered.length / (delivered.length + failed)) * 100) : 0,
      avg: Math.round(avg * 10) / 10,
      flagged: Math.round((parcels.filter((p) => p.verification === "Flagged").length / parcels.length) * 1000) / 10,
      perDay,
      pie,
      top,
    };
  }, [parcels, riders, days]);

  const kpis = [
    ["Delivery success rate", `${data.rate}%`, "fa-circle-check", "bg-[#eaf8ef] text-[#25a35a]", "Delivered vs. failed"],
    ["Avg. delivery time", `${data.avg} hrs`, "fa-stopwatch", "bg-[#fff0e7] text-[#ff6818]", "For delivered parcels"],
    ["Flagged rate", `${data.flagged}%`, "fa-flag", "bg-[#fff0f0] text-[#d94747]", "Flagged during verification"],
    ["Active riders", riders.filter((r) => r.status !== "Off-duty").length, "fa-motorcycle", "bg-[#eaf3ff] text-[#4285c5]", `of ${riders.length} riders`],
  ];

  return (
    <>
      <Topbar title="Analytics" subtitle="Delivery performance across all parcels." />

      <section className="grid grid-cols-4 gap-5 mb-7 max-[1100px]:grid-cols-2 max-[600px]:grid-cols-1">
        {kpis.map(([l, v, ic, t, note]) => (
          <div key={l} className={`${panel} p-6 flex items-center gap-4`}>
            <span className={`w-[54px] h-[54px] shrink-0 rounded-2xl flex items-center justify-center text-[22px] ${t}`}><i className={`fa-solid ${ic}`} /></span>
            <div className="min-w-0"><small className="text-[13px] text-[#999]">{l}</small><strong className="block text-[26px] leading-tight">{v}</strong><small className="text-[11px] text-[#aaa]">{note}</small></div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-[2fr_1fr] gap-6 mb-6 max-[1100px]:grid-cols-1">
        <div className={`${panel} p-6 min-w-0`}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-[17px] font-bold">Parcels per day</h2>
            <select value={days} onChange={(e) => setDays(e.target.value)} className={`${inputCls} !w-[150px]`} aria-label="Date range">
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="27">Last 27 days</option>
            </select>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.perDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e4e8ef" vertical={false} />
                <XAxis dataKey="day" tickLine={false} tick={tick} />
                <YAxis tickLine={false} axisLine={false} tick={tick} />
                <Tooltip cursor={{ fill: "rgba(249,115,22,.08)" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="Delivered" stackId="a" fill={COLORS.Delivered} />
                <Bar dataKey="In Transit" stackId="a" fill={COLORS["In Transit"]} />
                <Bar dataKey="Failed Delivery" stackId="a" fill={COLORS["Failed Delivery"]} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${panel} p-6 min-w-0`}>
          <h2 className="text-[17px] font-bold mb-5">Status breakdown</h2>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.pie} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={2}>
                  {data.pie.map((s) => <Cell key={s.name} fill={COLORS[s.name]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6">
        <div className={`${panel} p-6 min-w-0`}>
          <h2 className="text-[17px] font-bold mb-5">Top riders <small className="text-[12px] font-normal text-[#999]">(delivered parcels)</small></h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e4e8ef" horizontal={false} />
                <XAxis type="number" tickLine={false} tick={tick} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={tick} width={60} />
                <Tooltip cursor={{ fill: "rgba(249,115,22,.08)" }} />
                <Bar dataKey="Delivered" fill="#f97316" radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </>
  );
}
