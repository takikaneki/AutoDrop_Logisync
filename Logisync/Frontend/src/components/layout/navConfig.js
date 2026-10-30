// Mga link sa sidebar ng Seller at Rider. Parehong istruktura ng sidebar ng Coordinator (may mga grupo).
// "path" ay kaugnay ng /seller o /rider. Ang "" ay ang dashboard mismo.
export const NAV = {
  seller: [
    {
      title: "Overview",
      links: [
        { path: "", label: "Dashboard", icon: "fa-chart-pie" },
        { path: "activity", label: "Activity Log", icon: "fa-clipboard-list" },
      ],
    },
    {
      title: "Parcels",
      links: [
        { path: "parcels", label: "Parcel Records", icon: "fa-box-open" },
        { path: "create", label: "Create Parcel", icon: "fa-square-plus" },
        { path: "scan", label: "Scan QR / Upload Video", icon: "fa-qrcode" },
      ],
    },
    {
      title: "Communication",
      links: [
        { path: "messages", label: "Messages", icon: "fa-comments" },
        { path: "complaints", label: "Complaints / Requests", icon: "fa-headset" },
        { path: "notifications", label: "Notifications", icon: "fa-bell" },
      ],
    },
  ],
  rider: [
    {
      title: "Overview",
      links: [
        { path: "", label: "Dashboard", icon: "fa-chart-pie" },
        { path: "activity", label: "Activity Log", icon: "fa-clipboard-list" },
      ],
    },
    {
      title: "Deliveries",
      links: [
        { path: "scan", label: "Scan QR Code", icon: "fa-qrcode" },
        { path: "parcels", label: "My Parcels", icon: "fa-boxes-stacked" },
        { path: "deliveries", label: "Deliveries", icon: "fa-truck-fast" },
        { path: "reports", label: "My Reports", icon: "fa-file-lines" },
      ],
    },
    {
      title: "Communication",
      links: [
        { path: "messages", label: "Messages", icon: "fa-comments" },
        { path: "complaints", label: "Complaints / Urgent Request", icon: "fa-headset" },
        { path: "notifications", label: "Notifications", icon: "fa-bell" },
      ],
    },
  ],
};

export const ROLE_LABEL = { seller: "Seller Portal", rider: "Rider Portal" };

// Mga link sa itaas na bar (Home ay idinadagdag sa header)
export const TOP_LINKS = [
  { path: "about", label: "About Us" },
  { path: "contact", label: "Contact" },
  { path: "help", label: "Help" },
];

// toPath("seller", "parcels") -> "/seller/parcels"   toPath("seller", "") -> "/seller"
export const toPath = (role, sub) => (sub ? `/${role}/${sub}` : `/${role}`);
