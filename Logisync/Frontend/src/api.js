// Isang lugar para sa lahat ng usapan sa Express backend.
// Ang /api ay naka-proxy ng Vite papunta sa http://127.0.0.1:5000 (tingnan ang vite.config.js).

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "token";
const USER_KEY = "user";

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function saveSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Ang role ay galing sa backend (nasa user na ibinalik ng login)
export const getRole = () => getUser()?.role || null;

// Saan dadalhin ang user depende sa role. Kapag hindi kilala ang role -> null
const ROLE_HOME = { seller: "/seller", rider: "/rider", coordinator: "/dashboard" };
export const homePathForRole = (role) => ROLE_HOME[role] || null;

// Binabasa ang "exp" sa loob ng JWT para malaman kung expired na (UX lang ito;
// ang backend pa rin ang totoong nagpapasya kung valid ang token)
function tokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return !payload.exp || payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function isLoggedIn() {
  const token = getToken();
  if (!token) return false;
  if (tokenExpired(token)) {
    clearSession();
    return false;
  }
  return true;
}

const SERVER_DOWN = "Cannot reach the server. Make sure the backend is running on port 5000.";

export async function api(path, { method = "GET", body, headers } = {}) {
  const token = getToken();

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(SERVER_DOWN);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* walang JSON na sagot */
  }

  if (!res.ok || data?.success === false) {
    // Expired/invalid token: ibalik sa login
    if (res.status === 401 && token) {
      clearSession();
      window.location.href = "/login";
    }
    // Walang JSON galing sa 5xx = hindi naabot ng Vite proxy ang backend
    throw new Error(data?.message || (res.status >= 500 ? SERVER_DOWN : `Request failed (${res.status})`));
  }

  return data;
}
// Upload ng file (multipart/form-data) na may progress. Hindi kaya ng fetch ang upload progress,
// kaya XMLHttpRequest ang gamit dito. HUWAG lagyan ng Content-Type: ang browser ang gagawa nito (may boundary).
export function apiUpload(path, formData, onProgress) {
  const token = getToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error(SERVER_DOWN));
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* walang JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.success !== false) return resolve(data);
      if (xhr.status === 401 && token) {
        clearSession();
        window.location.href = "/login";
      }
      reject(new Error(data?.message || (xhr.status >= 500 ? SERVER_DOWN : `Upload failed (${xhr.status})`)));
    };
    xhr.send(formData);
  });
}

// Kumukuha ng file (hal. video) na kailangan ng token. Ang <video src> ay hindi makapagpadala ng
// Authorization header, kaya kinukuha muna natin bilang blob at gumagawa ng pansamantalang URL.
// Tandaan: tawagan ang URL.revokeObjectURL(url) kapag tapos na.
export async function apiBlobUrl(path) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error(SERVER_DOWN);
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      msg = (await res.json()).message || msg;
    } catch {
      /* walang JSON */
    }
    throw new Error(msg);
  }
  return URL.createObjectURL(await res.blob());
}
