import { api } from "../api.js";

export async function fetchComplaints() {
  try {
    const data = await api("/complaints");
    return Array.isArray(data?.complaints) ? data.complaints : [];
  } catch (error) {
    console.warn("fetchComplaints fallback:", error);
    return [];
  }
}

export async function createComplaint({ category, subject, description, priority = "Medium", kind = "Complaint" }) {
  return api("/complaints", {
    method: "POST",
    body: { category, subject, description, priority, kind },
  });
}

export async function markComplaintsAsRead(complaintIds) {
  try {
    return await api("/complaints/mark-read", {
      method: "POST",
      body: { complaintIds },
    });
  } catch (error) {
    console.warn("markComplaintsAsRead non-fatal error:", error);
    return { success: false };
  }
}

export async function updateComplaintStatus(complaintId, { status, note }) {
  return api(`/complaints/${encodeURIComponent(complaintId)}`, {
    method: "PATCH",
    body: { status, note },
  });
}

export async function fetchUnreadComplaintCount() {
  try {
    const data = await api("/complaints/unread-count");
    return Number(data?.count || 0);
  } catch {
    return 0;
  }
}
