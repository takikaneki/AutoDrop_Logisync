import Topbar from "../../components/Topbar.jsx";
import ChatView from "../../components/messaging/ChatView.jsx";

// Messages ng Seller at Rider (ang kausap ay Coordinator lang, ayon sa backend)
export default function MessagesPage() {
  return (
    <>
      <Topbar title="Messages" subtitle="Talk with your coordinator. Messages refresh every 15 seconds." />
      <ChatView
        btnClass="bg-brand hover:bg-brand-dark"
        activeClass="bg-brand-soft dark:bg-night-head"
        surface="bg-white border-[#eee] dark:bg-night-panel dark:border-night-line"
      />
    </>
  );
}
