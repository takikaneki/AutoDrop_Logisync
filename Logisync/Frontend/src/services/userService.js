import { API_BASE_URL, api, getToken, getUser } from "../api.js";

// Accounts (coordinator lang). Walang password hash na ibinabalik ng backend.
export async function listUsers(role) {
  const query = role ? `?role=${encodeURIComponent(role)}` : "";
  const data = await api(`/users${query}`);
  return Array.isArray(data?.users) ? data.users : [];
}

// POST /api/users  (role: seller | rider | coordinator)
export async function createUser({
  name,
  email,
  password,
  role,
  phone,
  shop_name,
  zone,
  vehicle,
  plate_number,
}) {
  const res = await api("/users", {
    method: "POST",
    body: { name, email, password, role, phone, shop_name, zone, vehicle, plate_number },
  });
  return res.user;
}

// PATCH /api/users/:id/verification  (status: "APPROVED" | "REJECTED")
export async function updateUserVerification(userId, status) {
  return api(`/users/${encodeURIComponent(userId)}/verification`, {
    method: "PATCH",
    body: { status },
  });
}

// Change password para sa Coordinator, Seller, at Rider.
// Ginagamit ang API_BASE_URL (VITE_API_URL o /api) at ang token ng naka-login na user.
// Hiwalay na fetch (hindi gamit ang api()) para hindi ma-logout ang user kapag mali ang current password.
const SERVER_DOWN = "Cannot reach the server. Make sure the backend is running on port 5000.";

async function send(path, method, body, withToken = true) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(withToken && token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

export async function verifyCurrentPassword(currentPassword) {
  const user = getUser();
  const token = getToken();
  if (!user || !token) throw new Error("Please log in again.");

  // 1. Subukan ang dedicated POST /auth/verify-password endpoint
  const verifyRes = await send("/auth/verify-password", "POST", { currentPassword }, true);
  if (verifyRes.res.ok && verifyRes.data?.success !== false) {
    return true;
  }
  if (verifyRes.res.status === 400 || verifyRes.res.status === 401 || verifyRes.res.status === 403) {
    throw new Error(verifyRes.data?.message || "Incorrect current password.");
  }

  // 2. Fallback sa POST /auth/login (may termsAccepted: true) kung hindi pa na-deploy ang bagong route
  if (verifyRes.res.status === 404 && user.email) {
    const loginCheck = await send(
      "/auth/login",
      "POST",
      {
        email: user.email,
        password: currentPassword,
        role: user.role,
        termsAccepted: true,
      },
      false
    );
    if (loginCheck.res.ok && loginCheck.data?.success !== false) {
      return true;
    }
    if (loginCheck.res.status === 401 || loginCheck.res.status === 400) {
      throw new Error("Incorrect current password.");
    }
    throw new Error(
      loginCheck.data?.message ||
        (loginCheck.res.status >= 500 ? SERVER_DOWN : `Could not verify password (${loginCheck.res.status}).`)
    );
  }

  throw new Error(
    verifyRes.data?.message ||
      (verifyRes.res.status >= 500 ? SERVER_DOWN : `Could not verify password (${verifyRes.res.status}).`)
  );
}

export async function changePassword(currentPassword, newPassword, confirmPassword = newPassword) {
  const user = getUser();
  const token = getToken();
  if (!user || !token) throw new Error("Please log in again.");

  // 1. Beripikahin muna ang current password
  await verifyCurrentPassword(currentPassword);

  // 2. I-save ang bagong password sa database
  const { res, data } = await send(
    "/auth/password",
    "PATCH",
    { currentPassword, newPassword, confirmPassword },
    true
  );

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new Error(data?.message || "Incorrect current password.");
  }

  if (!res.ok || data?.success === false) {
    throw new Error(
      data?.message || (res.status >= 500 ? SERVER_DOWN : `Could not update password (${res.status}).`)
    );
  }

  return data;
}
