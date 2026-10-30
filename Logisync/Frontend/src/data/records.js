// Mock records para sa Parcels, Riders, Sellers, Complaints. Pareho ang bilang ng Parcels page (248):
// 156 In Transit, 82 Delivered, 10 Failed Delivery.
// TODO: palitan ng fetch("/api/...") kapag may list endpoints na ang Express API.

export const riders = [
  { id: "R-01", name: "Mark Cruz", phone: "0917 555 0101", zone: "North", vehicle: "Motorcycle", plate: "ABC 1234", status: "On Delivery", rating: 4.8, joined: "Jan 12, 2026" },
  { id: "R-02", name: "John Reyes", phone: "0917 555 0102", zone: "South", vehicle: "Motorcycle", plate: "DEF 5678", status: "Active", rating: 4.6, joined: "Feb 3, 2026" },
  { id: "R-03", name: "Carlo Mendoza", phone: "0917 555 0103", zone: "East", vehicle: "Motorcycle", plate: "GHI 9012", status: "On Delivery", rating: 4.7, joined: "Feb 20, 2026" },
  { id: "R-04", name: "Paolo Lim", phone: "0917 555 0104", zone: "North", vehicle: "Motorcycle", plate: "JKL 3456", status: "Active", rating: 4.4, joined: "Mar 8, 2026" },
  { id: "R-05", name: "Ramon Diaz", phone: "0917 555 0105", zone: "West", vehicle: "Tricycle", plate: "MNO 7890", status: "Active", rating: 4.5, joined: "Mar 30, 2026" },
  { id: "R-06", name: "Jenny Ocampo", phone: "0917 555 0106", zone: "Central", vehicle: "Motorcycle", plate: "PQR 2468", status: "On Delivery", rating: 4.9, joined: "Apr 14, 2026" },
  { id: "R-07", name: "Rico Bautista", phone: "0917 555 0107", zone: "South", vehicle: "Van", plate: "STU 1357", status: "Active", rating: 4.3, joined: "May 2, 2026" },
  { id: "R-08", name: "Leo Navarro", phone: "0917 555 0108", zone: "East", vehicle: "Motorcycle", plate: "VWX 9753", status: "Active", rating: 4.2, joined: "Jun 18, 2026" },
];

export const sellers = [
  { id: "S-01", name: "Maria Santos", shop: "Lyn's Shop", email: "maria@lynshop.ph", phone: "0918 444 0201", status: "Active", joined: "Jan 5, 2026", initials: "MS", tone: "orange" },
  { id: "S-02", name: "Angela Reyes", shop: "Mia's Finds", email: "angela@miasfinds.ph", phone: "0918 444 0202", status: "Active", joined: "Jan 22, 2026", initials: "AR", tone: "purple" },
  { id: "S-03", name: "Kevin Cruz", shop: "Casa Goods", email: "kevin@casagoods.ph", phone: "0918 444 0203", status: "Active", joined: "Feb 9, 2026", initials: "KC", tone: "green" },
  { id: "S-04", name: "Lisa Torres", shop: "Nica Store", email: "lisa@nicastore.ph", phone: "0918 444 0204", status: "Active", joined: "Mar 1, 2026", initials: "LT", tone: "pink" },
  { id: "S-05", name: "Daniel Uy", shop: "Daily Finds", email: "daniel@dailyfinds.ph", phone: "0918 444 0205", status: "Suspended", joined: "Mar 17, 2026", initials: "DU", tone: "red" },
  { id: "S-06", name: "Rhea Gomez", shop: "Shop Haven", email: "rhea@shophaven.ph", phone: "0918 444 0206", status: "Active", joined: "Apr 2, 2026", initials: "RG", tone: "blue" },
  { id: "S-07", name: "Joy Aquino", shop: "Urban Cart", email: "joy@urbancart.ph", phone: "0918 444 0207", status: "Active", joined: "Oct 9, 2026", initials: "JA", tone: "orange" },
  { id: "S-08", name: "Ben Ocampo", shop: "Gadget Hub", email: "ben@gadgethub.ph", phone: "0918 444 0208", status: "Active", joined: "Oct 10, 2026", initials: "BO", tone: "purple" },
];

const recipients = [
  "Juan Dela Cruz", "Mark Garcia", "Sofia Ramos", "Anna Lopez", "Daniel Tan", "Grace Villanueva", "Paul Mercado",
  "Nina Castillo", "Joel Fernandez", "Trisha Domingo", "Ian Salvador", "Bea Aguilar", "Ron Pascual", "Mae Soriano",
  "Vince Delos Reyes", "Kath Manalo", "Noel Padilla", "Hazel Cortez", "Ken Rivera", "Lyka Santiago",
];
const cities = ["Quezon City", "Makati", "Pasig", "Taguig", "Mandaluyong", "Caloocan", "Marikina", "Parañaque", "Las Piñas", "Manila"];
const items = ["Wireless Earbuds", "Phone Case", "Kitchen Organizer", "Beauty Organizer", "Desk Lamp", "Storage Box", "Sneakers", "Backpack", "Power Bank", "Skincare Set", "Water Bottle", "Mini Fan"];

