import { Navigate } from "react-router-dom";

// Rider Reports has been integrated directly into My Parcels (/rider/parcels?report=1).
export default function RiderReports() {
  return <Navigate to="/rider/parcels?report=1" replace />;
}
