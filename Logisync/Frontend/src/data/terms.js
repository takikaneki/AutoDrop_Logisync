// Legal documents (Terms and Conditions & Privacy Policy) for LogiSync.
// Aligned with actual system features, role workflows, and applicable Philippine Republic Acts.

export const POLICY_VERSION = "2026.1";
export const TERMS_VERSION = POLICY_VERSION;
export const EFFECTIVE_DATE = "November 2026";
export const COPYRIGHT_OWNER = "AutoDrop";

/**
 * Summary of Philippine Republic Acts applicable to LogiSync operations
 */
export const REPUBLIC_ACTS = [
  {
    code: "R.A. No. 10173",
    title: "Data Privacy Act of 2012",
    icon: "fa-user-shield",
    summary:
      "Governs the collection, processing, storage, protection, and role-based access of personal information (account credentials, receiver names, contact numbers, delivery addresses in Trece Martires City, Cavite, and packing video proofs) under the principles of transparency, legitimate purpose, and proportionality.",
  },
  {
    code: "R.A. No. 11967",
    title: "Internet Transactions Act of 2023",
    icon: "fa-boxes-packing",
    summary:
      "Establishes obligations for truthful digital transaction records, accurate parcel content category declarations, prohibition of illegal or misdeclared goods, and accountability across e-commerce sellers, logistics coordinators, and delivery riders.",
  },
  {
    code: "R.A. No. 10175",
    title: "Cybercrime Prevention Act of 2012",
    icon: "fa-shield-halved",
    summary:
      "Protects the confidentiality, integrity, and availability of LogiSync's electronic records, QR tracking data, and verification logs against unauthorized access, data tampering, computer-related forgery, and fraudulent manipulation.",
  },
];

/**
 * Complete Terms and Conditions Document
 */
