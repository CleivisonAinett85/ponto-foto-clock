import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  type DayRecords,
  type Shift,
  type Shift1236Variant,
  getMonth,
  getPunchOrder,
  getPunchLabels,
  getShift,
  getShift1236Variant,
  getSnackBreak,
  isDayComplete,
  isDayPartial,
  dayHasJustification,
} from "@/lib/ponto-storage";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "PontoFoto — Calendário" },
      {
        name: "description",
        content: "Veja seus registros de ponto organizados por mês.",
      },
      { property: "og:title", content: "PontoFoto — Calendário" },
      {
        property: "og:description",
        content: "Registros de ponto mês a mês, com foto e horário.",
      },
    ],
  }),
  component: CalendarPage,
});

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];

function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState<Record<string, DayRecords>>({});
  const [selected, setSelected] = useState<{ key: string; day: DayRecords } | null>(null);
  const [shift, setShiftState] = useState<Shift>("1");
  const [variant, setVariant] = useState<Shift1236Variant>("diurno");
  const [snack, setSnack] = useState(false);
  const labels = getPunchLabels(shift, variant);
  const order = getPunchOrder(snack);

  useEffect(() => {
    getMonth(year, month).then(setData);
  }, [year, month]);

  useEffect(() => {
    getShift().then(setShiftState);
    getShift1236Variant().then(setVariant);
    getSnackBreak().then(setSnack);
  }, []);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const keyFor = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-4">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          Calendário
        </p>
        <div className="mt-2 flex items-center justify-between">
          <button onClick={prev} className="p-2 rounded-lg bg-card">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">{MONTHS[month]} de {year}</h1>
          <button onClick={next} className="p-2 rounded-lg bg-card">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="px-5">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEK.map((w, i) => (
            <div key={i} className="text-center text-xs text-muted-foreground py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const k = keyFor(d);
            const day = data[k];
            const complete = day && isDayComplete(day);
            const partial = day && isDayPartial(day);
            const hasJust = day && dayHasJustification(day);
            return (
              <button
                key={i}
                onClick={() => day && setSelected({ key: k, day })}
                className="aspect-square rounded-lg bg-card flex flex-col items-center justify-center gap-1 active:scale-95 transition"
              >
                <span className="text-base font-medium">{d}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  hasJust
                    ? "bg-info"
                    : complete
                      ? "bg-success"
                      : partial
                        ? "bg-warning"
                        : "bg-transparent"
                }`} />
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-success shrink-0" /> Dia completo</div>
          <div className="flex items-center gap-2 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-warning shrink-0" /> Registro incompleto</div>
          <div className="flex items-center gap-2 whitespace-nowrap"><span className="h-2 w-2 rounded-full bg-info shrink-0" /> Com justificativa</div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur overflow-y-auto">
          <div className="max-w-md mx-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{selected.key.split("-").reverse().join("/")}</h2>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg bg-card">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {order.map((t) => {
                const r = selected.day[t];
                return (
                  <div key={t} className="rounded-xl bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{labels[t]}</span>
                      <span className="text-sm text-muted-foreground">
                        {r ? new Date(r.time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>
                    {r ? (
                      r.kind === "justification" ? (
                        <div className="rounded-lg bg-background p-4 text-sm">
                          <div className="text-xs uppercase tracking-widest text-info mb-1">Justificativa</div>
                          {r.justification}
                        </div>
                      ) : (
                        <img src={r.photo} alt={labels[t]} className="w-full rounded-lg" />
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem registro</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}