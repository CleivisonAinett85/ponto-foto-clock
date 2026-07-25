import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Camera, FileText, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  SHIFT_LABELS,
  type DayRecords,
  type PunchType,
  type Shift,
  type Shift1236Variant,
  getDay,
  getPunchOrder,
  getPunchLabels,
  getShift,
  getShift1236Variant,
  getSnackBreak,
  savePunch,
  savePunchJustification,
} from "@/lib/ponto-storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Registro New" },
      {
        name: "description",
        content:
          "Registre seus horários de ponto com foto do comprovante físico.",
      },
      { property: "og:title", content: "Registro New" },
      {
        property: "og:description",
        content: "Registre seus horários de ponto com foto do comprovante físico.",
      },
    ],
  }),
  component: TodayPage,
});

const PUNCH_COLORS: Record<PunchType, string> = {
  entrada: "bg-success text-primary-foreground",
  saida_almoco: "bg-warning text-primary-foreground",
  volta_almoco: "bg-warning text-primary-foreground",
  saida_lanche: "bg-info text-primary-foreground",
  volta_lanche: "bg-info text-primary-foreground",
  saida: "bg-danger text-primary-foreground",
};

const QUICK_JUSTIFICATIONS = [
  "Sem papel no relógio de ponto",
  "⚠️ Equipamento com defeito",
  "🔌 Sistema fora do ar",
];

