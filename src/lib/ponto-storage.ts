import { get, set, keys, del } from "idb-keyval";

export type PunchType =
  | "entrada"
  | "saida_almoco"
  | "volta_almoco"
  | "saida_lanche"
  | "volta_lanche"
  | "saida";

export const PUNCH_TYPES: PunchType[] = [
  "entrada",
  "saida_almoco",
  "volta_almoco",
  "saida",
];

export const PUNCH_TYPES_WITH_SNACK: PunchType[] = [
  "entrada",
  "saida_almoco",
  "volta_almoco",
  "saida_lanche",
  "volta_lanche",
  "saida",
];

export function getPunchOrder(snack: boolean): PunchType[] {
  return snack ? PUNCH_TYPES_WITH_SNACK : PUNCH_TYPES;
}

export const PUNCH_LABELS: Record<PunchType, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída Almoço",
  volta_almoco: "Volta Almoço",
  saida_lanche: "Saída Lanche",
  volta_lanche: "Volta Lanche",
  saida: "Saída",
};

export function getMealName(shift: Shift, variant: Shift1236Variant = "diurno"): string {
  if (shift === "2") return "Jantar";
  if (shift === "3") return "Ceia";
  if (shift === "12x36") return variant === "noturno" ? "Ceia" : "Almoço";
  return "Almoço";
}

export function getPunchLabels(
  shift: Shift,
  variant: Shift1236Variant = "diurno",
): Record<PunchType, string> {
  const meal = getMealName(shift, variant);
  return {
    entrada: "Entrada",
    saida_almoco: `Saída ${meal}`,
    volta_almoco: `Volta ${meal}`,
    saida_lanche: "Saída Lanche",
    volta_lanche: "Volta Lanche",
    saida: "Saída",
  };
}

export interface PunchRecord {
  type: PunchType;
  time: string; // ISO string
  photo?: string; // dataURL (when kind === "photo")
  justification?: string; // text (when kind === "justification")
  kind: "photo" | "justification";
}

export type DayRecords = Partial<Record<PunchType, PunchRecord>>;

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `pf:day:${y}-${m}-${d}`;
}

export function monthPrefix(year: number, month: number): string {
  const m = String(month + 1).padStart(2, "0");
  return `pf:day:${year}-${m}-`;
}

export async function getDay(date: Date): Promise<DayRecords> {
  return (await get<DayRecords>(dayKey(date))) ?? {};
}

export async function savePunch(
  date: Date,
  type: PunchType,
  photo: string,
): Promise<DayRecords> {
  const day = await getDay(date);
  day[type] = { type, time: new Date().toISOString(), photo, kind: "photo" };
  await set(dayKey(date), day);
  return day;
}

export async function savePunchJustification(
  date: Date,
  type: PunchType,
  justification: string,
): Promise<DayRecords> {
  const day = await getDay(date);
  day[type] = {
    type,
    time: new Date().toISOString(),
    justification,
    kind: "justification",
  };
  await set(dayKey(date), day);
  return day;
}

export async function getMonth(
  year: number,
  month: number,
): Promise<Record<string, DayRecords>> {
  const prefix = monthPrefix(year, month);
  const allKeys = await keys();
  const result: Record<string, DayRecords> = {};
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith(prefix)) {
      const day = await get<DayRecords>(k);
      if (day) result[k.replace("pf:day:", "")] = day;
    }
  }
  return result;
}

export async function deleteMonth(year: number, month: number): Promise<number> {
  const prefix = monthPrefix(year, month);
  const allKeys = await keys();
  let count = 0;
  for (const k of allKeys) {
    if (typeof k === "string" && k.startsWith(prefix)) {
      await del(k);
      count++;
    }
  }
  return count;
}

export type Shift = "1" | "adm" | "2" | "3" | "12x36" | "custom";

export const SHIFT_LABELS: Record<Shift, string> = {
  "1": "1º Turno",
  adm: "Administrativo",
  "2": "2º Turno",
  "3": "3º Turno",
  "12x36": "12x36",
  custom: "Personalizado",
};

const SHIFT_KEY = "pf:shift";
const CUSTOM_SHIFT_KEY = "pf:shift:custom";
const SNACK_KEY = "pf:snack";
const SHIFT_1236_VARIANT_KEY = "pf:shift:12x36:variant";

export type Shift1236Variant = "diurno" | "noturno";

export async function getSnackBreak(): Promise<boolean> {
  return (await get<boolean>(SNACK_KEY)) ?? false;
}

export async function setSnackBreak(v: boolean): Promise<void> {
  await set(SNACK_KEY, v);
}