export const TERMS_SECTIONS = [
  {
    id: "tc-1",
    title: "1. Acceptance and Proper Use of the LogiSync Platform",
    paragraphs: [
      "Welcome to LogiSync, a parcel verification, QR tracking, and last-mile delivery coordination system operating for the Trece Martires City, Cavite service hub. By checking the agreement box and signing in, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions and our Privacy Policy.",
      "LogiSync may only be used for legitimate logistics operations—specifically parcel registration, content declaration, video proof verification, QR code dispatch, and delivery status monitoring. If you do not agree to these terms, you must not sign in to or access the platform.",
    ],
  },
  {
    id: "tc-2",
    title: "2. Role-Specific Responsibilities",
    paragraphs: [
      "Access to LogiSync is strictly role-based. Every user must perform their duties in good faith according to their assigned system role:",
    ],
    bullets: [
      "Coordinators: Responsible for provisioning and managing Seller and Rider accounts, reviewing parcel registrations, inspecting uploaded packing video proofs against declared contents, evaluating discreet handling requests, assigning verified parcels to Riders, monitoring hub operations, and resolving in-app complaints or urgent requests.",
      "Sellers: Responsible for registering legitimate parcels with valid 11-digit transaction numbers, entering accurate receiver names, contact numbers, and complete Trece Martires City, Cavite delivery addresses, truthfully declaring parcel content categories, and uploading clear, unedited packing video proofs prior to dispatch.",
      "Riders: Responsible for scanning parcel QR codes upon pickup and dispatch, handling assigned parcels with care, respecting approved discreet handling labels, delivering parcels to the designated Trece Martires City address, and recording truthful delivery outcomes (Delivered or Failed with accurate notes).",
    ],
  },
  {
    id: "tc-3",
    title: "3. Accurate Parcel Information & Content Declarations (R.A. No. 11967)",
    paragraphs: [
      "In alignment with the principles of Republic Act No. 11967 (Internet Transactions Act of 2023) regarding honesty and accountability in e-commerce fulfillment, Sellers must provide complete and accurate parcel details before a parcel can be verified for delivery:",
    ],
    bullets: [
      "Mandatory Content Category Declaration: Sellers must classify each parcel under its actual category (Clothing and Accessories, Beauty and Personal Care, Health and Wellness Products, Personal or Intimate Products, Electronics and Gadgets, Household Items, or Other with a specific description).",
      "Discreet Handling Requests: Sellers may request discreet handling only for eligible personal categories and must provide a valid explanation. Requesting discreet handling only masks the item description from the Rider's delivery view after Coordinator approval; it does not exempt any parcel from Coordinator verification or mandatory packing video inspection.",
      "Prohibition of Misdeclared or Contraband Goods: Sellers are strictly prohibited from using LogiSync, or the Discreet Handling feature, to conceal weapons, explosives, illegal drugs, hazardous materials, counterfeit items, or any goods prohibited under Philippine law.",
    ],
  },
  {
    id: "tc-4",
    title: "4. Parcel Verification and Delivery Procedures",
    paragraphs: [
      "All parcels registered in LogiSync follow a structured verification and dispatch workflow to protect buyers, sellers, and logistics personnel:",
    ],
    bullets: [
      "Video Proof Submission: After registering a parcel, the Seller must upload an authentic video recording showing the physical item being packed into the parcel.",
      "Coordinator Inspection: The Coordinator reviews the parcel's declared category, item description, discreet handling reason (if requested), and packing video proof. The Coordinator may mark the parcel as Verified, Request a Video Re-upload, or Reject the parcel if discrepancies or prohibited items are found.",
      "QR Dispatch & Last-Mile Delivery: Only Verified parcels are eligible for Rider assignment. Riders scan the parcel QR code to initiate delivery (To Deliver) and log the final status (Delivered or Failed). Failed deliveries follow the hub's rescheduling and retry procedures.",
    ],
  },
  {
    id: "tc-5",
    title: "5. System Security and Prohibited Misuse (R.A. No. 10175)",
    paragraphs: [
      "In accordance with Republic Act No. 10175 (Cybercrime Prevention Act of 2012), users must respect the security and integrity of the LogiSync system. The following acts are strictly prohibited:",
    ],
    bullets: [
      "Unauthorized Access (Illegal Access): Attempting to log in using another person's credentials, bypassing role-based access controls, or accessing parcel records not assigned to your role.",
      "Data and System Interference: Altering, damaging, deleting, or deteriorating electronic parcel records, QR codes, verification statuses, or audit logs without authority.",
      "Computer-Related Forgery and Fraud: Uploading fabricated, pre-recorded, or manipulated packing videos to deceive Coordinator verification, entering fictitious receiver records, or falsifying delivery completion statuses.",
    ],
  },
  {
    id: "tc-6",
    title: "6. Account Security and User Responsibilities",
    paragraphs: [
      "Seller and Rider accounts are provisioned and managed by the Coordinator. Users are responsible for maintaining the confidentiality of their email and password credentials and for all activities performed under their signed-in session.",
      "Users must not share their login credentials with unauthorized individuals and must immediately notify the Coordinator via the Contact Us or Messages module if they suspect any unauthorized use of their account.",
    ],
  },
  {
    id: "tc-7",
    title: "7. Consequences of Violating System Policies",
    paragraphs: [
      "Violations of these Terms and Conditions are recorded in the system's audit trail and may result in immediate administrative and operational actions:",
    ],
    bullets: [
      "Immediate rejection of misdeclared or non-compliant parcels and revocation of discreet handling requests.",
      "Temporary suspension or permanent deactivation of Seller or Rider accounts by the Coordinator.",
      "Preservation of packing video proofs, declaration records, and audit logs for investigation and potential referral to appropriate authorities under applicable Philippine laws (including R.A. No. 10173, R.A. No. 11967, and R.A. No. 10175).",
    ],
  },
];

/**
 * Complete Privacy Policy Document
 */
