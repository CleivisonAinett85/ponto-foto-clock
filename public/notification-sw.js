const CACHE_NAME = "ponto-foto-app-shell-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/favicon.png",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icons.svg",
  "/manifest.webmanifest",
];

const timers = new Map();

function clearTimer(id) {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
}

function fire(reminder) {
  clearTimer(reminder.id);
  return self.registration
    .getNotifications({ tag: reminder.id })
    .then((existing) => {
      if (existing.length) return;
      return self.registration.showNotification("⏰ Hora de voltar do intervalo!", {
        body: `Seu retorno está previsto para ${reminder.returnLabel}.`,
        tag: reminder.id,
        renotify: false,
        requireInteraction: true,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { id: reminder.id },
      });
    })
    .catch(() => {});
}

function schedule(reminder) {
  clearTimer(reminder.id);
  const delay = reminder.notifyAt - Date.now();
  if (delay <= 0) {
    fire(reminder);
    return;
  }
  timers.set(reminder.id, setTimeout(() => fire(reminder), delay));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match("/"))),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SYNC_REMINDERS") {
    const incoming = Array.isArray(data.reminders) ? data.reminders : [];
    const keep = new Set(incoming.map((r) => r.id));
    for (const id of Array.from(timers.keys())) {
      if (!keep.has(id)) clearTimer(id);
    }
    incoming.forEach(schedule);
  }
  if (data.type === "CANCEL_REMINDER") {
    clearTimer(data.id);
    self.registration.getNotifications({ tag: data.id })
      .then((ns) => ns.forEach((n) => n.close()))
      .catch(() => {});
  }
  if (data.type === "FIRE_NOW" && data.reminder) {
    event.waitUntil(fire(data.reminder));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    }),
  );
});
