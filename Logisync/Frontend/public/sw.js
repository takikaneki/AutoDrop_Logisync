/* LogiSync Desktop Browser Web Push Service Worker
 * Handles Hub Announcement push events exclusively.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  // Strictly restrict Web Push display to Hub Announcements only.
  if (!payload || payload.type !== "hub_announcement") {
    return;
  }

  const title = payload.title || "LogiSync Hub Announcement";
  const body = payload.body || "A new coordinator announcement has been posted.";
  const tag = payload.announcementId
    ? `logisync-announcement-${payload.announcementId}`
    : "logisync-announcement";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/images/spx-logo.svg",
      badge: "/images/spx-logo.svg",
      tag,
      renotify: false,
      data: {
        url: payload.url || "/notifications",
        announcementId: payload.announcementId || null,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = (event.notification.data && event.notification.data.url) || "/notifications";
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(targetUrl).catch(() => client);
          }
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
