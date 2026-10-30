import { useLocation } from "react-router-dom";

// Ang unang bahagi ng URL ng Seller/Rider ("/seller" o "/rider"). Walang laman para sa Coordinator.
// Ginagamit para tama ang mga link ng mga pahinang pinagsasaluhan (About, Contact, Help).
export default function useBase() {
  const first = useLocation().pathname.split("/")[1];
  return first === "seller" || first === "rider" ? `/${first}` : "";
}
