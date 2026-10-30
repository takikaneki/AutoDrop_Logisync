import { api, getToken, getUser } from "../api.js";

// Accounts (coordinator lang). Walang password hash na ibinabalik ng backend.
export async function listUsers() {
  return (await api("/users")).users;
}

// POST /api/users  (role: seller | rider | coordinator)
export async function createUser({ name, email, password, role }) {
  return (await api("/users", { method: "POST", body: { name, email, password, role } })).user;
}

// Change password.
// 1) Beripikahin ang current password gamit ang EXISTING na POST /api/auth/login (binabasa lang ang
//    sagot; hindi ginagamit ang token). Mali ang password -> 401 -> "current password is incorrect".
// 2) Kapag tama, PATCH /api/auth/password { currentPassword, newPassword }.
// Hiwalay na fetch (hindi gamit ang api()) para hindi ma-logout ang user kapag 401 ang sagot.
const SERVER_DOWN = "Cannot reach the server. Make sure the backend is running on port 5000.";

async function send(path, method, body, withToken) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(withToken ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(SERVER_DOWN);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* walang JSON */
  }
  return { res, data };
}

export async function changePassword(currentPassword, newPassword) {
  const email = getUser()?.email;
  if (!email) throw new Error("Please log in again.");

  // 1. Tama ba ang current password?
  const check = await send("/auth/login", "POST", { email, password: currentPassword }, false);
  if (check.res.status === 401) throw new Error("Your current password is incorrect.");
  if (!check.res.ok) throw new Error(check.data?.message || (check.res.status >= 500 ? SERVER_DOWN : `Could not verify password (${check.res.status}).`));

  // 2. I-save ang bagong password
  const { res, data } = await send("/auth/password", "PATCH", { currentPassword, newPassword }, true);
  if (res.status === 404) throw new Error("Your current password is correct, but the server cannot change passwords yet (no password endpoint).");
  if (!res.ok || data?.success === false) throw new Error(data?.message || `Could not change password (${res.status}).`);
  return data;
}
