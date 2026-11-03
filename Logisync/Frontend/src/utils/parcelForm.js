// Mga field ng Create Parcel. Ang "max" ay galing sa laki ng column sa database.
export const PARCEL_FIELDS = [
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
    name: "receiver_address",
    label: "Customer / Receiver address",
    max: 255,
    placeholder: "e.g. 123 Rizal St., Brgy. San Antonio, Quezon City",
    help: "Auto-filled for returning customers. You can review and edit before submitting.",
  },
  {
    name: "receiver_contact",
    label: "Customer / Receiver contact number",
    max: 50,
    placeholder: "e.g. 09123456789",
    type: "tel",
    help: "Auto-filled for returning customers. You can review and edit before submitting.",
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

export const EMPTY_PARCEL = {
  transaction_number: "",
  receiver_name: "",
  receiver_address: "",
  receiver_contact: "",
  contents: "",
  content_category: "",
  other_category_description: "",
  discrete_item: false,
  discreet_reason: "",
};

const RESTRICTED_KEYWORDS = [
  "weapon",
  "gun",
  "firearm",
  "ammo",
  "ammunition",
  "explosive",
  "firework",
  "flammable",
  "acid",
  "poison",
  "toxic",
  "narcotic",
  "marijuana",
  "weed",
  "cocaine",
  "meth",
  "illegal",
  "contraband",
  "counterfeit",
  "fake id",
  "cash",
  "banknote",
  "live animal",
  "lighter fluid",
  "butane",
  "knife",
  "blade",
  "taser",
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

// Ibinabalik ang { fieldName: "error message" }. Walang laman = walang error.
export function validateParcel(values) {
  const errors = {};
  for (const f of PARCEL_FIELDS) {
    const v = (values[f.name] || "").trim();
    if (!v) errors[f.name] = `${f.label} is required.`;
    else if (f.name === "transaction_number" && !/^\d{11}$/.test(v)) {
      errors[f.name] = "Transaction number must contain exactly 11 digits (numbers only).";
    } else if (f.name !== "transaction_number" && v.length > f.max) {
      errors[f.name] = `${f.label} must be ${f.max} characters or fewer.`;
    }
  }

  const contact = (values.receiver_contact || "").trim();
  if (!errors.receiver_contact && !/^[0-9+()\-\s]{7,}$/.test(contact)) {
    errors.receiver_contact = "Enter a valid contact number (digits, spaces and + - ( ) only).";
  }

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
  return {
    ...Object.fromEntries(PARCEL_FIELDS.map((f) => [f.name, (values[f.name] || "").trim()])),
    content_category: category,
    other_category_description:
      category === "Other" ? (values.other_category_description || "").trim() : "",
    discrete_item: isDiscrete,
    discreet_reason: isDiscrete ? (values.discreet_reason || "").trim() : "",
  };
}
