// Itsura ng bawat kategorya sa activity/audit log
export const CATEGORIES = ["Parcels", "Video", "Verification", "Delivery", "Accounts"];

export const CATEGORY_META = {
  Parcels: { icon: "package", tone: "bg-[#fff0e5] text-orange-500" },
  Video: { icon: "video", tone: "bg-[#eaf3ff] text-[#4285c5]" },
  Verification: { icon: "circle-check", tone: "bg-[#d9f4e5] text-[#0c9b58]" },
  Delivery: { icon: "truck", tone: "bg-[#f2ecff] text-[#8258c7]" },
  Accounts: { icon: "user-plus", tone: "bg-[#fff4d8] text-[#e99a00]" },
};
export const metaOf = (category) => CATEGORY_META[category] || { icon: "circle", tone: "bg-[#f1f1f1] text-[#999]" };

export const ROLE_BADGE = {
  coordinator: "bg-[#fff0e7] text-[#e9651c]",
  seller: "bg-[#edf4ff] text-[#4b78b5]",
  rider: "bg-[#dcfce7] text-[#15803d]",
};
