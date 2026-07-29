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

// ============= Jornada e horas extras =============

/** Como a jornada prevista é definida. */
export type JourneyMode = "previa" | "outro" | "personalizado";

export interface JourneyTimes {
  entrada: string; // "HH:MM"
  saidaAlmoco: string;
  voltaAlmoco: string;
  saida: string;
}

export interface JourneySettings {
  /** Cálculo automático de horas extras (nunca ligado por padrão). */
  overtimeEnabled: boolean;
  /** Jornada prevista em minutos. */
  expectedMinutes: number;
  /** Origem da jornada prevista. */
  mode: JourneyMode;
  /** Turno de referência quando mode === "outro". */
  presetShift?: Shift;
  /** Horários manuais quando mode === "personalizado". */
  times: JourneyTimes;
}

const JOURNEY_KEY = "pf:journey";

export const DEFAULT_EXPECTED_MINUTES: Record<Shift, number> = {
  "1": 8 * 60,
  adm: 8 * 60,
  "2": 8 * 60,
  "3": 8 * 60,
  "12x36": 12 * 60,
  custom: 8 * 60,
};

export const DEFAULT_JOURNEY_TIMES: Record<Shift, JourneyTimes> = {
  "1": { entrada: "06:00", saidaAlmoco: "10:00", voltaAlmoco: "11:00", saida: "15:00" },
  adm: { entrada: "08:00", saidaAlmoco: "12:00", voltaAlmoco: "13:00", saida: "17:00" },
  "2": { entrada: "14:00", saidaAlmoco: "18:00", voltaAlmoco: "19:00", saida: "23:00" },
  "3": { entrada: "22:00", saidaAlmoco: "02:00", voltaAlmoco: "03:00", saida: "06:00" },
  "12x36": { entrada: "07:00", saidaAlmoco: "12:00", voltaAlmoco: "13:00", saida: "19:00" },
  custom: { entrada: "08:00", saidaAlmoco: "12:00", voltaAlmoco: "13:00", saida: "17:00" },
};

function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Jornada prevista (em minutos) a partir de horários, descontando o intervalo. */
export function expectedFromTimes(t: JourneyTimes): number {
  const wrap = (start: number, end: number) =>
    end >= start ? end - start : end + 24 * 60 - start;
  const total = wrap(hhmmToMinutes(t.entrada), hhmmToMinutes(t.saida));
  const brk = wrap(hhmmToMinutes(t.saidaAlmoco), hhmmToMinutes(t.voltaAlmoco));
  return Math.max(0, total - brk);
}

/** O regime 12x36 nunca usa cálculo automático de hora extra. */
export function overtimeAllowed(shift: Shift): boolean {
  return shift !== "12x36";
}

export function defaultJourney(shift: Shift): JourneySettings {
  return {
    overtimeEnabled: false,
    expectedMinutes: DEFAULT_EXPECTED_MINUTES[shift],
    mode: "previa",
    times: DEFAULT_JOURNEY_TIMES[shift],
  };
}

export async function getJourney(shift: Shift): Promise<JourneySettings> {
  const all = (await get<Partial<Record<Shift, JourneySettings>>>(JOURNEY_KEY)) ?? {};
  const stored = all[shift];
  const base = defaultJourney(shift);
  const merged = stored ? { ...base, ...stored } : base;
  merged.times = { ...base.times, ...(stored?.times ?? {}) };
  if (!overtimeAllowed(shift)) merged.overtimeEnabled = false;
  return merged;
}

export async function setJourney(shift: Shift, j: JourneySettings): Promise<void> {
  const all = (await get<Partial<Record<Shift, JourneySettings>>>(JOURNEY_KEY)) ?? {};
  all[shift] = { ...j, overtimeEnabled: overtimeAllowed(shift) ? j.overtimeEnabled : false };
  await set(JOURNEY_KEY, all);
}

/** Minutos de intervalo registrados no dia (almoço + lanche), quando fechados. */
export function breakMinutes(day: DayRecords): number | null {
  const pairs: [PunchType, PunchType][] = [
    ["saida_almoco", "volta_almoco"],
    ["saida_lanche", "volta_lanche"],
  ];
  let total = 0;
  let any = false;
  for (const [out, back] of pairs) {
    const o = day[out]?.time;
    const b = day[back]?.time;
    if (o && b) {
      any = true;
      total += (new Date(b).getTime() - new Date(o).getTime()) / 60000;
    }
  }
  return any ? Math.max(0, Math.round(total)) : null;
}

export type JourneyStatus = "empty" | "in_progress" | "complete";

/** Estado da jornada do dia com base nos registros reais (nunca inventa horários). */
export function journeyStatus(day: DayRecords): JourneyStatus {
  const filled = PUNCH_TYPES.filter((t) => day[t]).length;
  if (filled === 0) return "empty";
  return filled === PUNCH_TYPES.length ? "complete" : "in_progress";
}


/** Tempo total registrado no dia (entrada→saída menos intervalos), em minutos. */
export function workedMinutes(day: DayRecords): number | null {
  const entrada = day.entrada?.time;
  const saida = day.saida?.time;
  if (!entrada || !saida) return null;
  let total =
    (new Date(saida).getTime() - new Date(entrada).getTime()) / 60000;
  const pairs: [PunchType, PunchType][] = [
    ["saida_almoco", "volta_almoco"],
    ["saida_lanche", "volta_lanche"],
  ];
  for (const [out, back] of pairs) {
    const o = day[out]?.time;
    const b = day[back]?.time;
    if (o && b) {
      total -= (new Date(b).getTime() - new Date(o).getTime()) / 60000;
    }
  }
  return Math.max(0, Math.round(total));
}

export function formatMinutes(min: number): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}h${String(abs % 60).padStart(2, "0")}`;
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