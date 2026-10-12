import * as m from 'motion/react-m';
import { enterTransition } from '@/lib/motion';

type WizardProgressProps = {
  /** Position of the step on display, starting at 1. */
  current: number;
  total: number;
  /** Subject of the step: "Negocio", "Ubicación"… */
  label: string;
};

/**
 * Where the person is in a wizard: "Paso 2 de 4" in words and a bar that advances in `base`
 * (motion-system §3). The bar grows by `transform` only.
 */
export function WizardProgress({ current, total, label }: WizardProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={`Paso ${current} de ${total}: ${label}`}
      aria-label="Avance del registro"
    >
      <p className="flex items-baseline justify-between gap-3 text-[0.9375rem] font-semibold">
        <span className="tabular-nums">
          Paso {current} de {total}
        </span>
        <span className="text-muted-foreground">{label}</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <m.div
          className="h-full origin-left rounded-full bg-primary"
          initial={false}
          animate={{ scaleX: current / total }}
          transition={enterTransition('base')}
        />
      </div>
    </div>
  );
}
