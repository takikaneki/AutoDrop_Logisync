import { useNavigate } from "react-router-dom";
import { logoutUser } from "../api.js";

// Nagbabalik ng function na naglo-logout: binubura ang token at bumabalik sa login.
export default function useLogout() {
  const navigate = useNavigate();
  return async () => {
    await logoutUser();
    navigate("/login", { replace: true });
  };
}
