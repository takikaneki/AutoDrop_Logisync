import { api } from "../api.js";

export async function fetchEmergencyReports(status = "") {
  const qs = status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : "";
  const data = await api(`/emergency-reports${qs}`);
  return {
    reports: Array.isArray(data?.reports) ? data.reports : [],
    counts: data?.counts || { all: 0, new: 0, acknowledged: 0, resolved: 0 },
  };
}

export async function getEmergencyReport(idOrCode) {
  const data = await api(`/emergency-reports/${encodeURIComponent(idOrCode)}`);
  return data?.report || null;
}

export async function createEmergencyReport({
  category,
  subject,
  description,
  location,
  photo_data_url = null,
  client_submission_id = null,
}) {
  return api("/emergency-reports", {
    method: "POST",
    body: {
      category,
      subject,
      description,
      location,
      photo_data_url,
      client_submission_id,
    },
  });
}

export async function updateEmergencyReport(idOrCode, { status, note }) {
  return api(`/emergency-reports/${encodeURIComponent(idOrCode)}`, {
    method: "PATCH",
    body: { status, note },
  });
}

export async function fetchUnreviewedEmergencyCount() {
  try {
    const data = await api("/emergency-reports/unreviewed-count");
    return Number(data?.count || 0);
  } catch {
    return 0;
  }
}
