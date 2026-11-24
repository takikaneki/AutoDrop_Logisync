import Topbar from "../components/Topbar.jsx";
import { ContactUsContent } from "../components/auth/ContactUsModal.jsx";
import { useProfile } from "../store/profile.js";
import { toast } from "../store/toast.js";

export default function Contact() {
  const profile = useProfile();

  return (
    <>
      <Topbar title="Contact Us" subtitle="Reach the LogiSync team." />
      <div className="mx-auto w-full max-w-5xl">
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-slate-900 shadow-sm dark:border-night-line dark:bg-night-panel dark:text-[#f1eeeb]">
          <ContactUsContent
            supportDark
            initialName={profile?.name || ""}
            initialEmail={profile?.email || ""}
            onSent={() => toast("Message sent. We'll get back to you soon.")}
            idPrefix="page-c"
            titleId="contact-page-title"
          />
        </section>
      </div>
    </>
  );
}
