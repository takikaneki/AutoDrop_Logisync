import { createStore } from "./createStore.js";
import { getUser } from "../api.js";

// Mga na-edit ng user sa Settings (naka-save sa browser). Naka-merge sa user galing sa login.
// TODO: PATCH /api/auth/me kapag may endpoint na ang backend.
const store = createStore({ name: "", email: "", phone: "", avatar: "" }, "pt-profile");

export const setProfile = (patch) => store.set((s) => ({ ...s, ...patch }));

export function useProfile() {
  const saved = store.use();
  const u = getUser();
  const name = saved.name || u?.name || "Guest";
  return {
    name,
    email: saved.email || u?.email || "",
    phone: saved.phone || "",
    avatar: saved.avatar || "",
    role: u?.role ? u.role[0].toUpperCase() + u.role.slice(1) : "Guest",
    initial: name[0]?.toUpperCase() || "G",
  };
}
