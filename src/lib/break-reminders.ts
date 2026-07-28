import { get, set } from "idb-keyval";
import type { PunchType } from "./ponto-storage";

export type ReminderStatus = "pending" | "fired" | "cancelled" | "done";

export interface BreakReminder {
  id: string; // `${dateKey}:${type}` — identificador único por registro
  dateKey: string; // "YYYY-MM-DD"
  type: PunchType; // saida_almoco | saida_lanche
  exitAt: number; // horário da Saída (ms)
  durationMinutes: number; // duração do intervalo
  returnAt: number; // horário previsto de retorno (ms)
  minutesBefore: number; // antecedência escolhida (0 = não notificar)
  notifyAt: number; // horário programado do alerta (ms)
  status: ReminderStatus;
}

const KEY = "pf:reminders";
export const SW_URL = "/notification-sw.js";

/** Função centralizada: retorno = saída + duração. */
export function computeReturnAt(exitAt: number, durationMinutes: number): number {
  return exitAt + durationMinutes * 60_000;
}

/** Função centralizada: alerta = retorno − antecedência. */
export function computeNotifyAt(returnAt: number, minutesBefore: number): number {
  return returnAt - minutesBefore * 60_000;
}

export function reminderId(dateKey: string, type: PunchType): string {
  return `${dateKey}:${type}`;
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function getReminders(): Promise<Record<string, BreakReminder>> {
  return (await get<Record<string, BreakReminder>>(KEY)) ?? {};
}

async function writeReminders(all: Record<string, BreakReminder>) {
  await set(KEY, all);
  await syncServiceWorker(all);
}

export async function getReminder(
  dateKey: string,
  type: PunchType,
): Promise<BreakReminder | null> {
  const all = await getReminders();
  return all[reminderId(dateKey, type)] ?? null;
}

export async function saveReminder(r: BreakReminder): Promise<void> {
  const all = await getReminders();
  all[r.id] = r; // substituir sempre invalida/atualiza o anterior (mesmo id)
  await writeReminders(all);
}

export async function cancelReminder(
  dateKey: string,
  type: PunchType,
  status: ReminderStatus = "cancelled",
): Promise<void> {
  const id = reminderId(dateKey, type);
  const all = await getReminders();
  if (!all[id]) return;
  all[id] = { ...all[id], status };
  await writeReminders(all);
  postToSW({ type: "CANCEL_REMINDER", id });
}

export async function markFired(id: string): Promise<void> {
  const all = await getReminders();
  if (!all[id] || all[id].status !== "pending") return;
  all[id] = { ...all[id], status: "fired" };
  await writeReminders(all);
}

/** Remove lembretes antigos já resolvidos para não acumular. */
export async function pruneReminders(): Promise<void> {
  const all = await getReminders();
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  let changed = false;
  for (const [id, r] of Object.entries(all)) {
    if (r.status !== "pending" && r.exitAt < cutoff) {
      delete all[id];
      changed = true;
    }
  }
  if (changed) await writeReminders(all);
}

// ============= Service Worker =============

let swReady: Promise<ServiceWorkerRegistration | null> | null = null;

export function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!swReady) {
    swReady = navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .catch(() => null);
  }
  return swReady;
}

function postToSW(message: unknown) {
  ensureServiceWorker().then((reg) => {
    const target = reg?.active ?? navigator.serviceWorker?.controller;
    target?.postMessage(message);
  });
}

function pendingPayload(all: Record<string, BreakReminder>) {
  return Object.values(all)
    .filter((r) => r.status === "pending" && r.minutesBefore > 0)
    .map((r) => ({
      id: r.id,
      notifyAt: r.notifyAt,
      returnLabel: formatClock(r.returnAt),
    }));
}

export async function syncServiceWorker(
  all?: Record<string, BreakReminder>,
): Promise<void> {
  const data = all ?? (await getReminders());
  postToSW({ type: "SYNC_REMINDERS", reminders: pendingPayload(data) });
}

// ============= Permissão =============

export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export function notificationPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationPermission() === "unsupported") return "unsupported";
  if (Notification.permission === "default") {
    try {
      return (await Notification.requestPermission()) as PermissionState;
    } catch {
      return Notification.permission as PermissionState;
    }
  }
  return Notification.permission as PermissionState;
}

/**
 * Verificação de segurança executada com o app aberto: dispara lembretes
 * vencidos que o Service Worker possa ter perdido (Android suspende o SW).
 * Cada lembrete só dispara uma vez graças ao status persistido + tag única.
 */
export async function checkDueReminders(): Promise<void> {
  if (notificationPermission() !== "granted") return;
  const all = await getReminders();
  const now = Date.now();
  for (const r of Object.values(all)) {
    if (r.status !== "pending" || r.minutesBefore <= 0) continue;
    if (r.notifyAt > now) continue;
    if (now > r.returnAt + 60 * 60 * 1000) {
      // muito atrasado: encerra sem notificar
      await markFired(r.id);
      continue;
    }
    postToSW({
      type: "FIRE_NOW",
      reminder: { id: r.id, notifyAt: r.notifyAt, returnLabel: formatClock(r.returnAt) },
    });
    await markFired(r.id);
  }
}
