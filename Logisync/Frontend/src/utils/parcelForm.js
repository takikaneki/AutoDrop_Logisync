// Create Parcel form fields & validation rules.
// Addresses are tailored for Trece Martires City, Cavite Service Hub:
// 1. Province (Pre-filled / Read-only: Cavite)
// 2. Municipality / City (Pre-filled / Read-only: Trece Martires City)
// 3. Barangay (Autocomplete from 13 Trece Martires City barangays)
// 4. House / Unit Number and Street Name (Combined input field)

import {
  MOBILE_NUMBER_MAX_LENGTH,
  sanitizeMobileNumber,
  validateMobileNumber,
} from "./phone.js";

export const ADDRESS_FIELDS = [
  {
    name: "receiver_province",
    label: "Province",
    max: 150,
    required: true,
    readOnly: true,
    defaultValue: "Cavite",
    help: "Pre-filled: Service hub covers Cavite.",
  },
  {
    name: "receiver_city",
    label: "Municipality / City",
    max: 150,
    required: true,
    readOnly: true,
    defaultValue: "Trece Martires City",
    help: "Pre-filled: Service hub covers Trece Martires City.",
  },
  {
    name: "receiver_barangay",
    label: "Barangay",
    max: 150,
    required: true,
    placeholder: "Select or type barangay (e.g. San Agustin, Hugo Perez)",
    help: "Select or filter from the 13 official barangays of Trece Martires City.",
  },
  {
    name: "receiver_street",
    label: "House / Unit Number and Street Name",
    max: 150,
    required: true,
    placeholder: "e.g. Blk 5 Lot 10, Mabini Street",
    help: "Enter complete house or unit number, building, subdivision, and street name.",
  },
];

export const PARCEL_BASE_FIELDS = [
  {
    name: "transaction_number",
    label: "Transaction number",
    max: 11,
    placeholder: "Enter 11-digit transaction number",
    help: "Enter exactly 11 digits. Numbers only; no letters or symbols.",
  },
  {
    name: "receiver_name",
    label: "Customer / Receiver name",
    max: 100,
    placeholder: "e.g. Juan Dela Cruz",
    help: "Enter an existing customer name to auto-fill their saved address and contact number.",
  },
  {
    name: "receiver_contact",
    label: "Customer / Receiver contact number",
    max: MOBILE_NUMBER_MAX_LENGTH,
    placeholder: "e.g. 09171234567",
    type: "tel",
    help: "Enter an 11-digit mobile number starting with 09 (numbers only).",
  },
  {
    name: "contents",
    label: "Parcel item description / contents",
    max: 255,
    placeholder: "e.g. 2x Cotton T-Shirt (Black, Medium)",
    help: "Provide an accurate description of the physical item(s) inside the parcel.",
  },
];

export const CONTENT_CATEGORIES = [
  {
    value: "Clothing and Accessories",
    label: "Clothing and Accessories",
    subtitle: "Apparel, footwear, bags, and fashion accessories",
    discreetTypical: true,
  },
  {
    value: "Beauty and Personal Care",
    label: "Beauty and Personal Care",
    subtitle: "Skincare, cosmetics, hygiene, and grooming products",
    discreetTypical: false,
  },
  {
    value: "Health and Wellness Products",
    label: "Health and Wellness Products",
    subtitle: "Vitamins, wellness items, personal health supplies",
    discreetTypical: false,
  },
  {
    value: "Personal or Intimate Products",
    label: "Personal or Intimate Products",
    subtitle: "Sensitive personal items requiring recipient privacy",
    discreetTypical: true,
  },
  {
    value: "Electronics and Gadgets",
    label: "Electronics and Gadgets",
    subtitle: "Mobile devices, accessories, audio, small electronics",
    discreetTypical: false,
  },
  {
    value: "Household Items",
    label: "Household Items",
    subtitle: "Home essentials, kitchenware, decor, and daily supplies",
    discreetTypical: false,
  },
  {
    value: "Other",
    label: "Other",
    subtitle: "Specify the exact item category below",
    discreetTypical: true,
  },
];

export const DISCREET_ELIGIBLE_CATEGORIES = new Set(
  CONTENT_CATEGORIES.filter((c) => c.discreetTypical).map((c) => c.value)
);

export const VALID_CATEGORY_VALUES = CONTENT_CATEGORIES.map((c) => c.value);

export function isCategoryDiscreetEligible(category) {
  return DISCREET_ELIGIBLE_CATEGORIES.has((category || "").trim());
}

export function formatFullAddress(values = {}) {
  const street = (values.receiver_street || "").trim();
  const rawBrgy = (values.receiver_barangay || "").trim();
  const brgy = rawBrgy
    ? (/^brgy\.?/i.test(rawBrgy) ? rawBrgy : `Brgy. ${rawBrgy}`)
    : "";
  const city = (values.receiver_city || "Trece Martires City").trim();
  const prov = (values.receiver_province || "Cavite").trim();

  if (!street && !brgy) {
    return (values.receiver_address || "").trim();
  }

  const parts = [street, brgy, city, prov].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : (values.receiver_address || "").trim();
}

export const EMPTY_PARCEL = {
  transaction_number: "",
  receiver_name: "",
  receiver_contact: "",
  receiver_house_number: "",
  receiver_street: "",
  receiver_barangay: "",
  receiver_city: "Trece Martires City",
  receiver_province: "Cavite",
  receiver_address: "",
  contents: "",
  content_category: "",
  other_category_description: "",
  discrete_item: false,
  discreet_reason: "",
  is_cod: false,
  payment_method: "NON_COD",
};

