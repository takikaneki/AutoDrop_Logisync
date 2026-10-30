import { useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { btnPrimary, inputCls, labelCls, panel, textareaCls } from "../components/styles.js";
import { useProfile } from "../store/profile.js";
import { toast } from "../store/toast.js";

export default function Contact() {
  const me = useProfile();
  const [form, setForm] = useState({ name: me.name === "Guest" ? "" : me.name, email: me.email, subject: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (!form.name.trim()) err.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) err.email = "Please enter a valid email.";
    if (!form.message.trim()) err.message = "Please write a message.";
    setErrors(err);
    if (Object.keys(err).length) return;
    // TODO: POST /api/contact
    setSent(true);
    toast("Message sent. We'll get back to you soon.");
  };

  const info = [
    ["fa-envelope", "Email", "support@logisync.example"],
    ["fa-phone", "Phone", "(02) 8123 4567"],
    ["fa-location-dot", "Address", "Cavite State University, Cavite"],
    ["fa-clock", "Support hours", "Mon–Sat, 8:00 AM – 6:00 PM"],
  ];

  return (
    <>
      <Topbar title="Contact" subtitle="Reach the LogiSync team." />
      <div className="grid grid-cols-[1fr_1.4fr] gap-6 max-[1000px]:grid-cols-1">
        <section className={`${panel} p-7 h-fit`}>
          <h2 className="text-[18px] font-bold mb-5">Get in touch</h2>
          <ul className="space-y-5">
            {info.map(([ic, l, v]) => (
              <li key={l} className="flex gap-4">
                <span className="w-[42px] h-[42px] shrink-0 rounded-xl bg-brand-soft text-brand flex items-center justify-center dark:bg-night-line"><i className={`fa-solid ${ic}`} /></span>
                <div><small className="block text-[12px] text-[#999]">{l}</small><strong className="text-[14px]">{v}</strong></div>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${panel} p-7`}>
          {sent ? (
            <div className="py-10 text-center">
              <span className="w-[60px] h-[60px] mx-auto mb-4 rounded-full bg-[#eaf8ef] text-[#29945a] flex items-center justify-center text-[24px]"><i className="fa-solid fa-check" /></span>
              <h2 className="text-[18px] font-bold mb-2">Thank you!</h2>
              <p className="text-[14px] text-[#888] mb-5">Your message was sent. We'll reply to {form.email}.</p>
              <button onClick={() => { setSent(false); setForm((f) => ({ ...f, subject: "", message: "" })); }} className={btnPrimary}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h2 className="text-[18px] font-bold mb-5">Send us a message</h2>
              <div className="grid grid-cols-2 gap-4 mb-4 max-[600px]:grid-cols-1">
                <div><label className={labelCls} htmlFor="c-name">Name</label><input id="c-name" value={form.name} onChange={set("name")} className={inputCls} />{errors.name && <p className="mt-1 text-[12px] text-[#d94747]">{errors.name}</p>}</div>
                <div><label className={labelCls} htmlFor="c-email">Email</label><input id="c-email" type="email" value={form.email} onChange={set("email")} className={inputCls} />{errors.email && <p className="mt-1 text-[12px] text-[#d94747]">{errors.email}</p>}</div>
              </div>
              <div className="mb-4"><label className={labelCls} htmlFor="c-subject">Subject</label><input id="c-subject" value={form.subject} onChange={set("subject")} className={inputCls} /></div>
              <div className="mb-5"><label className={labelCls} htmlFor="c-msg">Message</label><textarea id="c-msg" rows={5} value={form.message} onChange={set("message")} className={textareaCls} />{errors.message && <p className="mt-1 text-[12px] text-[#d94747]">{errors.message}</p>}</div>
              <button type="submit" className={btnPrimary}><i className="fa-solid fa-paper-plane" /> Send message</button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
