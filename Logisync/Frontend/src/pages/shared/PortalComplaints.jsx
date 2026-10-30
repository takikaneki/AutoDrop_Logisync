import { useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { EmptyState } from "../../components/ui.jsx";
import { Notice } from "../../components/portal.jsx";
import { btnPrimary, inputCls, labelCls, panel, td, textareaCls, th } from "../../components/styles.js";
import useBase from "../../hooks/useBase.js";
import { getUser } from "../../api.js";
import { addComplaint, useComplaints } from "../../store/records.js";
import { addNotification } from "../../store/notifications.js";
import { toast } from "../../store/toast.js";

const statusTone = {
  Open: "bg-[#fff0f0] text-[#d94747]",
  "In Progress": "bg-[#fef3c7] text-[#d97706]",
  Resolved: "bg-[#eaf8ef] text-[#29945a]",
};

const CONFIG = {
  rider: {
    title: "Complaints / Urgent Request",
    subtitle: "Report a problem or ask the coordinator for urgent help (accident, vehicle problem, emergency).",
    role: "Rider",
    types: ["Complaint", "Urgent Request"],
    categories: {
      Complaint: ["Delivery", "Address", "Packaging", "Seller", "System", "Other"],
      "Urgent Request": ["Accident", "Vehicle problem", "Emergency / Medical", "Route blocked", "Other"],
    },
  },
  seller: {
    title: "Complaints / Requests",
    subtitle: "Submit a complaint or send a request to the coordinator.",
    role: "Seller",
    types: ["Complaint", "Request"],
    categories: {
      Complaint: ["Delivery", "Verification", "Payment", "Rider", "System", "Other"],
      Request: ["Parcel record", "Verification", "Account", "Other"],
    },
  },
};

const empty = { type: "Complaint", category: "", subject: "", description: "", parcel: "" };

// Pareho para sa Seller at Rider. Napupunta sa Complaints page ng Coordinator, at dito makikita ang sagot niya.
export default function PortalComplaints() {
  const role = useBase().slice(1);
  const cfg = CONFIG[role];
  const user = getUser();
  const all = useComplaints();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  const mine = all.filter((c) => c.userId === Number(user?.user_id) || (!c.userId && c.from === user?.name && c.role === cfg.role));
  const urgent = form.type === "Urgent Request";
  const categories = cfg.categories[form.type];
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value, ...(k === "type" ? { category: "" } : {}) }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.category) return setError("Please choose a category.");
    if (!form.subject.trim()) return setError("Please enter a subject.");
    if (!form.description.trim()) return setError("Please describe the problem or request.");
    setError("");

    // TODO: POST /api/complaints
    const c = addComplaint({
      userId: Number(user?.user_id),
      from: user?.name || cfg.role,
      role: cfg.role,
      kind: form.type,
      category: urgent ? `Urgent · ${form.category}` : form.category,
      subject: form.subject.trim(),
      description: form.description.trim() + (form.parcel.trim() ? `\n\nRelated parcel: ${form.parcel.trim()}` : ""),
      priority: urgent ? "High" : "Medium",
    });
    addNotification({
      kind: role,
      icon: urgent ? "fa-triangle-exclamation" : "fa-headset",
      tone: urgent ? "red" : "orange",
      read: false,
      title: `${user?.name || cfg.role} sent ${urgent ? "an urgent request" : form.type === "Request" ? "a request" : "a complaint"}`,
      text: c.subject,
      to: "/complaints",
    });
    setForm(empty);
    toast(`${c.id} submitted. The coordinator will review it.`);
  };

  const current = openId && mine.find((c) => c.id === openId);

  return (
    <>
      <Topbar title={cfg.title} subtitle={cfg.subtitle} />

      <section className={`${panel} mb-6 p-[26px] max-[600px]:p-5`}>
        <h2 className="mb-4 text-[17px] font-bold"><i className="fa-solid fa-pen-to-square mr-2 text-brand" />New submission</h2>
        {urgent && (
          <div className="mb-4">
            <Notice tone="error" icon="fa-triangle-exclamation">
              Urgent requests are marked <strong>High priority</strong> for the coordinator. For life-threatening emergencies, call emergency services first.
            </Notice>
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
            <div>
              <label className={labelCls} htmlFor="c-type">Type</label>
              <select id="c-type" value={form.type} onChange={set("type")} className={inputCls}>
                {cfg.types.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="c-cat">Category</label>
              <select id="c-cat" value={form.category} onChange={set("category")} className={inputCls}>
                <option value="">Select…</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-[2fr_1fr] gap-4 max-[700px]:grid-cols-1">
            <div>
              <label className={labelCls} htmlFor="c-subject">Subject</label>
              <input id="c-subject" value={form.subject} onChange={set("subject")} maxLength={120} placeholder={urgent ? "e.g. Motorcycle broke down on Rizal St." : "Short summary"} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="c-parcel">Related parcel (optional)</label>
              <input id="c-parcel" value={form.parcel} onChange={set("parcel")} maxLength={60} placeholder="Transaction no. / Parcel ID" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="c-desc">Details</label>
            <textarea id="c-desc" rows={4} value={form.description} onChange={set("description")} maxLength={1000} placeholder="What happened? Include your location if it is urgent." className={textareaCls} />
          </div>
          {error && <p role="alert" className="text-[13px] font-semibold text-[#d94747]"><i className="fa-solid fa-circle-exclamation mr-1" />{error}</p>}
          <button type="submit" className={btnPrimary}><i className="fa-solid fa-paper-plane" /> Submit to coordinator</button>
        </form>
      </section>

      <section className={`${panel} p-[26px] max-[600px]:p-5`}>
        <h2 className="mb-4 text-[17px] font-bold"><i className="fa-solid fa-clock-rotate-left mr-2 text-brand" />My submissions</h2>
        {mine.length === 0 ? (
          <EmptyState icon="fa-inbox" title="Nothing submitted yet" text="Your complaints and requests will be listed here with the coordinator's response." />
        ) : (
          <div className="w-full overflow-x-auto rounded-[10px] border border-[#eee] dark:border-night-line">
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="bg-[#fafafa] dark:bg-night-head"><tr>{["Ticket", "Subject", "Type", "Date", "Status", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {mine.map((c) => (
                  <tr key={c.id} className="text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head">
                    <td className={`${td} font-bold text-[#333] dark:text-[#f1eeeb]`}>{c.id}</td>
                    <td className={`${td} max-w-[260px]`}><span className="line-clamp-2">{c.subject}</span></td>
                    <td className={td}>{c.kind || "Complaint"}{c.priority === "High" && <span className="ml-1.5 text-[11px] font-bold text-[#d94747]">URGENT</span>}</td>
                    <td className={`${td} whitespace-nowrap`}>{c.date}</td>
                    <td className={td}><span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold ${statusTone[c.status]}`}>{c.status}</span></td>
                    <td className={`${td} text-right`}><button onClick={() => setOpenId(openId === c.id ? null : c.id)} className="text-[13px] font-semibold text-brand hover:underline">{openId === c.id ? "Hide" : "View"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {current && (
          <div className="mt-4 rounded-xl border border-[#ffe9dc] bg-[#fffaf7] p-4 text-[14px] dark:border-night-line dark:bg-night-head">
            <strong className="block">{current.subject}</strong>
            <p className="mt-1 whitespace-pre-line text-[#777] dark:text-[#d1c9c2]">{current.description}</p>
            <h4 className="mb-1.5 mt-3 text-[13px] font-bold">Updates from the coordinator</h4>
            {current.notes?.length ? (
              <ul className="space-y-1.5">{current.notes.map((n, i) => <li key={i} className="rounded-lg bg-white px-3 py-2 text-[13px] dark:bg-night-panel"><i className="fa-solid fa-user-tie mr-1.5 text-brand" />{n}</li>)}</ul>
            ) : (
              <p className="text-[13px] text-[#999]">No updates yet.</p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
