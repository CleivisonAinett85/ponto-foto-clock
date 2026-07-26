import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  SHIFT_LABELS,
  type Shift,
  type Shift1236Variant,
  type CustomShift,
  type Appearance,
  type AppearanceMode,
  DEFAULT_APPEARANCE,
  deleteMonth,
  getShift,
  setShift,
  getCustomShift,
  setCustomShift,
  getAppearance,
  setAppearance,
  getSnackBreak,
  setSnackBreak,
  getShift1236Variant,
  setShift1236Variant,
  blendedBackground,
  isLightColor,
} from "@/lib/ponto-storage";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "PontoFoto — Configurações" },
      {
        name: "description",
        content: "Configure seu turno e gerencie os registros salvos.",
      },
      { property: "og:title", content: "PontoFoto — Configurações" },
      {
        property: "og:description",
        content: "Ajuste turno e limpe registros já validados.",
      },
    ],
  }),
  component: SettingsPage,
});

const SHIFTS: Shift[] = ["1", "adm", "2", "3", "12x36", "custom"];

function SettingsPage() {
  const [shift, setShiftState] = useState<Shift>("1");
  const [msg, setMsg] = useState<string | null>(null);
  const [custom, setCustom] = useState<CustomShift>({
    name: "Personalizado",
    entrada: "08:00",
    saida: "17:00",
  });
  const [appearance, setAppearanceState] =
    useState<Appearance>(DEFAULT_APPEARANCE);
  const [snack, setSnack] = useState(false);
  const [variant, setVariant] = useState<Shift1236Variant>("diurno");
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [wipeAsk, setWipeAsk] = useState<0 | -1 | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getShift().then(setShiftState);
    getCustomShift().then(setCustom);
    getAppearance().then(setAppearanceState);
    getSnackBreak().then(setSnack);
    getShift1236Variant().then(setVariant);
  }, []);

  const change = async (s: Shift) => {
    if (s === "12x36") {
      setShiftState("12x36");
      await setShift("12x36");
      setVariantPickerOpen(true);
      return;
    }
    setShiftState(s);
    await setShift(s);
  };

  const selectVariant = async (v: Shift1236Variant) => {
    setVariant(v);
    await setShift1236Variant(v);
    setVariantPickerOpen(false);
  };

  const updateCustom = async (patch: Partial<CustomShift>) => {
    const next = { ...custom, ...patch };
    setCustom(next);
    await setCustomShift(next);
  };

  const toggleSnack = async (v: boolean) => {
    setSnack(v);
    await setSnackBreak(v);
  };

  const monthTarget = (offset: number) => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + offset, 1);
  };

  const monthLabel = (offset: number) => {
    const l = monthTarget(offset).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    return l.charAt(0).toUpperCase() + l.slice(1);
  };

  const wipeMonth = async (offset: number) => {
    const target = monthTarget(offset);
    const label = monthLabel(offset);
    setWipeAsk(null);
    const count = await deleteMonth(target.getFullYear(), target.getMonth());
    setMsg(`${count} dia(s) apagado(s) de ${label}.`);
    setTimeout(() => setMsg(null), 3000);
  };

  const updateAppearance = async (patch: Partial<Appearance>) => {
    const next = { ...appearance, ...patch };
    setAppearanceState(next);
    await setAppearance(next);
  };

  const chooseMode = async (mode: AppearanceMode) => {
    if (mode === "image") {
      imageInputRef.current?.click();
      return;
    }
    await updateAppearance({ mode });
  };

  const onImagePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(file);
    });
    await updateAppearance({ mode: "image", image: dataUrl });
  };

  return (
    <AppShell>
      <div className="px-5 pt-8 pb-4">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">
          Configurações
        </p>
        <h1 className="mt-1 text-2xl font-bold">Ajustes</h1>
      </div>

      <section className="px-5 mt-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
          Aparência
        </h2>
        <div className="space-y-2">
          <button
            onClick={() => chooseMode("default")}
            className={`w-full text-left rounded-xl px-4 py-4 font-medium transition ${
              appearance.mode === "default"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground"
            }`}
          >
            Fundo padrão
            <div className="text-xs font-normal opacity-70 mt-1">
              {appearance.theme === "light" ? "Tema claro" : "Tema escuro"}
            </div>
          </button>

          {appearance.mode === "default" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateAppearance({ mode: "default", theme: "dark" })}
                className={`rounded-xl px-4 py-3 text-left font-medium transition ${
                  (appearance.theme ?? "dark") === "dark"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground"
                }`}
              >
                🌙 Escuro
              </button>
              <button
                onClick={() => updateAppearance({ mode: "default", theme: "light" })}
                className={`rounded-xl px-4 py-3 text-left font-medium transition ${
                  appearance.theme === "light"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground"
                }`}
              >
                ☀️ Claro
              </button>
            </div>
          )}

          <button
            onClick={() => chooseMode("color")}
            className={`w-full text-left rounded-xl px-4 py-4 font-medium transition ${
              appearance.mode === "color"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground"
            }`}
          >
            Cor sólida
            <div className="text-xs font-normal opacity-70 mt-1">
              Escolha uma cor de fundo
            </div>
          </button>

          {appearance.mode === "color" && (
            <div className="rounded-xl bg-card p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer active:opacity-80 transition">
                <span className="flex-1 text-sm font-semibold text-foreground">
                  Cor do fundo
                </span>
                <span
                  className="h-10 w-10 rounded-full border-2 border-border shadow-inner"
                  style={{ backgroundColor: appearance.color }}
                />
                <input
                  type="color"
                  value={appearance.color}
                  aria-label="Cor do fundo"
                  onChange={(e) => updateAppearance({ color: e.target.value })}
                  className="sr-only"
                />
              </label>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Opacidade da cor
                </span>
                <span className="text-sm font-semibold text-primary">
                  {appearance.opacity ?? 40}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={appearance.opacity ?? 40}
                aria-label="Opacidade da cor de fundo"
                onChange={(e) =>
                  updateAppearance({ opacity: Number(e.target.value) })
                }
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10%</span>
                <span>100%</span>
              </div>
              <div
                className="rounded-lg border border-border p-4 text-center"
                style={{
                  backgroundColor: blendedBackground(
                    appearance.color,
                    appearance.opacity ?? 40,
                  ),
                }}
              >
                <span
                  className="text-sm font-medium"
                  style={{
                    color: isLightColor(appearance.color, appearance.opacity ?? 40)
                      ? "#111"
                      : "#fff",
                  }}
                >
                  Prévia do fundo
                </span>
              </div>
            </div>
            
          )}

          <button
            onClick={() => chooseMode("image")}
            className={`w-full text-left rounded-xl px-4 py-4 font-medium transition ${
              appearance.mode === "image"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground"
            }`}
          >
            Imagem da galeria
            <div className="text-xs font-normal opacity-70 mt-1">
              {appearance.mode === "image" && appearance.image
                ? "Toque para trocar a imagem"
                : "Escolha uma foto do seu celular"}
            </div>
          </button>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onImagePicked}
          />
        </div>
      </section>

      <section className="px-5 mt-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
          Turno
        </h2>
        <div className="space-y-2">
          {SHIFTS.map((s) => (
            <button
              key={s}
              onClick={() => change(s)}
              className={`w-full text-left rounded-xl px-4 py-4 font-medium transition ${
                shift === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground"
              }`}
            >
              {SHIFT_LABELS[s]}
              {s === "adm" && (
                <div className="text-xs font-normal opacity-70 mt-1">
                  Horário comercial (08h–18h)
                </div>
              )}
              {s === "12x36" && shift === "12x36" && (
                <div className="text-xs font-normal opacity-70 mt-1">
                  {variant === "diurno" ? "☀️ Diurno" : "🌙 Noturno"}
                </div>
              )}
            </button>
          ))}
        </div>

        {shift === "custom" && (
          <div className="mt-4 rounded-xl bg-card p-4 space-y-3">
            <div>
              <label className="text-xs uppercase text-muted-foreground font-semibold">
                Nome do turno
              </label>
              <input
                type="text"
                value={custom.name}
                onChange={(e) => updateCustom({ name: e.target.value })}
                placeholder="Ex.: Turno da tarde"
                className="mt-1 w-full rounded-lg bg-background px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase text-muted-foreground font-semibold">
                  Entrada
                </label>
                <input
                  type="time"
                  value={custom.entrada}
                  onChange={(e) => updateCustom({ entrada: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-background px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground font-semibold">
                  Saída
                </label>
                <input
                  type="time"
                  value={custom.saida}
                  onChange={(e) => updateCustom({ saida: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-background px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="px-5 mt-8">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
          Intervalo de lanche
        </h2>
        <div className="rounded-xl bg-card p-4 flex items-center gap-3">
          <div className="flex-1">
            <div className="font-semibold text-foreground">
              Intervalo de lanche
            </div>
            <div className="text-sm text-muted-foreground">
              Adiciona os botões Saída Lanche e Volta Lanche na tela Hoje.
            </div>
          </div>
          <button
            role="switch"
            aria-checked={snack}
            aria-label="Intervalo de lanche"
            onClick={() => toggleSnack(!snack)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${
              snack ? "bg-info" : "bg-background"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-foreground transition-all ${
                snack ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {snack ? "Sim" : "Não"}
        </p>
      </section>

      <section className="px-5 mt-8">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
          Memória
        </h2>
        <div className="space-y-2">
          <button
            onClick={() => setWipeAsk(-1)}
            className="w-full rounded-xl px-4 py-4 bg-card text-foreground text-left"
          >
            <div className="font-semibold">Apagar mês anterior</div>
            <div className="text-sm text-muted-foreground">
              Libera espaço removendo o mês passado.
            </div>
          </button>
          <button
            onClick={() => setWipeAsk(0)}
            className="w-full rounded-xl px-4 py-4 bg-card text-foreground text-left"
          >
            <div className="font-semibold">Apagar mês atual</div>
            <div className="text-sm text-muted-foreground">
              Use após validar o espelho de ponto.
            </div>
          </button>
        </div>
        {msg && (
          <p className="mt-3 text-sm text-success">{msg}</p>
        )}
      </section>

      <section className="px-5 mt-8 text-xs text-muted-foreground">
        <p>Todos os registros ficam salvos apenas neste dispositivo. Funciona offline.</p>
      </section>

      {variantPickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur flex items-end justify-center"
          onClick={() => setVariantPickerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold">Selecionar 12x36</h3>
              <button
                onClick={() => setVariantPickerOpen(false)}
                className="p-2 rounded-lg bg-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={() => selectVariant("diurno")}
              className={`w-full rounded-xl px-4 py-4 text-left font-medium transition ${
                variant === "diurno"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">☀️</span>
                <div>
                  <div className="font-bold">Diurno</div>
                  <div className="text-xs opacity-80">Saída Almoço / Volta Almoço</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => selectVariant("noturno")}
              className={`w-full rounded-xl px-4 py-4 text-left font-medium transition ${
                variant === "noturno"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🌙</span>
                <div>
                  <div className="font-bold">Noturno</div>
                  <div className="text-xs opacity-80">Saída Ceia / Volta Ceia</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {wipeAsk !== null && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur flex items-end justify-center"
          onClick={() => setWipeAsk(null)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl p-5 pb-8 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">
              {wipeAsk === 0
                ? `⚠️ Apagar registros de ${monthLabel(0)}?`
                : `🗑️ Apagar registros de ${monthLabel(-1)}?`}
            </h3>
            <p className="text-sm text-muted-foreground">
              {wipeAsk === 0
                ? "Esta ação é irreversível. Já validou seu espelho de ponto?"
                : "Isso liberará espaço no celular. O espelho do mês anterior já foi validado?"}
            </p>
            <button
              onClick={() => setWipeAsk(null)}
              className="w-full rounded-xl bg-muted text-muted-foreground px-4 py-4 font-medium"
            >
              ❌ Cancelar
            </button>
            <button
              onClick={() => wipeMonth(wipeAsk)}
              className={`w-full rounded-xl px-4 py-4 font-bold text-primary-foreground ${
                wipeAsk === 0 ? "bg-danger" : "bg-success"
              }`}
            >
              {wipeAsk === 0 ? "🗑️ Sim, já validei e quero apagar" : "✅ Sim, apagar"}
            </button>
          </div>
        </div>
      )}
    </AppShell>

  );
}