// deterministic "random" para laging pareho ang data
let seed = 7;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const statuses = [
  ...Array(156).fill("In Transit"),
  ...Array(82).fill("Delivered"),
  ...Array(10).fill("Failed Delivery"),
];
for (let i = statuses.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [statuses[i], statuses[j]] = [statuses[j], statuses[i]];
}

const pad = (n, l = 3) => String(n).padStart(l, "0");
const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const parcels = statuses.map((status, i) => {
  const n = i + 1;
  const seller = sellers[i % 6]; // unang 6 lang ang may parcels (hindi pa approved ang iba)
  const rider = riders[(i * 3 + 1) % riders.length];
  const day = 27 - Math.floor((i / statuses.length) * 26); // Sep 27 → Sep 1
  const date = new Date(2026, 8, day, 7 + Math.floor(rnd() * 11), Math.floor(rnd() * 60));
  const verification =
    status === "Failed Delivery" ? (rnd() > 0.5 ? "Flagged" : "Verified") : rnd() > 0.2 ? "Verified" : "Pending";
  return {
    id: `PT-${pad(n)}`,
    seller: seller.name,
    shop: seller.shop,
    initials: seller.initials,
    tone: seller.tone,
    recipient: pick(recipients),
    address: `${Math.floor(rnd() * 400) + 1} ${pick(["Rizal St.", "Mabini Ave.", "Bonifacio St.", "Luna St.", "Del Pilar St."])}, ${pick(cities)}`,
    item: pick(items),
    rider: rider.name,
    amount: Math.round((200 + rnd() * 2800) / 10) * 10,
    hours: Math.round((4 + rnd() * 44) * 10) / 10,
    status,
    verification,
    iso: date.toISOString().slice(0, 10),
    dateLabel: fmt(date),
    ts: date.getTime(),
  };
});

export const complaints = [
  { id: "C-1001", from: "Maria Santos", role: "Seller", subject: "Parcel PT-014 marked failed but recipient was home", category: "Delivery", priority: "High", status: "Open", date: "Oct 10, 2026", description: "The rider marked the parcel as failed delivery, but the recipient says nobody came. Please check the rider's logs.", notes: [] },
  { id: "C-1002", from: "Mark Cruz", role: "Rider", subject: "Wrong address on PT-022", category: "Address", priority: "Medium", status: "In Progress", date: "Oct 10, 2026", description: "The address on the label does not match the recipient's actual location.", notes: ["Contacted seller for the correct address."] },
  { id: "C-1003", from: "Angela Reyes", role: "Seller", subject: "Refund request handled by buyer", category: "Payment", priority: "Low", status: "Resolved", date: "Oct 8, 2026", description: "Buyer asked for a refund after receiving the parcel.", notes: ["Seller refunded the buyer directly."] },
  { id: "C-1004", from: "John Reyes", role: "Rider", subject: "Seller packaging is torn", category: "Packaging", priority: "Medium", status: "Open", date: "Oct 9, 2026", description: "Picked up a parcel with a torn package. I took photos before leaving.", notes: [] },
  { id: "C-1005", from: "Kevin Cruz", role: "Seller", subject: "Delayed pickup for 3 parcels", category: "Delivery", priority: "High", status: "In Progress", date: "Oct 9, 2026", description: "Three parcels have not been picked up since yesterday.", notes: ["Assigned to Rico Bautista."] },
  { id: "C-1006", from: "Lisa Torres", role: "Seller", subject: "Verification takes too long", category: "Verification", priority: "Low", status: "Open", date: "Oct 8, 2026", description: "My parcels stay pending for more than a day before verification.", notes: [] },
  { id: "C-1007", from: "Paolo Lim", role: "Rider", subject: "App cannot upload proof of delivery", category: "System", priority: "High", status: "Open", date: "Oct 7, 2026", description: "The proof of delivery photo fails to upload on slow signal.", notes: [] },
  { id: "C-1008", from: "Rhea Gomez", role: "Seller", subject: "Wrong item reported by buyer", category: "Delivery", priority: "Medium", status: "Resolved", date: "Oct 5, 2026", description: "Buyer says the item differs from the order.", notes: ["Checked the seller video, item matched the order."] },
];

export const reportHistory = [
  { id: "Report-2026-10-09-001", ts: new Date(2026, 9, 9, 14, 20).getTime(), name: "Delivered parcels", filters: "Status: Delivered · Sep 1 – Sep 27", rows: 82, by: "Coordinator", query: { status: "Delivered", seller: "All", rider: "All", from: "2026-09-01", to: "2026-09-27" } },
  { id: "Report-2026-10-05-001", ts: new Date(2026, 9, 5, 9, 5).getTime(), name: "Failed deliveries", filters: "Status: Failed Delivery · Sep 1 – Sep 27", rows: 10, by: "Coordinator", query: { status: "Failed Delivery", seller: "All", rider: "All", from: "2026-09-01", to: "2026-09-27" } },
];
