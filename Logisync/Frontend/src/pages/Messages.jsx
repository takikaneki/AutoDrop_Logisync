import Topbar from "../components/Topbar.jsx";
import ChatView from "../components/messaging/ChatView.jsx";

// Messages ng coordinator: totoong /api/messages at /api/users/contacts.
// Backend rule: coordinator <-> seller/rider lang. Ang contacts ay lahat ng seller at rider.
export default function Messages() {
  return (
    <>
      <Topbar title="Messages" subtitle="Talk with sellers and riders. Messages refresh every 15 seconds." />
      <ChatView
        btnClass="bg-brand hover:bg-brand-dark"
        activeClass="bg-brand-soft dark:bg-night-head"
        surface="bg-white border-[#eee] dark:bg-night-panel dark:border-night-line"
      />
    </>
  );
}
