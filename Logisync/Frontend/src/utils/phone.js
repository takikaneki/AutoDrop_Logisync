// Philippine mobile phone number sanitization and validation utilities.
// Enforces digits-only 11-digit mobile format starting with "09" (e.g. 09171234567).

export const MOBILE_NUMBER_MAX_LENGTH = 11;
export const MOBILE_NUMBER_REGEX = /^09\d{9}$/;
export const PHILIPPINE_LOCAL_MAX_LENGTH = 10;

/**
 * Normalizes a pasted or typed phone number into the 10-digit local part after "+63"
 * (e.g. "+639171234567", "639171234567", or "09171234567" -> "9171234567").
 */
export function sanitizeLocalMobileDigits(raw = "") {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("63")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, PHILIPPINE_LOCAL_MAX_LENGTH);
}

export function formatPlus63Phone(localDigits = "") {
  const clean = String(localDigits || "").trim();
  return clean ? `+63${clean}` : "";
}

/**
 * Strips letters, spaces, and invalid characters from a mobile number input.
 * Automatically normalizes a leading "+639" or "639" (when 12 digits) to "09"
 * and caps the length at 11 digits.
 */
export function sanitizeMobileNumber(raw = "") {
  const str = String(raw || "");
  const normalizedPrefix = str.replace(/^\s*\+63\s*9/, "09").replace(/^\s*639(?=\d{9})/, "09");
  return normalizedPrefix.replace(/\D/g, "").slice(0, MOBILE_NUMBER_MAX_LENGTH);
}

/**
 * Validates a mobile phone number.
 * @param {string} value
 * @param {{ required?: boolean, label?: string }} options
 * @returns {string} Error message if invalid, or empty string "" if valid.
 */
export function validateMobileNumber(value = "", { required = true, label = "Mobile number" } = {}) {
  const raw = String(value || "").trim();
  if (!raw) {
    return required ? `${label} is required.` : "";
  }

  const normalized = raw.replace(/^\+639/, "09").replace(/^\+63/, "0");

  if (/\D/.test(normalized)) {
    return `${label} must contain numbers only (no letters or special characters).`;
  }
  if (!normalized.startsWith("09")) {
    return `${label} must start with 09 (e.g. 09171234567).`;
  }
  if (normalized.length !== MOBILE_NUMBER_MAX_LENGTH) {
    return `${label} must be exactly 11 digits (e.g. 09171234567).`;
  }
  if (!MOBILE_NUMBER_REGEX.test(normalized)) {
    return `Enter a valid 11-digit mobile number (e.g. 09171234567).`;
  }

  return "";
}

