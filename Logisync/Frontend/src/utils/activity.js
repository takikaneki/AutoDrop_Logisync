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
  coordinator: "text-[#d9482b] dark:text-[#ff8a65] dark:drop-shadow-[0_0_8px_rgba(255,138,101,0.55)]",
  seller: "text-[#c84227] dark:text-[#fb923c] dark:drop-shadow-[0_0_8px_rgba(251,146,60,0.45)]",
  rider: "text-[#15803d] dark:text-[#4ade80] dark:drop-shadow-[0_0_8px_rgba(74,222,128,0.45)]",
};