export const PRIVACY_SECTIONS = [
  {
    id: "pp-1",
    title: "1. Overview and Data Privacy Framework (R.A. No. 10173)",
    paragraphs: [
      "This Privacy Policy explains how LogiSync collects, processes, stores, protects, and shares personal information in the course of operating its parcel verification and delivery monitoring platform.",
      "LogiSync's data handling practices are guided by the general data privacy principles of transparency, legitimate purpose, and proportionality under Republic Act No. 10173 (Data Privacy Act of 2012). This notice describes the actual data processing operations performed within the system and does not claim third-party regulatory certification unless separately verified.",
    ],
  },
  {
    id: "pp-2",
    title: "2. Personal Information We Collect",
    paragraphs: [
      "LogiSync collects only the data necessary to authenticate users, verify parcel contents, and coordinate deliveries within Trece Martires City, Cavite:",
    ],
    bullets: [
      "Account & Profile Information: Full name, email address, encrypted password hash, assigned role (Coordinator, Seller, or Rider), account verification status, contact phone number, Seller shop name, and Rider operational details (assigned zone, vehicle type, and plate number).",
      "Customer / Receiver & Parcel Data: Receiver full name, contact number, structured delivery address (house/unit number and street name, barangay in Trece Martires City, and province of Cavite), 11-digit transaction number, declared content category, item description, and discreet handling reason. Sellers may also store returning receiver details in their scoped customer directory for auto-fill convenience.",
      "Verification Media & Operational Logs: Packing video proof files uploaded by Sellers, Coordinator verification decisions and remarks, QR scan timestamps, delivery status updates and notes, in-app messages and complaints, and system audit logs (including the user's acceptance status, policy version, and date/time of agreement to these policies).",
    ],
  },
  {
    id: "pp-3",
    title: "3. Why We Collect Information and How It Is Used",
    paragraphs: [
      "Personal information processed in LogiSync is used strictly for the following legitimate operational purposes:",
    ],
    bullets: [
      "Authentication & Role Management: Verifying user identity at sign-in, enforcing role-specific permissions, and recording policy acceptance.",
      "Parcel Verification & Fraud Prevention: Enabling Coordinators to compare declared parcel contents and discreet handling requests against uploaded packing video proofs.",
      "Last-Mile Delivery Coordination: Providing Riders with accurate receiver contact numbers and Trece Martires City barangay/street addresses to complete deliveries and handle rescheduling.",
      "Recipient Privacy Protection: Masking sensitive item descriptions on Rider views when Discreet Handling is approved by the Coordinator.",
      "System Accountability & Support: Maintaining an audit trail of verifications, status changes, and user actions, and resolving inquiries or complaints submitted through the platform.",
    ],
  },
  {
    id: "pp-4",
    title: "4. Role-Based Access and Data Visibility",
    paragraphs: [
      "LogiSync enforces strict role-based access control so that users only see information relevant to their responsibilities. Personal data is never sold or rented to third-party marketers:",
    ],
    bullets: [
      "Coordinators: Have administrative access to user accounts, parcel declarations, unmasked item descriptions, discreet handling explanations, packing video proofs, and system audit logs for verification and hub oversight.",
      "Sellers: Can view and manage only the parcels they have created, their own uploaded video proofs, their saved customer auto-fill records, and messages with the Coordinator.",
      "Riders: Can view only the parcels assigned to them for delivery, including receiver name, contact number, delivery address, and delivery status. When a parcel has approved Discreet Handling, the specific item description and discreet reason are hidden from the Rider.",
    ],
  },
  {
    id: "pp-5",
    title: "5. Data Storage, Security, and Protection",
    paragraphs: [
      "LogiSync implements technical and organizational safeguards built into the application architecture to protect personal data against unauthorized access, alteration, or disclosure:",
    ],
    bullets: [
      "Credential & Session Security: User passwords are never stored in plain text and are hashed using bcrypt prior to database storage. Authenticated sessions are protected using signed JSON Web Tokens (JWT) with expiration controls.",
      "Database & Media Controls: Structured account, parcel, customer, and audit records are stored in a relational PostgreSQL database protected by server-side role middleware. Uploaded packing videos are restricted to authorized verification workflows.",
      "Audit Logging: Key actions—including sign-in policy acceptance, parcel creation, video uploads, Coordinator verification decisions, and delivery updates—are logged with actor and timestamp details.",
    ],
  },
  {
    id: "pp-6",
    title: "6. Data Retention",
    paragraphs: [
      "User account data, parcel records, verification videos, customer auto-fill entries, and audit logs are retained in the system for the duration necessary to complete parcel verification, delivery tracking, dispute resolution, and system administration.",
      "When an account is deactivated or a seller updates saved customer details, historical parcel and audit records may be preserved as required for operational integrity and accountability.",
    ],
  },
  {
    id: "pp-7",
    title: "7. Data Subject Rights & How to Contact Us",
    paragraphs: [
      "Consistent with Republic Act No. 10173 (Data Privacy Act of 2012), users have the right to be informed, to access their personal information held in LogiSync, to request correction of inaccurate or outdated profile or receiver details, and to request account or record deletion when legally and operationally applicable.",
      "How to Exercise Your Rights or Raise Privacy Concerns: Users may update their profile information in Settings, edit saved customer details during parcel creation, or submit requests for data access, correction, or privacy inquiries directly to the System Coordinator through the 'Contact Us' button on the Sign-In page or the in-app 'Messages' and 'Complaints / Urgent Request' modules.",
    ],
  },
];

// Backward-compatible flat array export for any legacy consumers
export const TERMS = TERMS_SECTIONS.map((s) => [
  s.title,
  [...s.paragraphs, ...(s.bullets || []).map((b) => `• ${b}`)].join(" "),
]);

const KEY = "logisync-terms";

export function getTermsRecord() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    return r && r.version === POLICY_VERSION && r.acceptedAt ? r : null;
  } catch {
    return null;
  }
}

export function saveTermsRecord() {
  const record = { version: POLICY_VERSION, acceptedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* ignore storage errors in private browsing */
  }
  return record;
}

export function clearTermsRecord() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
