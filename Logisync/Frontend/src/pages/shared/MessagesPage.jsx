import Topbar from "../../components/Topbar.jsx";
import ChatView from "../../components/messaging/ChatView.jsx";
import { Notice } from "../../components/portal.jsx";
import { getRole } from "../../api.js";

// Messages ng Seller at Rider (ang kausap ay Coordinator lang, ayon sa backend)
export default function MessagesPage() {
  const role = getRole();
  const isSeller = role === "seller";

  return (
    <>
      <Topbar title="Messages" subtitle="Talk with your coordinator. Messages refresh every 15 seconds." />
      {!isSeller && (
        <div className="mb-5">
          <Notice tone="info" icon="fa-lock">
            <strong>Riders can only message the Coordinator.</strong>{" "}
            <span>Messaging sellers or other riders is not allowed.</span>
          </Notice>
        </div>
      )}
      <ChatView
        btnClass="bg-brand hover:bg-brand-dark"
        activeClass="bg-brand-soft dark:bg-night-head"
        surface="bg-white border-[#eee] dark:bg-night-panel dark:border-night-line"
        directMode={isSeller}
      />
    </>
  );
}
