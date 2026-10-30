
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { StatCard, StatGrid } from "../components/portal.jsx";
import Pagination from "../components/Pagination.jsx";
import {
  Avatar,
  EmptyState,
  StatusBadge,
  TableSkeleton,
} from "../components/ui.jsx";
import {
  btnPrimary,
  inputCls,
  panel,
  td,
  th,
} from "../components/styles.js";
import { api } from "../api.js";
import { getParcelStatus } from "../utils/parcelStatus.js";

const statusIcons = {
  "In Transit": "fa-truck",
  Delivered: "fa-check",
  "Failed Delivery": "fa-triangle-exclamation",
};

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ["In Transit", "Delivered", "Failed Delivery"];

function mapParcel(parcel, index) {
  const sellerName = parcel.seller_name || "Unknown Seller";
  const initials = sellerName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const date = parcel.created_at ? new Date(parcel.created_at) : null;
  const validDate = date && !Number.isNaN(date.getTime());

  return {
    id: String(parcel.parcel_id ?? parcel.id ?? ""),
    transactionNumber: String(parcel.transaction_number || "—"),
    parcelId: parcel.parcel_id ?? parcel.id,
    seller: sellerName,
    shop: sellerName,
    initials: initials || "US",
    tone: "orange",
    recipient: parcel.receiver_name || "—",
    rider: parcel.rider_name || "Unassigned",
    status: getParcelStatus(parcel),
    dateLabel: validDate
      ? date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—",
    ts: validDate ? date.getTime() : index,
  };
}

