/* LogiSync Desktop Browser Web Push Service Worker
 * Handles Hub Announcements and high-priority Emergency Alerts.
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

  if (!payload) return;

  // 1. High-priority Emergency Alerts (for Coordinators)
  if (payload.type === "emergency_alert") {
    const reportCode = payload.reportCode || (payload.reportId ? `EMR-${payload.reportId}` : "");
    const title = payload.title || (reportCode ? `EMERGENCY ALERT · ${reportCode}` : "EMERGENCY ALERT — LogiSync");
    const body =
      payload.body ||
      "A high-priority emergency report was submitted. Open LOGISYNC to review immediately.";
    const tag = reportCode ? `logisync-emergency-${reportCode}` : "logisync-emergency";

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/images/spx-logo.svg",
        badge: "/images/spx-logo.svg",
        tag,
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 300],
        data: {
          type: "emergency_alert",
          url: payload.url || (reportCode ? `/emergency-reports?report=${encodeURIComponent(reportCode)}` : "/emergency-reports"),
          reportId: payload.reportId || null,
          reportCode: reportCode || null,
        },
      })
    );
    return;
  }

  // 2. Hub Announcements (existing behavior preserved)
  if (payload.type !== "hub_announcement") {
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
        type: "hub_announcement",
        url: payload.url || "/notifications",
        announcementId: payload.announcementId || null,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const fallbackUrl = data.type === "emergency_alert" ? "/emergency-reports" : "/notifications";
  const targetPath = data.url || fallbackUrl;
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
