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

export const parcels = [];

export const complaints = [];

export const reportHistory = [];
