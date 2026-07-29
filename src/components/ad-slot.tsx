/**
 * Espaço reservado para futura monetização (Google AdSense ou similar).
 * Não carrega nenhum anúncio real — apenas o container responsivo.
 */
export function AdSlot() {
  return (
    <div
      aria-hidden
      data-ad-slot="footer"
      className="mx-auto w-full max-w-md px-3 pb-2"
    >
      <div className="flex h-14 items-center justify-center rounded-xl border border-dashed border-border bg-card text-[11px] uppercase tracking-widest text-muted-foreground">
        Espaço reservado para anúncios
      </div>
    </div>
  );
}
