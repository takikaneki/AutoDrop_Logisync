import { api } from "../api.js";

// /api/messages at /api/users/contacts
export async function listMessages() {
  return (await api("/messages")).messages;
}

export async function sendMessage(receiver_id, message) {
  return api("/messages", { method: "POST", body: { receiver_id, message } });
}

export const markMessageRead = (messageId) => api(`/messages/${messageId}/read`, { method: "PATCH" });

// Sino ang pwedeng i-message: coordinator -> sellers/riders; seller/rider -> coordinators
export async function listContacts() {
  return (await api("/users/contacts")).contacts;
}
