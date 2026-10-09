export const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
export const SOCKET = import.meta.env.VITE_SOCKET_URL || API;
export const statuses = [
  "NEW",
  "UNDER_REVIEW",
  "ADDITIONAL_INFO_REQUIRED",
  "APPROVED",
  "REJECTED",
  "SETTLEMENT_IN_PROGRESS",
  "CLOSED",
];
export const statusLabels = {
  NEW: "New",
  UNDER_REVIEW: "Under review",
  ADDITIONAL_INFO_REQUIRED: "Info required",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SETTLEMENT_IN_PROGRESS: "Settlement",
  CLOSED: "Closed",
};
export const roleLabels = {
  CUSTOMER: "Customer",
  CLAIMS_OFFICER: "Claims officer",
  CLAIMS_MANAGER: "Claims manager",
};

export async function request(
  path,
  { method = "GET", body, token, headers = {} } = {},
) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let b = body;
  if (body && !(body instanceof FormData)) {
    h["Content-Type"] = "application/json";
    b = JSON.stringify(body);
  }
  const r = await fetch(`${API}${path}`, { method, headers: h, body: b });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
export const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
export const date = (v) =>
  v
    ? new Date(v).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
export const dateTime = (v) =>
  v
    ? new Date(v).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export const cls = (v) =>
  String(v || "")
    .toLowerCase()
    .replaceAll("_", "-");
