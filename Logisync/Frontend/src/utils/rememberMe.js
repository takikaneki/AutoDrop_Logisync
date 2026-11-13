/**
 * LogiSync Secure Remember-Me Credential Store
 *
 * Implements persistent credential remembering for Login portals (Seller, Rider, Coordinator).
 * Security highlights:
 * - Passwords are NEVER stored in plaintext in localStorage or sessionStorage.
 * - Uses Web Cryptography API (AES-GCM 256-bit with random 96-bit initialization vectors)
 *   to encrypt the stored credentials on the user's device.
 * - Credentials are strictly scoped per portal/role (`logisync_remember_${role}`).
 * - Provides graceful fallback if WebCrypto is unavailable in restricted web contexts.
 */

const STORAGE_PREFIX = "logisync_remember_";

function getCryptoSubtle() {
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  return null;
}

function getRandomValues(array) {
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    return window.crypto.getRandomValues(array);
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.getRandomValues) {
    return globalThis.crypto.getRandomValues(array);
  }
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
}

function toHex(uint8Array) {
  return Array.from(uint8Array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hexString) {
  if (!hexString || hexString.length % 2 !== 0) return new Uint8Array(0);
  const matches = hexString.match(/.{1,2}/g);
  if (!matches) return new Uint8Array(0);
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

async function getDerivedKey(subtle, role) {
  const enc = new TextEncoder();
  const origin =
    typeof window !== "undefined" && window.location && window.location.origin
      ? window.location.origin
      : "logisync.app";
  const rawSecret = `logisync_vault_v2_${origin}_${role}`;
  const keyMaterial = enc.encode(rawSecret);
  const hash = await subtle.digest("SHA-256", keyMaterial);
  return subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/**
 * Encrypt a password string into an encrypted hex payload with random IV
 */
async function encryptSecret(plainText, role) {
  const subtle = getCryptoSubtle();
  if (subtle) {
    try {
      const key = await getDerivedKey(subtle, role);
      const iv = getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const cipherBuffer = await subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        enc.encode(plainText)
      );
      return {
        mode: "aes-gcm",
        iv: toHex(iv),
        payload: toHex(new Uint8Array(cipherBuffer))
      };
    } catch {
      /* fallback below */
    }
  }

  // Fallback obfuscated encoding for environments without SubtleCrypto
  const salt = getRandomValues(new Uint8Array(8));
  const enc = new TextEncoder();
  const bytes = enc.encode(plainText);
  const xored = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    xored[i] = bytes[i] ^ salt[i % salt.length] ^ 0x5c;
  }
  return {
    mode: "obf",
    salt: toHex(salt),
    payload: toHex(xored)
  };
}

/**
 * Decrypt an encrypted secret bundle back to plaintext
 */
async function decryptSecret(cipherRecord, role) {
  if (!cipherRecord || !cipherRecord.payload) return "";
  const subtle = getCryptoSubtle();

  if (cipherRecord.mode === "aes-gcm" && subtle && cipherRecord.iv) {
    try {
      const key = await getDerivedKey(subtle, role);
      const iv = fromHex(cipherRecord.iv);
      const payload = fromHex(cipherRecord.payload);
      const decryptedBuffer = await subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        payload
      );
      return new TextDecoder().decode(decryptedBuffer);
    } catch {
      return "";
    }
  }

  if (cipherRecord.mode === "obf" && cipherRecord.salt) {
    try {
      const salt = fromHex(cipherRecord.salt);
      const payload = fromHex(cipherRecord.payload);
      const bytes = new Uint8Array(payload.length);
      for (let i = 0; i < payload.length; i++) {
        bytes[i] = payload[i] ^ salt[i % salt.length] ^ 0x5c;
      }
      return new TextDecoder().decode(bytes);
    } catch {
      return "";
    }
  }

  return "";
}

/**
 * Save remembered credentials for a specific portal role.
 * Passwords are encrypted before being written to localStorage.
 */
export async function saveRememberedCredentials(role, email, password) {
  const normRole = String(role || "coordinator").toLowerCase().trim();
  const cleanEmail = String(email || "").trim();
  if (!cleanEmail) {
    clearRememberedCredentials(normRole);
    return;
  }

  try {
    const cipher = password ? await encryptSecret(password, normRole) : null;
    const record = {
      remember: true,
      email: cleanEmail,
      cipher,
      savedAt: Date.now()
    };
    localStorage.setItem(`${STORAGE_PREFIX}${normRole}`, JSON.stringify(record));
  } catch {
    /* ignore storage write failures in private browsing */
  }
}

/**
 * Retrieve remembered credentials for a specific portal role.
 * Decrypts password on the fly into state; returns null if not remembered.
 */
export async function getRememberedCredentials(role) {
  const normRole = String(role || "coordinator").toLowerCase().trim();
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${normRole}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.remember || !parsed.email) return null;

    let decryptedPassword = "";
    if (parsed.cipher) {
      decryptedPassword = await decryptSecret(parsed.cipher, normRole);
    }

    return {
      remember: true,
      email: parsed.email,
      password: decryptedPassword
    };
  } catch {
    return null;
  }
}

/**
 * Remove remembered credentials for a specific portal role.
 */
export function clearRememberedCredentials(role) {
  const normRole = String(role || "coordinator").toLowerCase().trim();
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${normRole}`);
  } catch {
    /* ignore */
  }
}

