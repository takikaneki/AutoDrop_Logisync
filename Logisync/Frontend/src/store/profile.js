import { createStore } from "./createStore.js";
import { getToken, getUser, updateStoredUser } from "../api.js";
import { fetchMyProfile, updateMyProfile } from "../services/userService.js";

const EMPTY = {
  userId: null,
  name: "",
  email: "",
  phone: "",
  avatar: "",
  riderCode: "",
  sellerCode: "",
  shopName: "",
  agency: "",
  zone: "",
  vehicle: "",
};

function currentUid() {
  const u = getUser();
  return u?.user_id ? String(u.user_id) : "";
}

function fromUser(u) {
  if (!u) return { ...EMPTY };
  return {
    userId: u.user_id ?? null,
    name: u.name || "",
    email: u.email || "",
    phone: u.phone || "",
    avatar: u.avatar || "",
    riderCode: u.rider_code || "",
    sellerCode: u.seller_code || "",
    shopName: u.shop_name || "",
    agency: u.agency || "",
    zone: u.zone || "",
    vehicle: u.vehicle || "",
  };
}

function readCached(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`pt-profile-u:${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCached(uid, data) {
  if (!uid) return;
  try {
    localStorage.setItem(`pt-profile-u:${uid}`, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

function seedState() {
  const u = getUser();
  const uid = u?.user_id ? String(u.user_id) : "";
  const base = fromUser(u);
  const cached = readCached(uid);
  if (!cached) return base;
  return {
    ...base,
    ...cached,
    // Keep server-provided non-empty fields in sync with auth user
    name: cached.name || base.name,
    email: cached.email || base.email,
    phone: cached.phone ?? base.phone,
    avatar: cached.avatar ?? base.avatar,
    riderCode: base.riderCode || cached.riderCode || "",
    agency: base.agency || cached.agency || "",
  };
}

const store = createStore(seedState());

export const setProfile = (patch) => {
  const uid = currentUid();
  store.set((s) => {
    const next = { ...s, ...patch };
    if (uid) writeCached(uid, next);
    return next;
  });
};

function applyServerUser(serverUser) {
  if (!serverUser) return null;
  updateStoredUser(serverUser);
  const mapped = fromUser(serverUser);
  const uid = serverUser.user_id ? String(serverUser.user_id) : currentUid();
  if (uid) writeCached(uid, mapped);
  store.set(() => mapped);
  return serverUser;
}

export async function syncProfileFromServer() {
  if (!getToken()) return null;
  try {
    const serverUser = await fetchMyProfile();
    return applyServerUser(serverUser);
  } catch {
    return null;
  }
}

export async function saveProfileToServer(patch) {
  const res = await updateMyProfile(patch);
  if (res?.user) {
    applyServerUser(res.user);
  } else {
    setProfile(patch);
  }
  return res;
}

if (typeof window !== "undefined") {
  window.addEventListener("logisync-auth-changed", (event) => {
    const nextUser = event?.detail?.user;
    if (!nextUser) {
      store.set(() => ({ ...EMPTY }));
      return;
    }
    const mapped = fromUser(nextUser);
    const uid = nextUser.user_id ? String(nextUser.user_id) : "";
    if (uid) writeCached(uid, mapped);
    store.set(() => mapped);
  });

  window.addEventListener("logisync-user-updated", (event) => {
    const nextUser = event?.detail?.user;
    if (!nextUser) return;
    const mapped = fromUser(nextUser);
    const uid = nextUser.user_id ? String(nextUser.user_id) : "";
    if (uid) writeCached(uid, mapped);
    store.set(() => mapped);
  });
}

export function useProfile() {
  const saved = store.use();
  const u = getUser();
  const name = saved.name || u?.name || "Guest";
  const roleKey = u?.role ? String(u.role).toLowerCase() : "guest";
  return {
    userId: saved.userId ?? u?.user_id ?? null,
    name,
    email: saved.email || u?.email || "",
    phone: saved.phone ?? u?.phone ?? "",
    avatar: saved.avatar ?? u?.avatar ?? "",
    riderCode: saved.riderCode || u?.rider_code || "",
    sellerCode: saved.sellerCode || u?.seller_code || "",
    shopName: saved.shopName || u?.shop_name || "",
    agency: saved.agency || u?.agency || "",
    zone: saved.zone || u?.zone || "",
    vehicle: saved.vehicle || u?.vehicle || "",
    roleKey,
    role: u?.role ? u.role[0].toUpperCase() + u.role.slice(1) : "Guest",
    initial: name[0]?.toUpperCase() || "G",
  };
}
