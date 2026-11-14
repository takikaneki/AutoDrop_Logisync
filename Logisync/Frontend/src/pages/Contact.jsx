import Topbar from "../components/Topbar.jsx";
import { ContactUsContent } from "../components/auth/ContactUsModal.jsx";
import { panel } from "../components/styles.js";
import { useProfile } from "../store/profile.js";
import { toast } from "../store/toast.js";

export default function Contact() {
  const me = useProfile();

  return (
    <>
      <Topbar title="Contact Us" subtitle="Reach the LogiSync team." />
      <div className="w-full max-w-[1100px]">
        <section className={`${panel} overflow-hidden shadow-sm`}>
          <ContactUsContent
            initialName={me.name}
            initialEmail={me.email}
            onSent={() => toast("Message sent. We'll get back to you soon.")}
            idPrefix="page-c"
            titleId="contact-page-title"
            supportDark
          />
        </section>
      </div>
    </>
  );
}