export default function Parcels() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Galing sa Dashboard card, hal. /parcels?status=Failed Delivery (kapag mali ang value, "All Status")
  const urlStatus = searchParams.get("status");
  const initialStatus = STATUS_OPTIONS.includes(urlStatus) ? urlStatus : "All Status";

  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState({ key: "ts", dir: "desc" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function loadParcels() {
      try {
        setLoading(true);
        setError("");

        const data = await api("/parcels");

        if (!Array.isArray(data.parcels)) {
          throw new Error("Invalid parcel data returned by the server.");
        }

        const mappedParcels = data.parcels.map(mapParcel);

        if (active) {
          setParcels(mappedParcels);
          setPage(1);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load parcels.");
          setParcels([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadParcels();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setStatus(initialStatus);
    setPage(1);
  }, [initialStatus]);

  const counts = useMemo(() => {
    const result = {
      "In Transit": 0,
      Delivered: 0,
      "Failed Delivery": 0,
    };

    parcels.forEach((parcel) => {
      if (Object.hasOwn(result, parcel.status)) {
        result[parcel.status] += 1;
      }
    });

    return result;
  }, [parcels]);

  const rows = useMemo(() => {
    const query = search.toLowerCase().trim();

    const filtered = parcels.filter(
      (parcel) =>
        (status === "All Status" || parcel.status === status) &&
        (!query ||
          [
            parcel.id,
            parcel.transactionNumber,
            parcel.seller,
            parcel.recipient,
            parcel.rider,
          ].some((value) =>
            String(value || "").toLowerCase().includes(query)
          ))
    );

    const direction = sort.dir === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const first = a[sort.key] ?? "";
      const second = b[sort.key] ?? "";

      if (first > second) return direction;
      if (first < second) return -direction;
      return 0;
    });
  }, [parcels, search, status, sort]);

  const pageRows = rows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const reset = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const toggleSort = (key) => {
    setSort((current) =>
      current.key === key
        ? {
            key,
            dir: current.dir === "asc" ? "desc" : "asc",
          }
        : { key, dir: "asc" }
    );
  };

  const cards = [
    {
      label: "In Transit",
      icon: "fa-truck",
      tone: "orange",
    },
    {
      label: "Delivered",
      icon: "fa-circle-check",
      tone: "green",
    },
    {
      label: "Failed Delivery",
      icon: "fa-triangle-exclamation",
      tone: "red",
    },
  ];

  const SortTh = ({ k, children }) => (
    <th
      className={`${th} cursor-pointer select-none hover:text-brand`}
      onClick={() => toggleSort(k)}
    >
      {children}
      <i
        className={`fa-solid ml-1.5 text-[10px] ${
          sort.key === k
            ? sort.dir === "asc"
              ? "fa-arrow-up text-brand"
              : "fa-arrow-down text-brand"
            : "fa-sort opacity-40"
        }`}
      />
    </th>
  );

  return (
    <>
      <Topbar
        title="Parcel Management"
        subtitle="Monitor parcel movement and delivery activities."
      >
        <Link to="/reports" className={btnPrimary}>
          <i className="fa-solid fa-file-lines" /> Generate Report
        </Link>
      </Topbar>

      <StatGrid cols={3}>
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={loading ? "—" : counts[card.label]} icon={card.icon} tone={card.tone} />
        ))}
      </StatGrid>

      <section className={`${panel} p-[26px] max-[600px]:p-[18px]`}>
        <div className="mb-[18px]">
          <h2 className="text-[19px] font-bold mb-[5px]">
            Parcel Records
          </h2>
          <p className="text-xs text-[#999]">
            Search, filter and open a parcel to see its tracking timeline and proof of delivery.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <p>{error}</p>
            <button
              type="button"
              className="mt-2 font-semibold underline"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        )}

        <div className="grid grid-cols-[1fr_190px] gap-3 mb-[18px] max-[900px]:grid-cols-1">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#aaa]" />
            <input
              value={search}
              onChange={reset(setSearch)}
              placeholder="Search parcel ID, transaction no., seller, recipient or rider..."
              className={`${inputCls} pl-9`}
            />
          </div>

          <select
            value={status}
            onChange={reset(setStatus)}
            className={inputCls}
            aria-label="Filter by status"
          >
            <option>All Status</option>
            <option>In Transit</option>
            <option>Delivered</option>
            <option>Failed Delivery</option>
          </select>
        </div>

        <div className="w-full overflow-x-auto border border-[#eee] rounded-[10px] dark:border-night-line">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="bg-[#fafafa] dark:bg-night-head">
              <tr>
                <SortTh k="id">Tracking ID</SortTh>
                <SortTh k="seller">Seller</SortTh>
                <SortTh k="recipient">Recipient</SortTh>
                <SortTh k="rider">Rider</SortTh>
                <SortTh k="ts">Date</SortTh>
                <th className={th}>Status</th>
              </tr>
            </thead>

            {loading ? (
              <TableSkeleton rows={PAGE_SIZE} cols={6} />
            ) : (
              <tbody>
                {pageRows.map((parcel) => (
                  <tr
                    key={parcel.parcelId ?? parcel.id}
                    onClick={() =>
                      navigate(`/parcels/${encodeURIComponent(parcel.parcelId)}`)
                    }
                    className="cursor-pointer text-[#666] hover:bg-[#fffaf7] dark:text-[#d1c9c2] dark:hover:bg-night-head"
                  >
                    <td className={td}>
                      <Link
                        to={`/parcels/${encodeURIComponent(parcel.parcelId)}`}
                        onClick={(event) => event.stopPropagation()}
                        className="font-bold text-brand hover:underline"
                      >
                        {parcel.id}
                      </Link>
                    </td>

                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={parcel.initials}
                          tone={parcel.tone}
                        />
                        <div>
                          <strong className="block text-[14px] text-[#333] dark:text-[#f1eeeb]">
                            {parcel.seller}
                          </strong>
                          <span className="block text-[11px] text-[#aaa]">
                            {parcel.shop}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className={td}>{parcel.recipient}</td>
                    <td className={td}>{parcel.rider}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {parcel.dateLabel}
                    </td>
                    <td className={td}>
                      <StatusBadge
                        status={parcel.status}
                        icon={statusIcons[parcel.status]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>

          {!loading && !error && rows.length === 0 && (
            <EmptyState
              title="No parcels found"
              text="Try a different search or filter."
            />
          )}
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onPage={setPage}
        />
      </section>
    </>
  );
}
