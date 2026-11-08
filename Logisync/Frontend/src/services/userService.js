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

function buildCandidateUrls(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = (API_BASE_URL || "/api").replace(/\/+$/, "");

  const urls = [];
  // 1. Directly with configured API_BASE_URL
  urls.push(`${base}${cleanPath}`);

  // 2. If base doesn't include /api, try adding /api
  if (!base.endsWith("/api")) {
    urls.push(`${base}/api${cleanPath}`);
  }

  // 3. If base includes /api, also try without /api
  if (base.endsWith("/api")) {
    const withoutApi = base.slice(0, -4);
    if (withoutApi) urls.push(`${withoutApi}${cleanPath}`);
  }

  // 4. Relative fallback paths
  if (!cleanPath.startsWith("/api")) {
    urls.push(`/api${cleanPath}`);
  }
  urls.push(cleanPath);

  return [...new Set(urls)];
}

async function send(path, method, body, withToken = true) {
  const token = getToken();
  const urls = buildCandidateUrls(path);

  let lastRes = null;
  let lastData = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(withToken && token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        /* walang JSON */
      }

      // If status is NOT 404, this endpoint exists and answered!
      if (res.status !== 404) {
        return { res, data };
      }

      lastRes = res;
      lastData = data;
    } catch (err) {
      // Network failure on this specific URL, try next candidate
      continue;
    }
  }

  if (lastRes) {
    return { res: lastRes, data: lastData };
  }

  throw new Error(SERVER_DOWN);
}

export async function verifyCurrentPassword(currentPassword) {
  const token = getToken();
  if (!token) throw new Error("Please log in again.");

  if (!currentPassword) {
    throw new Error("Please enter your current password.");
  }

  // 1. Dedicated verify-password routes
  const verifyPaths = ["/auth/verify-password", "/users/verify-password"];
  for (const path of verifyPaths) {
    const { res, data } = await send(path, "POST", { currentPassword, password: currentPassword }, true);
    if (res.ok && data?.success !== false) {
      return true;
    }
    // 400, 401, 403 clearly means the endpoint exists and validated the password as incorrect
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error(data?.message || "Incorrect current password.");
    }
  }

  // 2. Fallback via /auth/login verification if user email is present
  const user = getUser();
  if (user?.email) {
    const loginCheck = await send(
      "/auth/login",
      "POST",
      {
        email: user.email,
        password: currentPassword,
        role: user?.role,
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
  }

  // If verification endpoints return 404, we don't block here because changePassword()
  // verifies the current password authoritatively on the backend.
  return true;
}

export async function changePassword(currentPassword, newPassword, confirmPassword = newPassword) {
  const token = getToken();
  if (!token) throw new Error("Please log in again.");

  if (!currentPassword) throw new Error("Please enter your current password.");
  if (!newPassword || newPassword.length < 8) {
    throw new Error("The new password must be at least 8 characters.");
  }
  if (confirmPassword && newPassword !== confirmPassword) {
    throw new Error("The new passwords do not match.");
  }
  if (newPassword === currentPassword) {
    throw new Error("The new password must be different from the current one.");
  }

  // 1. Verify current password first
  await verifyCurrentPassword(currentPassword);

  // 2. Save new password to database
  const endpoints = [
    { path: "/auth/password", method: "PATCH" },
    { path: "/auth/password", method: "POST" },
    { path: "/users/password", method: "PATCH" },
    { path: "/auth/change-password", method: "POST" },
  ];

  let lastStatus = 0;
  let lastMsg = "";

  for (const ep of endpoints) {
    const { res, data } = await send(
      ep.path,
      ep.method,
      { currentPassword, newPassword, confirmPassword },
      true
    );

    if (res.ok && data?.success !== false) {
      return data || { success: true, message: "Password updated successfully." };
    }

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error(data?.message || "Incorrect current password.");
    }

    lastStatus = res.status;
    lastMsg = data?.message || "";
    if (res.status !== 404) {
      throw new Error(lastMsg || `Password update failed (${res.status}).`);
    }
  }

  throw new Error(lastMsg || (lastStatus ? `Could not update password (${lastStatus}).` : SERVER_DOWN));
}
