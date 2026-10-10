import { formatMoney } from '@/domain/money/format';

const SAMPLE_PRICE_CENTS = 3800;

export function ComingSoonPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6 py-12">
      <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
        glpWEB
      </p>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
        Pide tu gas y mira dónde viene.
      </h1>
      <p className="text-lg text-muted-foreground">
        Estamos construyendo la plataforma para distribuidoras de gas: pedidos, reparto en tiempo
        real y cuadre de caja en un solo lugar.
      </p>
      <p className="border-t border-border pt-4 text-sm text-muted-foreground tabular-nums">
        Balón de 10 kg desde {formatMoney(SAMPLE_PRICE_CENTS)} · En construcción
      </p>
    </main>
  );
}
