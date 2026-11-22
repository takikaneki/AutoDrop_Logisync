import { getUser } from "../../api.js";

// Mga link sa sidebar ng Seller at Rider. Parehong istruktura ng sidebar ng Coordinator (may mga grupo).
// "path" ay kaugnay ng /seller o /rider. Ang "" ay ang dashboard mismo.
export const NAV = {
  seller: [
    {
      title: "Overview",
      links: [
        { path: "", label: "Dashboard", icon: "house" },
        { path: "activity", label: "Activity Log", icon: "history" },
      ],
    },
    {
      title: "Parcels",
      links: [
        { path: "parcels", label: "Parcel Records", icon: "package" },
        { path: "create", label: "Create Parcel", icon: "square-plus" },
        { path: "scan", label: "Scan QR / Upload Video", icon: "scan-line" },
      ],
    },
    {
      title: "Communication",
      links: [
        { path: "messages", label: "Messages", icon: "message-circle" },
        { path: "complaints", label: "Complaints / Requests", icon: "clipboard-list" },
        { path: "notifications", label: "Notifications", icon: "bell" },
      ],
    },
  ],
  rider: [
    {
      title: "Overview",
      links: [
        { path: "", label: "Dashboard", icon: "house" },
        { path: "activity", label: "Activity Log", icon: "history" },
      ],
    },
    {
      title: "Deliveries",
      links: [
        { path: "scan", label: "Scan QR Code", icon: "scan-line" },
        { path: "deliveries", label: "Deliveries", icon: "truck" },
      ],
    },
    {
      title: "Communication",
      links: [
        { path: "messages", label: "Messages", icon: "message-circle" },
        { path: "complaints", label: "Complaints / Urgent Request", icon: "clipboard-list" },
        { path: "notifications", label: "Notifications", icon: "bell" },
      ],
    },
  ],
};

export const ROLE_LABEL = { seller: "Seller Portal", rider: "Rider Portal" };

// Rider classification: FM = First Mile (seller pickups), LM = Last Mile (buyer deliveries).
// Mga lumang session na walang rider_type ay LM (dating gawi ng sistema).
export const riderTypeOf = (user = getUser()) =>
  String(user?.rider_type || "LM").toUpperCase() === "FM" ? "FM" : "LM";

// Mga rider page na para sa LM lang (deliveries, scanning ng parcel para ihatid).
const LM_ONLY_PATHS = new Set(["scan", "parcels", "deliveries"]);

// Nav ayon sa role (at rider type). Ang FM rider ay walang delivery pages.
export function navFor(role) {
  const groups = NAV[role] || [];
  if (role !== "rider" || riderTypeOf() === "LM") return groups;
  return groups
    .map((g) => ({ ...g, links: g.links.filter((l) => !LM_ONLY_PATHS.has(l.path)) }))
    .filter((g) => g.links.length > 0);
}

// Support links sa sidebar (pareho sa Coordinator, Seller, at Rider web view)
export const TOP_LINKS = [
  { path: "contact", label: "Contact Us" },
  { path: "help", label: "FAQs" },
  { path: "about", label: "About LOGISYNC" },
];

// toPath("seller", "parcels") -> "/seller/parcels"   toPath("seller", "") -> "/seller"
export const toPath = (role, sub) => (sub ? `/${role}/${sub}` : `/${role}`);
