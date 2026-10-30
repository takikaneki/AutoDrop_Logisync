// Mock data muna. Palitan ng fetch("/api/...") kapag ready na ang Express API.

export const summaryCards = [
  { title: "Total Parcels", value: 250, change: "↑ 12%", up: true, icon: "fa-box", tone: "orange" },
  { title: "Pending Verification", value: 35, change: "↓ 5%", up: false, icon: "fa-clock", tone: "yellow" },
  { title: "Verified Parcels", value: 180, change: "↑ 18%", up: true, icon: "fa-circle-check", tone: "green" },
  { title: "Flagged Parcels", value: 12, change: "↑ 3%", up: false, icon: "fa-triangle-exclamation", tone: "red" },
];

export const activityBars = [40, 60, 48, 72, 55, 85, 65];

export const recentParcels = [
  { id: "PT-001", seller: "Lyn's Shop", status: "In Transit", verification: "Pending", date: "Sep 19, 2026 10:24 AM" },
  { id: "PT-002", seller: "Mia's Finds", status: "Delivered", verification: "Verified", date: "Sep 19, 2026 09:12 AM" },
  { id: "PT-003", seller: "Casa Goods", status: "Processing", verification: "Pending", date: "Sep 19, 2026 08:45 AM" },
  { id: "PT-004", seller: "Nica Store", status: "In Transit", verification: "Pending", date: "Sep 19, 2026 08:20 AM" },
  { id: "PT-005", seller: "Daily Finds", status: "Delivered", verification: "Verified", date: "Sep 19, 2026 07:55 AM" },
  { id: "PT-006", seller: "Casa Goods", status: "In Transit", verification: "Verified", date: "Sep 19, 2026 07:30 AM" },
  { id: "PT-007", seller: "Mia's Finds", status: "Delivered", verification: "Verified", date: "Sep 19, 2026 07:05 AM" },
];

export const parcelStatusCards = [
  { label: "In Transit", value: 156, note: "Currently being delivered", icon: "fa-truck", tone: "orange" },
  { label: "Delivered", value: 82, note: "Successfully delivered", icon: "fa-circle-check", tone: "green" },
  { label: "Failed Delivery", value: 10, note: "Delivery needs attention", icon: "fa-triangle-exclamation", tone: "red" },
];

export const parcelRecords = [
  { seller: "Maria Santos", initials: "MS", tone: "orange", recipient: "Juan Dela Cruz", date: "Sept 27, 2026", status: "In Transit" },
  { seller: "Angela Reyes", initials: "AR", tone: "purple", recipient: "Mark Garcia", date: "Sept 27, 2026", status: "Delivered" },
  { seller: "Carlo Mendoza", initials: "CM", tone: "blue", recipient: "Sofia Ramos", date: "Sept 27, 2026", status: "Failed Delivery" },
  { seller: "Kevin Cruz", initials: "KC", tone: "green", recipient: "Anna Lopez", date: "Sept 27, 2026", status: "In Transit" },
  { seller: "Lisa Torres", initials: "LT", tone: "pink", recipient: "Daniel Tan", date: "Sept 27, 2026", status: "Delivered" },
];

export const verificationParcels = [
  { id: "PT-001", seller: "Lyn's Shop", date: "2026-09-27", dateLabel: "Sep 27, 2026", status: "pending", description: "Wireless Earbuds" },
  { id: "PT-002", seller: "Mia's Finds", date: "2026-09-27", dateLabel: "Sep 27, 2026", status: "verified", description: "Phone Case" },
  { id: "PT-003", seller: "Casa Goods", date: "2026-09-26", dateLabel: "Sep 26, 2026", status: "flagged", description: "Kitchen Organizer" },
  { id: "PT-004", seller: "Nica Store", date: "2026-09-26", dateLabel: "Sep 26, 2026", status: "pending", description: "Beauty Organizer" },
  { id: "PT-005", seller: "Daily Finds", date: "2026-09-25", dateLabel: "Sep 25, 2026", status: "verified", description: "Desk Lamp" },
  { id: "PT-006", seller: "Shop Haven", date: "2026-09-25", dateLabel: "Sep 25, 2026", status: "returned", description: "Storage Box" },
];

