import { useNavigate } from "react-router-dom";
import { clearSession } from "../api.js";

export default function LogoutModal({ open, onClose }) {
  const navigate = useNavigate();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(70,50,35,.35)]" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[350px] max-w-[calc(100%-30px)] p-7 text-center bg-[#fffdfb] rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,.15)] animate-popup dark:bg-[#38322e] dark:text-[#f5f1ed]">
        <div className="w-[38px] h-[38px] mx-auto mb-3.5 rounded-full bg-[#fff0e5] text-brand flex items-center justify-center text-[22px] font-bold">!</div>
        <h3 className="mb-[22px] text-base">Are you sure you want to log out?</h3>
        <div className="flex justify-center gap-2.5">
          <button className="min-w-[80px] px-5 py-[9px] rounded-lg font-semibold bg-brand text-white" onClick={() => { clearSession(); navigate("/login"); }}>
            Yes
          </button>
          <button className="min-w-[80px] px-5 py-[9px] rounded-lg font-semibold bg-[#eee9e5] text-[#555] dark:bg-[#514943] dark:text-[#eee]" onClick={onClose}>
            No
          </button>
        </div>
      </div>
    </div>
  );
}
