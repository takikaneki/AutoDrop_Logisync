import { Navigate } from "react-router-dom";

// Reports has been integrated directly into Parcel Records (/parcels?report=1).
export default function Reports() {
  return <Navigate to="/parcels?report=1" replace />;
}
