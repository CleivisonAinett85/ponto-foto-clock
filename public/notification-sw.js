/* PontoFoto — service worker dedicado a notificações de retorno do intervalo.
   Não faz cache de HTML/assets e não intercepta requisições (sem handler de fetch),
   portanto não afeta atualizações do app nem o preview. */

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
      if (existing.length) return; // já notificado
      return self.registration.showNotification("⏰ Hora de voltar do almoço!", {
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
  // Timer dentro do SW: sobrevive ao fechamento da aba enquanto o SW estiver vivo.
  timers.set(
    reminder.id,
    setTimeout(() => fire(reminder), delay),
  );
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
    self.registration
      .getNotifications({ tag: data.id })
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
