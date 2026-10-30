import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function SellerVerification() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedSeller, setSelectedSeller] = useState(null);

  async function loadSellers() {
    setLoading(true);
    setError("");

    try {
      const data = await api("/users?role=seller");
      setSellers(data.users || []);
    } catch (err) {
      setError(
        err.message || "Unable to load seller accounts. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function reviewSeller() {
    if (!selectedSeller) return;

    const { seller, status } = selectedSeller;
    setUpdatingId(seller.user_id);
    setError("");

    try {
      await api(`/users/${seller.user_id}/verification`, {
        method: "PATCH",
        body: { status },
      });

      setSelectedSeller(null);
      await loadSellers();
    } catch (err) {
      setError(err.message || "Unable to update seller verification.");
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    loadSellers();
  }, []);

  const pendingCount = sellers.filter(
    (seller) => seller.verification_status === "PENDING"
  ).length;

  const isApproving = selectedSeller?.status === "APPROVED";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Seller Account Verification</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and approve or reject newly registered seller accounts.
        </p>
      </div>

      <div className="rounded-xl border border-[#eee] bg-white p-4 shadow-sm dark:border-night-line dark:bg-night-panel">
  <p className="text-sm text-[#666] dark:text-[#d1c9c2]">
    Pending Seller Accounts
  </p>
  <p className="mt-1 text-3xl font-bold text-[#333] dark:text-[#f1eeeb]">
    {pendingCount}
  </p>
</div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading seller accounts...</p>
      ) : sellers.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-gray-500">
          No seller accounts found.
        </p>
      ) : (
        <div className="w-full overflow-x-auto border border-[#eee] rounded-[10px] dark:border-night-line">
  <table className="w-full min-w-[650px] border-collapse text-left text-sm text-[#666] dark:text-[#d1c9c2]">
    <thead className="bg-gray-50 text-gray-700 dark:bg-night-head dark:text-[#f1eeeb]">
      <tr>
        <th className="p-3">Name</th>
        <th className="p-3">Email</th>
        <th className="p-3">Status</th>
        <th className="p-3">Actions</th>
      </tr>
    </thead>

    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
      {sellers.map((seller) => (
        <tr
          key={seller.user_id}
         className="bg-white transition-colors hover:bg-[#fffaf7] dark:bg-night-panel dark:hover:bg-night-head"
        >
          <td className="p-3 font-medium text-gray-900 dark:text-gray-100">
            {seller.name}
          </td>

          <td className="p-3 text-gray-600 dark:text-gray-300">
            {seller.email}
          </td>

          <td className="p-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                seller.verification_status === "APPROVED"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                  : seller.verification_status === "REJECTED"
                  ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
              }`}
            >
              {seller.verification_status || "UNKNOWN"}
            </span>
          </td>

          <td className="p-3">
            {seller.verification_status === "PENDING" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={updatingId !== null}
                  onClick={() =>
                    setSelectedSeller({ seller, status: "APPROVED" })
                  }
                  className="rounded-lg bg-green-600 px-3 py-2 text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>

                <button
                  type="button"
                  disabled={updatingId !== null}
                  onClick={() =>
                    setSelectedSeller({ seller, status: "REJECTED" })
                  }
                  className="rounded-lg bg-red-600 px-3 py-2 text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">
                No action needed
              </span>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
      )}

      <button
        type="button"
        onClick={loadSellers}
        disabled={loading || updatingId !== null}
       className="rounded-[10px] border border-[#eee] bg-white px-4 py-2 text-[#666] transition hover:bg-[#fffaf7] disabled:opacity-50 dark:border-night-line dark:bg-night-panel dark:text-[#d1c9c2] dark:hover:bg-night-head"
      >
        Refresh List
      </button>

      {selectedSeller && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && updatingId === null) {
              setSelectedSeller(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && updatingId === null) {
              setSelectedSeller(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-confirm-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                isApproving
                  ? "bg-green-100 text-green-600"
                  : "bg-red-100 text-red-600"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-7 w-7"
                aria-hidden="true"
              >
                {isApproving ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m5 12 4 4L19 6"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z"
                  />
                )}
              </svg>
            </div>

            <h2
              id="seller-confirm-title"
              className="text-center text-xl font-bold text-gray-900"
            >
              {isApproving
                ? "Approve Seller Account?"
                : "Reject Seller Account?"}
            </h2>

            <p className="mt-2 text-center text-sm leading-6 text-gray-500">
              {isApproving
                ? "Are you sure you want to approve this seller account?"
                : "Are you sure you want to reject this seller account?"}
            </p>

            <div className="mt-5 rounded-xl border bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">
                {selectedSeller.seller.name}
              </p>
              <p className="mt-1 break-all text-sm text-gray-500">
                {selectedSeller.seller.email}
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                disabled={updatingId !== null}
                onClick={() => setSelectedSeller(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingId !== null}
                onClick={reviewSeller}
                className={`flex-1 rounded-lg px-4 py-2.5 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isApproving
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {updatingId !== null
                  ? "Processing..."
                  : isApproving
                  ? "Approve Account"
                  : "Reject Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}