export const contacts = [
  { name: "Mark Cruz", role: "Rider", concern: "Vehicle Problem", tone: "red", unread: 1 },
  { name: "John Reyes", role: "Rider", concern: "Emergency", tone: "red" },
  { name: "Carlo Mendoza", role: "Rider", concern: "Route Concern", tone: "blue" },
  { name: "Maria Santos", role: "Seller", concern: "Parcel Inquiry", tone: "orange" },
  { name: "Angela Reyes", role: "Seller", concern: "Parcel Concern", tone: "purple" },
  // Dagdag para makapag-message sa lahat ng riders/sellers galing sa Riders at Sellers pages
  { name: "Paolo Lim", role: "Rider", concern: "General Update", tone: "blue" },
  { name: "Ramon Diaz", role: "Rider", concern: "General Update", tone: "blue" },
  { name: "Jenny Ocampo", role: "Rider", concern: "General Update", tone: "green" },
  { name: "Rico Bautista", role: "Rider", concern: "General Update", tone: "orange" },
  { name: "Leo Navarro", role: "Rider", concern: "General Update", tone: "purple" },
  { name: "Kevin Cruz", role: "Seller", concern: "General Update", tone: "green" },
  { name: "Lisa Torres", role: "Seller", concern: "General Update", tone: "pink" },
  { name: "Daniel Uy", role: "Seller", concern: "General Update", tone: "red" },
  { name: "Rhea Gomez", role: "Seller", concern: "General Update", tone: "blue" },
];

// Pinakabago muna. Unang 2 lang ang makikita sa Messages; "View all" ang nagpapakita ng lahat.
export const urgentConcerns = [
  { id: "u1", name: "Mark Cruz", time: "2 mins ago", type: "Vehicle Problem", icon: "fa-car-burst", text: "Unable to continue my delivery route.", isNew: true },
  { id: "u2", name: "John Reyes", time: "8 mins ago", type: "Emergency", icon: "fa-kit-medical", text: "Needs immediate assistance.", isNew: true },
  { id: "u3", name: "Carlo Mendoza", time: "2 hrs ago", type: "Route Concern", icon: "fa-route", text: "There is a road closure along the route.", isNew: false },
  { id: "u4", name: "Mark Cruz", time: "Yesterday", type: "Vehicle Problem", icon: "fa-car-burst", text: "Flat tire, waiting for a replacement.", isNew: false },
];

export const getInitials = (name) =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// Default na usapan depende sa role/concern (galing sa loadConversation ng message.js)
export function getConversation(contact) {
  const { role, concern } = contact;
  if (role === "Seller") {
    return [
      { from: "them", text: "Hi Coordinator, I would like to ask about one of my parcel records.", time: "9:18 AM" },
      { from: "me", text: "Sure. Please send the parcel details so I can check the record.", time: "9:20 AM" },
    ];
  }
  if (concern === "General Update") {
    return [
      { from: "me", text: `Hi ${contact.name.split(" ")[0]}, this is the coordinator. Do you have any updates for me?`, time: "9:10 AM" },
    ];
  }
  if (concern === "Emergency") {
    return [
      { from: "them", text: "I have an emergency and I cannot continue my delivery right now.", time: "9:18 AM" },
      { from: "me", text: "Please provide the details and the parcels currently assigned to you.", time: "9:20 AM" },
    ];
  }
  if (concern === "Route Concern") {
    return [
      { from: "them", text: "Coordinator, I have a concern with my delivery route.", time: "8:45 AM" },
      { from: "me", text: "What seems to be the issue with the route?", time: "8:46 AM" },
      { from: "them", text: "There is a road closure along the route.", time: "8:47 AM" },
    ];
  }
  return [
    { from: "them", text: `I am experiencing a ${concern.toLowerCase()}. I may not be able to continue my delivery.`, time: "9:24 AM" },
    { from: "me", text: "Please provide more details so I can determine the next action.", time: "9:26 AM" },
    { from: "them", text: "I currently have 8 parcels with me.", time: "9:27 AM" },
  ];
}