function formatDatePt(d: Date) {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TodayPage() {
  const [today] = useState(() => new Date());
  const [day, setDay] = useState<DayRecords>({});
  const [shift, setShiftState] = useState<Shift>("1");
  const [variant, setVariant] = useState<Shift1236Variant>("diurno");
  const [snack, setSnack] = useState(false);
  const [pending, setPending] = useState<PunchType | null>(null);
  const [sheet, setSheet] = useState<PunchType | null>(null);
  const [justifyFor, setJustifyFor] = useState<PunchType | null>(null);
  const [manualFor, setManualFor] = useState<PunchType | null>(null);
  const [manualText, setManualText] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const labels = getPunchLabels(shift, variant);
  const order = getPunchOrder(snack);

  useEffect(() => {
    getDay(today).then(setDay);
    getShift().then(setShiftState);
    getShift1236Variant().then(setVariant);
    getSnackBreak().then(setSnack);
  }, [today]);

  const openCamera = (type: PunchType) => {
    setPending(type);
    setTimeout(() => inputRef.current?.click(), 0);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !pending) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(file);
    });
    const wasMealExit = pending === "saida_almoco";
    const updated = await savePunch(today, pending, dataUrl);
    setDay(updated);
    setPending(null);
    if (wasMealExit) setNotifyOpen(true);
  };

  const chooseJustification = async (type: PunchType, text: string) => {
    const updated = await savePunchJustification(today, type, text);
    setDay(updated);
    setSheet(null);
    setJustifyFor(null);
    setManualFor(null);
    setManualText("");
    if (type === "saida_almoco") setNotifyOpen(true);
  };

  const scheduleReturn = async (minutes: number) => {
    setNotifyOpen(false);
    setCustomOpen(false);
    setCustomMin("");
    if (minutes <= 0) return;
    const meal = labels.volta_almoco;
    try {
      if ("Notification" in window) {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
      }
    } catch {
      /* ignore */
    }
    const ms = minutes * 60 * 1000;
    window.setTimeout(() => {
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("PontoFoto", {
            body: `Faltam poucos minutos para ${meal.toLowerCase()}.`,
            icon: "/icon-192.png",
          });
        } else {
          alert(`Lembrete: ${meal} em instantes.`);
        }
      } catch {
        /* ignore */
      }
    }, ms);
  };

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-4">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          Hoje
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground capitalize">
          {formatDatePt(today)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Turno:{" "}
          <span className="text-foreground font-medium">
            {SHIFT_LABELS[shift]}
          </span>
        </p>
      </div>

      <div className="px-5 space-y-3">
        {order.map((type) => {
          const record = day[type];
          return (
            <button
              key={type}
              onClick={() => setSheet(type)}
              className={`w-full rounded-2xl px-5 py-5 flex items-center justify-between shadow-lg active:scale-[0.98] transition ${PUNCH_COLORS[type]}`}
            >
              <div className="flex items-center gap-4">
                {record?.kind === "justification" ? (
                  <FileText className="h-7 w-7" />
                ) : (
                  <Camera className="h-7 w-7" />
                )}
                <div className="text-left">
                  <div className="text-lg font-bold leading-tight">
                    {labels[type]}
                  </div>
                  {record && (
                    <div className="text-sm opacity-90">
                      Registrado às {formatTime(record.time)}
                      {record.kind === "justification" && " • Justificativa"}
                    </div>
                  )}
                </div>
              </div>
              {record && (
                <div className="bg-background/25 rounded-full p-2">
                  <Check className="h-6 w-6" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />

      {sheet && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur flex items-end justify-center"
          onClick={() => {
            setSheet(null);
            setJustifyFor(null);
            setManualFor(null);
          }}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">{labels[sheet]}</h3>
              <button
                onClick={() => {
                  setSheet(null);
                  setJustifyFor(null);
                  setManualFor(null);
                }}
                className="p-2 rounded-lg bg-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!justifyFor && !manualFor && (
              <>
                <button
                  onClick={() => {
                    const t = sheet;
                    setSheet(null);
                    openCamera(t);
                  }}
                  className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium flex items-center gap-3"
                >
                  <span className="text-xl">📷</span> Tirar foto
                </button>
                <button
                  onClick={() => setJustifyFor(sheet)}
                  className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium flex items-center gap-3"
                >
                  <span className="text-xl">📝</span> Justificativa
                </button>
              </>
            )}

            {justifyFor && !manualFor && (
              <>
                {QUICK_JUSTIFICATIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => chooseJustification(justifyFor, q)}
                    className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium"
                  >
                    {q}
                  </button>
                ))}
                <button
                  onClick={() => setManualFor(justifyFor)}
                  className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium"
                >
                  ✏️ Digitar justificativa manualmente
                </button>
              </>
            )}

            {manualFor && (
              <>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Digite a justificativa..."
                  rows={4}
                  className="w-full rounded-xl bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none"
                  autoFocus
                />
                <button
                  disabled={!manualText.trim()}
                  onClick={() =>
                    chooseJustification(manualFor, manualText.trim())
                  }
                  className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-4 font-bold disabled:opacity-50"
                >
                  Salvar justificativa
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {notifyOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur flex items-end justify-center"
          onClick={() => {
            setNotifyOpen(false);
            setCustomOpen(false);
          }}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">
                Deseja ser notificado antes do retorno?
              </h3>
              <button
                onClick={() => {
                  setNotifyOpen(false);
                  setCustomOpen(false);
                }}
                className="p-2 rounded-lg bg-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!customOpen && (
              <>
                <button
                  onClick={() => scheduleReturn(0)}
                  className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium"
                >
                  Não notificar
                </button>
                {[5, 10, 15].map((m) => (
                  <button
                    key={m}
                    onClick={() => scheduleReturn(m)}
                    className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium"
                  >
                    {m} minutos
                  </button>
                ))}
                <button
                  onClick={() => setCustomOpen(true)}
                  className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium"
                >
                  ✏️ Personalizado
                </button>
              </>
            )}

            {customOpen && (
              <>
                <input
                  type="number"
                  min={1}
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  placeholder="Minutos"
                  className="w-full rounded-xl bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none"
                  autoFocus
                />
                <button
                  disabled={!customMin || Number(customMin) <= 0}
                  onClick={() => scheduleReturn(Number(customMin))}
                  className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-4 font-bold disabled:opacity-50"
                >
                  Agendar lembrete
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
