// Terms of Service ng LogiSync. Kapag binago ang laman nito, palitan din ang TERMS_VERSION
// para hingan ulit ng pagsang-ayon ang mga user.
export const TERMS_VERSION = "2026-10";
export const COPYRIGHT_OWNER = "AutoDrop";

export const TERMS = [
  ["1. Acceptance of Terms", "By signing in to or using LogiSync, you confirm that you have read, understood and agreed to these Terms of Service. If you do not agree, you must not use the system."],
  ["2. Accounts", "Accounts are created by the Coordinator. Seller and Rider accounts cannot be created through public registration. You are responsible for keeping your login details private, and you must not share your account with anyone else. Tell the Coordinator right away if you think someone else has used your account."],
  ["3. Acceptable Use", "LogiSync may only be used for legitimate parcel registration, verification, tracking and delivery. You must not upload false, misleading or unrelated information, tamper with parcel records, or try to access data that does not belong to your role."],
  ["4. Sellers", "Sellers must register only parcels that are real and ready to ship, and must upload clear, unedited video proof of the parcel contents when asked. Sellers are responsible for the accuracy of the receiver details, contents and declared information they enter."],
  ["5. Riders", "Riders must scan the QR code of a parcel before accepting it, handle every parcel with care, and update its delivery result honestly (delivered or failed, with the reason). Riders must not open, replace or keep parcels that are assigned to them."],
  ["6. Coordinators", "Coordinators verify parcels, manage accounts and handle complaints. They must act fairly, keep the information they see confidential, and use their access only for operating the system."],
  ["7. Privacy and Data", "LogiSync stores the information needed to verify and deliver parcels, such as names, email addresses, contact details, delivery addresses, parcel details and seller videos. This information is used only for delivery operations and is not sold to third parties. Actions in the system, such as verifications and account changes, are recorded in an audit log."],
  ["8. Videos and Uploaded Content", "Videos and files you upload are used as proof of a parcel's contents and condition. By uploading them you confirm you have the right to do so and allow LogiSync to store and show them to the Coordinator and the Rider handling the parcel."],
  ["9. Suspension and Termination", "The Coordinator may suspend or remove an account that breaks these terms, shows suspicious activity or is no longer needed. Parcel records and audit entries linked to the account may be kept for record-keeping."],
  ["10. Limitation of Liability", "LogiSync is provided as a tracking and verification tool. We do not guarantee that the service will always be available or free of errors, and we are not responsible for losses caused by incorrect information entered by users, delays outside our control, or loss or damage of parcels in transit."],
  ["11. Changes to These Terms", "These Terms may be updated from time to time. When they change in a significant way, you will be asked to read and accept them again before you continue using the system."],
  ["12. Ownership", "LogiSync and its content, design and source code are owned by AutoDrop. All rights reserved."],
  ["13. Contact", "If you have questions about these Terms, please contact the Coordinator through the Contact page after signing in."],
];

const KEY = "logisync-terms";

// Ang pagsang-ayon ay naka-save sa browser na ito (bersyon + oras). Hindi ito pumapasok sa backend.
export function getTermsRecord() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    return r && r.version === TERMS_VERSION && r.acceptedAt ? r : null;
  } catch {
    return null;
  }
}

export function saveTermsRecord() {
  const record = { version: TERMS_VERSION, acceptedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* private mode: tuloy pa rin, kailangan lang ulit mag-agree sa susunod */
  }
  return record;
}

export function clearTermsRecord() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* wala */
  }
}