export async function getShift1236Variant(): Promise<Shift1236Variant> {
  return (await get<Shift1236Variant>(SHIFT_1236_VARIANT_KEY)) ?? "diurno";
}

export async function setShift1236Variant(v: Shift1236Variant): Promise<void> {
  await set(SHIFT_1236_VARIANT_KEY, v);
}

export interface CustomShift {
  name: string;
  entrada: string; // "HH:MM"
  saida: string;
}

export async function getShift(): Promise<Shift> {
  return (await get<Shift>(SHIFT_KEY)) ?? "1";
}

export async function setShift(s: Shift): Promise<void> {
  await set(SHIFT_KEY, s);
}

export async function getCustomShift(): Promise<CustomShift> {
  return (
    (await get<CustomShift>(CUSTOM_SHIFT_KEY)) ?? {
      name: "Personalizado",
      entrada: "08:00",
      saida: "17:00",
    }
  );
}

export async function setCustomShift(c: CustomShift): Promise<void> {
  await set(CUSTOM_SHIFT_KEY, c);
}

export function isDayComplete(day: DayRecords): boolean {
  return PUNCH_TYPES.every((t) => day[t]);
}

export function isDayPartial(day: DayRecords): boolean {
  const filled = PUNCH_TYPES.filter((t) => day[t]).length;
  return filled > 0 && filled < PUNCH_TYPES.length;
}

export function dayHasJustification(day: DayRecords): boolean {
  return PUNCH_TYPES.some((t) => day[t]?.kind === "justification");
}

// ============= Appearance =============

export type AppearanceMode = "default" | "color" | "image";

export type DefaultTheme = "dark" | "light";

/** CSS variable overrides for the light "Fundo padrão" theme. */
export const LIGHT_THEME_VARS: Record<string, string> = {
  "--background": "#F5F5F5",
  "--foreground": "#111111",
  "--card": "#EEEEEE",
  "--card-foreground": "#111111",
  "--popover": "#EEEEEE",
  "--popover-foreground": "#111111",
  "--muted": "#E2E2E2",
  "--muted-foreground": "#5A5A5A",
  "--secondary": "#E2E2E2",
  "--secondary-foreground": "#111111",
  "--accent": "#E2E2E2",
  "--accent-foreground": "#111111",
  "--border": "#D6D6D6",
  "--input": "#E2E2E2",
};

export interface Appearance {
  mode: AppearanceMode;
  theme?: DefaultTheme;
  color: string; // hex, used when mode === "color"
  image: string | null; // dataURL, used when mode === "image"
  opacity?: number; // 10..100, used when mode === "color"
}

const APPEARANCE_KEY = "pf:appearance";
export const APPEARANCE_EVENT = "pf:appearance:changed";

export const DEFAULT_APPEARANCE: Appearance = {
  mode: "default",
  theme: "dark",
  color: "#1a1d24",
  image: null,
  opacity: 40,
};

export async function getAppearance(): Promise<Appearance> {
  return (await get<Appearance>(APPEARANCE_KEY)) ?? DEFAULT_APPEARANCE;
}

export async function setAppearance(a: Appearance): Promise<void> {
  await set(APPEARANCE_KEY, a);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: a }));
  }
}

// ============= Welcome screen =============

const WELCOME_KEY = "pf:welcome:seen";

export async function getWelcomeSeen(): Promise<boolean> {
  return (await get<boolean>(WELCOME_KEY)) ?? false;
}

export async function setWelcomeSeen(): Promise<void> {
  await set(WELCOME_KEY, true);
}

// ============= Appearance helpers (presentation) =============

const BASE_DARK = { r: 26, g: 27, b: 33 };

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full || "000000", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Color blended with the app's dark base at the given opacity (10-100). */
export function blendedBackground(color: string, opacity: number): string {
  const { r, g, b } = hexToRgb(color);
  const a = Math.min(100, Math.max(10, opacity)) / 100;
  const mix = (c: number, base: number) => Math.round(c * a + base * (1 - a));
  return `rgb(${mix(r, BASE_DARK.r)}, ${mix(g, BASE_DARK.g)}, ${mix(b, BASE_DARK.b)})`;
}

/** true when the resulting background is light enough to need dark text. */
export function isLightColor(color: string, opacity = 100): boolean {
  const { r, g, b } = hexToRgb(color);
  const a = Math.min(100, Math.max(10, opacity)) / 100;
  const mix = (c: number, base: number) => c * a + base * (1 - a);
  const lum =
    (0.299 * mix(r, BASE_DARK.r) +
      0.587 * mix(g, BASE_DARK.g) +
      0.114 * mix(b, BASE_DARK.b)) /
    255;
  return lum > 0.6;
}