const RESTRICTED_KEYWORDS = [
  "weapon", "gun", "firearm", "ammo", "ammunition", "explosive", "firework",
  "flammable", "acid", "poison", "toxic", "narcotic", "marijuana", "weed",
  "cocaine", "meth", "illegal", "contraband", "counterfeit", "fake id",
  "cash", "banknote", "live animal", "lighter fluid", "butane", "knife", "blade", "taser"
];

export function evaluateDeclarationFlags(values = {}) {
  const warnings = [];
  const category = (values.content_category || "").trim();
  const otherDesc = (values.other_category_description || "").trim();
  const contents = (values.contents || "").trim();
  const isDiscreet = Boolean(values.discrete_item) && isCategoryDiscreetEligible(category);
  const reason = (values.discreet_reason || "").trim();

  const combined = `${contents} ${otherDesc} ${reason}`.toLowerCase();
  const matchedRestricted = RESTRICTED_KEYWORDS.filter((kw) => combined.includes(kw));
  if (matchedRestricted.length > 0) {
    warnings.push(
      `Contains restricted/high-risk keywords (${matchedRestricted.slice(0, 3).join(", ")}). This parcel will be flagged for strict Coordinator inspection.`
    );
  }

  if (isDiscreet && category === "Other") {
    warnings.push(
      `Requesting discreet handling under "Other" automatically flags this parcel for manual Coordinator verification.`
    );
  }

  return warnings;
}

export function validateParcel(values) {
  const errors = {};

  // Base fields
  const tx = (values.transaction_number || "").trim();
  if (!tx) errors.transaction_number = "Transaction number is required.";
  else if (!/^\d{11}$/.test(tx)) errors.transaction_number = "Transaction number must contain exactly 11 digits (numbers only).";

  const name = (values.receiver_name || "").trim();
  if (!name) errors.receiver_name = "Customer / Receiver name is required.";
  else if (name.length > 100) errors.receiver_name = "Receiver name must be 100 characters or fewer.";

  const contactError = validateMobileNumber(values.receiver_contact, {
    required: true,
    label: "Contact number",
  });
  if (contactError) {
    errors.receiver_contact = contactError;
  }

  // Structured Address fields
  const street = (values.receiver_street || "").trim();
  if (!street) errors.receiver_street = "House / unit number and street name is required.";
  else if (street.length > 150) errors.receiver_street = "Street must be 150 characters or fewer.";

  const brgy = (values.receiver_barangay || "").trim();
  if (!brgy) errors.receiver_barangay = "Barangay is required.";
  else if (brgy.length > 150) errors.receiver_barangay = "Barangay must be 150 characters or fewer.";

  const city = (values.receiver_city || "").trim();
  if (!city) errors.receiver_city = "City or municipality is required.";
  else if (city.length > 150) errors.receiver_city = "City must be 150 characters or fewer.";

  const prov = (values.receiver_province || "").trim();
  if (!prov) errors.receiver_province = "Province is required.";
  else if (prov.length > 150) errors.receiver_province = "Province must be 150 characters or fewer.";

  // Contents
  const contents = (values.contents || "").trim();
  if (!contents) errors.contents = "Parcel item description / contents is required.";
  else if (contents.length > 255) errors.contents = "Contents must be 255 characters or fewer.";

  // Category
  const category = (values.content_category || "").trim();
  if (!category || !VALID_CATEGORY_VALUES.includes(category)) {
    errors.content_category = "Please select and declare the parcel's actual content category.";
  }

  if (category === "Other") {
    const otherDesc = (values.other_category_description || "").trim();
    if (!otherDesc) {
      errors.other_category_description = "Please provide a short description for the 'Other' category.";
    } else if (otherDesc.length < 3) {
      errors.other_category_description = "Category description must be at least 3 characters.";
    } else if (otherDesc.length > 255) {
      errors.other_category_description = "Category description must be 255 characters or fewer.";
    }
  }

  // Discreet handling
  if (Boolean(values.discrete_item) && isCategoryDiscreetEligible(category)) {
    const reason = (values.discreet_reason || "").trim();
    if (!reason) {
      errors.discreet_reason = "Please explain why this parcel requires discreet handling.";
    } else if (reason.length < 10) {
      errors.discreet_reason =
        "Please provide a clear explanation (at least 10 characters) for the Coordinator's review.";
    } else if (reason.length > 500) {
      errors.discreet_reason = "Explanation must be 500 characters or fewer.";
    }
  }

  return errors;
}

export function trimParcel(values) {
  const category = (values.content_category || "").trim();
  const isDiscrete = Boolean(values.discrete_item) && isCategoryDiscreetEligible(category);
  const fullAddress = formatFullAddress(values);

  return {
    transaction_number: (values.transaction_number || "").trim(),
    receiver_name: (values.receiver_name || "").trim(),
    receiver_contact: sanitizeMobileNumber(values.receiver_contact),
    receiver_house_number: (values.receiver_house_number || "").trim(),
    receiver_street: (values.receiver_street || "").trim(),
    receiver_barangay: (values.receiver_barangay || "").trim(),
    receiver_city: (values.receiver_city || "").trim(),
    receiver_province: (values.receiver_province || "").trim(),
    receiver_address: fullAddress,
    contents: (values.contents || "").trim(),
    content_category: category,
    other_category_description:
      category === "Other" ? (values.other_category_description || "").trim() : "",
    discrete_item: isDiscrete,
    discreet_reason: isDiscrete ? (values.discreet_reason || "").trim() : "",
  };
}
