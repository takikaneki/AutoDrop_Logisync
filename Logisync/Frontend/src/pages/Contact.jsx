import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { ContactUsContent } from "../components/auth/ContactUsModal.jsx";
import { toast } from "../store/toast.js";

export default function Contact() {
  const navigate = useNavigate();

  return (
    <>
      <Topbar title="Contact Us" subtitle="Reach the LogiSync team." />
      <div className="w-full max-w-3xl">
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-slate-900 shadow-sm">
          <ContactUsContent
            onClose={() => navigate(-1)}
            onSent={() => toast("Message sent. We'll get back to you soon.")}
            idPrefix="page-c"
            titleId="contact-page-title"
          />
        </section>
      </div>
    </>
  );
}
