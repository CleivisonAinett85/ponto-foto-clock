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
  type JourneySettings,
  defaultJourney,
  getDay,
  getJourney,
  getPunchOrder,
  getPunchLabels,
  getShift,
  getShift1236Variant,
  getSnackBreak,
  getWelcomeSeen,
  setWelcomeSeen,
  savePunch,
  savePunchJustification,
  workedMinutes,
  formatMinutes,
  overtimeAllowed,
} from "@/lib/ponto-storage";
import {
  type BreakReminder,
  cancelReminder,
  checkDueReminders,
  computeNotifyAt,
  computeReturnAt,
  ensureServiceWorker,
  formatClock,
  getReminders,
  notificationPermission,
  pruneReminders,
  reminderId,
  requestNotificationPermission,
  saveReminder,
  syncServiceWorker,
} from "@/lib/break-reminders";

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

function isBreakExit(type: PunchType) {
  return type === "saida_almoco" || type === "saida_lanche";
}

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
  const [replaceAsk, setReplaceAsk] = useState<PunchType | null>(null);
  const [seqAsk, setSeqAsk] = useState<{ target: PunchType; prev: PunchType } | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState("");
  const [durationOpen, setDurationOpen] = useState(false);
  const [durationCustomOpen, setDurationCustomOpen] = useState(false);
  const [durationCustomMin, setDurationCustomMin] = useState("");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [breakStart, setBreakStart] = useState<number>(() => Date.now());
  const [breakType, setBreakType] = useState<PunchType | null>(null);
  const [reminders, setReminders] = useState<Record<string, BreakReminder>>({});
  const [permission, setPermission] = useState<string>("default");
  const [journey, setJourneyState] = useState<JourneySettings>(() => defaultJourney("1"));
  const [welcome, setWelcome] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const labels = getPunchLabels(shift, variant);
  const order = getPunchOrder(snack);
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    getDay(today).then(setDay);
    getShift().then((s) => {
      setShiftState(s);
      getJourney(s).then(setJourneyState);
    });
    getShift1236Variant().then(setVariant);
    getSnackBreak().then(setSnack);
    getWelcomeSeen().then((seen) => setWelcome(!seen));
    setPermission(notificationPermission());
  }, [today]);

  // Restaura lembretes persistidos, reagenda no Service Worker (sem duplicar)
  // e verifica pendências vencidas ao abrir/voltar para o app.
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      await ensureServiceWorker();
      await pruneReminders();
      await syncServiceWorker();
      await checkDueReminders();
      const all = await getReminders();
      if (alive) setReminders(all);
    };
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const iv = window.setInterval(refresh, 60_000); // rede de segurança
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(iv);
    };
  }, []);

  const closeWelcome = async () => {
    setWelcome(false);
    await setWelcomeSeen();
  };

  const returnPunch = (t: PunchType): PunchType | null =>
    t === "saida_almoco" ? "volta_almoco" : t === "saida_lanche" ? "volta_lanche" : null;

  const exitPunch = (t: PunchType): PunchType | null =>
    t === "volta_almoco" ? "saida_almoco" : t === "volta_lanche" ? "saida_lanche" : null;

  const activeReminder = (t: PunchType): BreakReminder | null => {
    const r = reminders[reminderId(dateKey, t)];
    return r && r.status === "pending" ? r : null;
  };

  const openCamera = (type: PunchType) => {
    setPending(type);
    setTimeout(() => inputRef.current?.click(), 0);
  };

  const handlePunchTap = (type: PunchType) => {
    if (day[type]) {
      setReplaceAsk(type);
      return;
    }
    const idx = order.indexOf(type);
    const prev = idx > 0 ? order[idx - 1] : null;
    if (prev && !day[prev]) {
      setSeqAsk({ target: type, prev });
      return;
    }
    setSheet(type);
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
    const wasMealExit = isBreakExit(pending);
    const updated = await savePunch(today, pending, dataUrl);
    setDay(updated);
    await clearReminderFor(pending);
    setPending(null);
    if (wasMealExit) startBreakFlow(updated[pending]?.time, pending);
  };

  const chooseJustification = async (type: PunchType, text: string) => {
    const updated = await savePunchJustification(today, type, text);
    setDay(updated);
    await clearReminderFor(type);
    setSheet(null);
    setJustifyFor(null);
    setManualFor(null);
    setManualText("");
    if (isBreakExit(type)) startBreakFlow(updated[type]?.time, type);
  };

  /** Volta registrada → intervalo concluído; Saída substituída → lembrete antigo invalidado. */
  const clearReminderFor = async (type: PunchType) => {
    const exit = exitPunch(type) ?? (isBreakExit(type) ? type : null);
    if (!exit) return;
    await cancelReminder(dateKey, exit, exitPunch(type) ? "done" : "cancelled");
    setReminders(await getReminders());
  };

  const startBreakFlow = (iso?: string, type?: PunchType) => {
    if (type) setBreakType(type);
    setBreakStart(iso ? new Date(iso).getTime() : Date.now());
    setDurationCustomOpen(false);
    setDurationCustomMin("");
    setDurationOpen(true);
  };

  const chooseDuration = (minutes: number) => {
    setBreakMinutes(minutes);
    setDurationOpen(false);
    setDurationCustomOpen(false);
    setDurationCustomMin("");
    setCustomOpen(false);
    setCustomMin("");
    setNotifyOpen(true);
  };

  const scheduleReturn = async (minutesBefore: number) => {
    setNotifyOpen(false);
    setCustomOpen(false);
    setCustomMin("");
    const type = breakType;
    if (!type) return;

    const returnAt = computeReturnAt(breakStart, breakMinutes);
    const notifyAt = computeNotifyAt(returnAt, minutesBefore);

    let perm = notificationPermission();
    if (minutesBefore > 0 && perm === "default") {
      perm = await requestNotificationPermission();
    }
    setPermission(perm);

    await saveReminder({
      id: reminderId(dateKey, type),
      dateKey,
      type,
      exitAt: breakStart,
      durationMinutes: breakMinutes,
      returnAt,
      minutesBefore,
      notifyAt,
      status: minutesBefore > 0 ? "pending" : "cancelled",
    });
    setReminders(await getReminders());
  };


  return (
    <AppShell>
      <div className="px-5 pt-8 pb-4">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          HOJE
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground capitalize">
          {formatDatePt(today)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Turno:{" "}
          <span className="text-foreground font-medium">
            {shift === "12x36"
              ? `12x36 ${variant === "noturno" ? "🌙 Noturno" : "☀️ Diurno"}`
              : SHIFT_LABELS[shift]}
          </span>
        </p>
      </div>

      <div className="px-5 space-y-3">
        {order.map((type) => {
          const record = day[type];
          const rem = activeReminder(type);
          const back = returnPunch(type);
          const breakOpen = !!rem && !(back && day[back]);
          return (
            <button
              key={type}
              onClick={() => handlePunchTap(type)}
              className={`w-full rounded-2xl px-5 py-5 flex items-center justify-between shadow-lg active:scale-[0.98] transition ${PUNCH_COLORS[type]}`}
            >
              <div className="flex items-center gap-4">
                {record?.kind === "justification" ? (
                  <FileText className="h-7 w-7" />
                ) : (
                  <Camera className="h-7 w-7" />
                )}
                <div className="text-left">
                  <div className="text-lg font-bold leading-tight flex items-center gap-2">
                    {labels[type]}
                    {breakOpen && rem!.minutesBefore > 0 && (
                      <span className="rounded-full bg-background/25 px-2 py-0.5 text-xs font-semibold">
                        ⏰ {rem!.minutesBefore} min
                      </span>
                    )}
                  </div>
                  {record && (
                    <div className="text-sm opacity-90">
                      {record.kind === "justification" ? "📄" : "📷"} Registrado às{" "}
                      {formatTime(record.time)}
                      {record.kind === "justification" &&
                        ` • Justificativa: ${record.justification}`}
                    </div>
                  )}
                  {breakOpen && (
                    <div className="text-sm opacity-90">
                      ⏰ Retorno previsto às {formatClock(rem!.returnAt)}
                      {rem!.minutesBefore > 0 && (
                        <> • 🔔 Lembrete às {formatClock(rem!.notifyAt)}</>
                      )}
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

      {permission === "denied" && (
        <div className="mx-5 mt-4 rounded-xl bg-card p-4 text-sm text-muted-foreground">
          🔕 As notificações estão bloqueadas para este site. Ative-as nas
          configurações do navegador/Android (Configurações → Site → Notificações)
          para receber o lembrete de retorno.
        </div>
      )}

      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
          Jornada de hoje
        </h2>
        <div className="rounded-xl bg-card p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Regime</span>
            <span className="text-foreground font-medium">
              {shift === "12x36"
                ? `12x36 ${variant === "noturno" ? "🌙 Noturno" : "☀️ Diurno"}`
                : SHIFT_LABELS[shift]}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Jornada prevista</span>
            <span className="text-foreground font-medium">
              {formatMinutes(journey.expectedMinutes)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total registrado</span>
            <span className="text-foreground font-medium">
              {workedMinutes(day) === null ? "—" : formatMinutes(workedMinutes(day)!)}
            </span>
          </div>
          {journey.overtimeEnabled && overtimeAllowed(shift) ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo</span>
              <span className="text-foreground font-medium">
                {workedMinutes(day) === null
                  ? "—"
                  : formatMinutes(workedMinutes(day)! - journey.expectedMinutes)}
              </span>
            </div>
          ) : (
            <p className="pt-1 text-xs text-muted-foreground">
              {shift === "12x36"
                ? "Cálculo automático de hora extra desativado para o regime 12x36."
                : "Cálculo de horas extras desativado. Ative em Ajustes se desejar."}
            </p>
          )}
          <p className="pt-2 text-[11px] text-muted-foreground">
            Ferramenta de controle e organização pessoal da jornada. Não representa
            apuração oficial nem garantia de pagamento.
          </p>
        </div>
      </section>



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

      {durationOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur flex items-end justify-center"
          onClick={() => {
            setDurationOpen(false);
            setDurationCustomOpen(false);
          }}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">⏱️ Duração do intervalo?</h3>
              <button
                onClick={() => {
                  setDurationOpen(false);
                  setDurationCustomOpen(false);
                }}
                className="p-2 rounded-lg bg-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!durationCustomOpen && (
              <>
                <button
                  onClick={() => chooseDuration(60)}
                  className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium"
                >
                  1 hora (padrão CLT)
                </button>
                <button
                  onClick={() => chooseDuration(90)}
                  className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium"
                >
                  1 hora e meia
                </button>
                <button
                  onClick={() => setDurationCustomOpen(true)}
                  className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium"
                >
                  ✏️ Personalizado
                </button>
              </>
            )}

            {durationCustomOpen && (
              <>
                <input
                  type="number"
                  min={1}
                  value={durationCustomMin}
                  onChange={(e) => setDurationCustomMin(e.target.value)}
                  placeholder="Minutos"
                  className="w-full rounded-xl bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none"
                  autoFocus
                />
                <button
                  disabled={!durationCustomMin || Number(durationCustomMin) <= 0}
                  onClick={() => chooseDuration(Number(durationCustomMin))}
                  className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-4 font-bold disabled:opacity-50"
                >
                  Confirmar duração
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
              <h3 className="text-lg font-bold">🔔 Notificar antes do retorno?</h3>
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
                  🔕 Não notificar
                </button>
                {[5, 10, 15].map((m) => (
                  <button
                    key={m}
                    onClick={() => scheduleReturn(m)}
                    className="w-full rounded-xl bg-background px-4 py-4 text-left font-medium"
                  >
                    ⏰ {m} minutos antes
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

      {replaceAsk && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur flex items-end justify-center"
          onClick={() => setReplaceAsk(null)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">⚠️ Registro já realizado!</h3>
            <p className="text-sm text-muted-foreground">
              Você já registrou {labels[replaceAsk]} às{" "}
              {formatTime(day[replaceAsk]!.time)}. Deseja substituir o registro
              atual?
            </p>
            <button
              onClick={() => setReplaceAsk(null)}
              className="w-full rounded-xl bg-muted text-muted-foreground px-4 py-4 font-medium"
            >
              ❌ Manter original
            </button>
            <button
              onClick={() => {
                const t = replaceAsk;
                setReplaceAsk(null);
                setSheet(t);
              }}
              className="w-full rounded-xl bg-warning text-primary-foreground px-4 py-4 font-bold"
            >
              🔄 Substituir registro
            </button>
          </div>
        </div>
      )}

      {seqAsk && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur flex items-end justify-center"
          onClick={() => setSeqAsk(null)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">⚠️ Atenção!</h3>
            <p className="text-sm text-muted-foreground">
              Você ainda não registrou {labels[seqAsk.prev]}. Deseja justificar
              antes de continuar?
            </p>
            <button
              onClick={() => setSeqAsk(null)}
              className="w-full rounded-xl bg-muted text-muted-foreground px-4 py-4 font-medium"
            >
              ❌ Cancelar
            </button>
            <button
              onClick={() => {
                const p = seqAsk.prev;
                setSeqAsk(null);
                setSheet(p);
                setJustifyFor(p);
              }}
              className="w-full rounded-xl bg-warning text-primary-foreground px-4 py-4 font-bold"
            >
              📝 Justificar ponto anterior
            </button>
            <button
              onClick={() => {
                const t = seqAsk.target;
                setSeqAsk(null);
                setSheet(t);
              }}
              className="w-full rounded-xl bg-danger text-primary-foreground px-4 py-4 font-bold"
            >
              ➡️ Continuar mesmo assim
            </button>
          </div>
        </div>
      )}
      {welcome && (
        <div className="fixed inset-0 z-[60] bg-background/90 backdrop-blur flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 space-y-4 text-center">
            <h2 className="text-xl font-bold">Bem-vindo ao PontoFoto! 📷</h2>
            <p className="text-sm text-muted-foreground">
              Toque em cada botão para registrar seu ponto com foto ou
              justificativa. Comece pela Entrada!
            </p>
            <button
              onClick={closeWelcome}
              className="w-full rounded-xl bg-success text-primary-foreground px-4 py-4 font-bold"
            >
              Entendido!
            </button>
          </div>
        </div>
      )}
    </AppShell>

  );
}
