import Topbar from "../../components/Topbar.jsx";
import ChatView from "../../components/messaging/ChatView.jsx";
import { Notice } from "../../components/portal.jsx";
import { getRole } from "../../api.js";

// Messages ng Seller at Rider (ang kausap ay Coordinator lang, ayon sa backend)
export default function MessagesPage() {
  return (
    <>
      <Topbar title="Messages" subtitle="Talk with your coordinator. Messages refresh every 15 seconds." />
      <div className="mb-5">
        <Notice tone="info" icon="fa-lock">
          <strong>{getRole() === "rider" ? "Riders" : "Sellers"} can only message the Coordinator.</strong>{" "}
          <span>Messaging {getRole() === "rider" ? "sellers or other riders" : "other sellers or riders"} is not allowed.</span>
        </Notice>
      </div>
      <ChatView
        btnClass="bg-brand hover:bg-brand-dark"
        activeClass="bg-brand-soft dark:bg-night-head"
        surface="bg-white border-[#eee] dark:bg-night-panel dark:border-night-line"
      />
    </>
  );
}
