import { useNavigate } from "react-router-dom";
import { clearSession } from "../api.js";

// Nagbabalik ng function na naglo-logout: binubura ang token at bumabalik sa login.
export default function useLogout() {
  const navigate = useNavigate();
  return () => {
    clearSession();
    navigate("/login", { replace: true });
  };
}
