import { api } from "../api.js";

// GET /api/audit-logs. Ang backend ang nagsasala ayon sa role:
// coordinator = lahat, seller/rider = sarili at mga nangyari sa parcel nila.
export async function listAudit({ limit = 20, offset = 0, category = "", q = "" } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  const data = await api(`/audit-logs?${params}`);
  return { logs: data.logs, total: data.total };
}
