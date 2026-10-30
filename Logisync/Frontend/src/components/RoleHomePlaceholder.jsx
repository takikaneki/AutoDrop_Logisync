import { useEffect, useState } from "react";
import { api, getUser } from "../api.js";

// Pansamantalang laman ng Seller/Rider dashboard (nasa loob na ng DashboardLayout).
// Papalitan natin ito ng totoong dashboard sa susunod na mga step.
export default function RoleHomePlaceholder({ title }) {
  const saved = getUser();
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  // Tinatanong natin ang TOTOONG backend kung sino ang naka-login (GET /api/auth/me)
  useEffect(() => {
    api("/auth/me")
      .then((data) => setMe(data.user))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">Welcome, {saved?.name}!</p>

      <div className="mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-2 font-semibold">Server check (GET /api/auth/me)</p>
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
        {!error && !me && <p>Checking...</p>}
        {me && (
          <ul className="space-y-1">
            <li>Name: {me.name}</li>
            <li>Email: {me.email}</li>
            <li>Role: {me.role}</li>
          </ul>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        The real dashboard is coming in the next steps.
      </p>
    </div>
  );
}
