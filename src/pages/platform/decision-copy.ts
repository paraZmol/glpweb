import type { ButtonVariant } from '@/components/common/button';
import type { ReviewAction } from '@/features/platform/review-actions';

type Copy = {
  label: string;
  variant: ButtonVariant;
  title: string;
  body: string;
  confirm: string;
  loading: string;
  done: string;
};

// PLAN 2.11. Approving says the platform looked at what was declared, nothing more: no text
// here calls a distributor "verificada".
export const DECISION_COPY: Record<ReviewAction, Copy> = {
  approve: {
    label: 'Aprobar',
    variant: 'primary',
    title: '¿Aprobar esta ficha?',
    body: 'Aparecerá en el buscador y su página será pública mientras la distribuidora pueda operar. Aprobar dice que Hornilla revisó lo declarado, nada más.',
    confirm: 'Sí, aprobar',
    loading: 'Aprobando la ficha…',
    done: 'Ficha aprobada.',
  },
  requestChanges: {
    label: 'Pedir cambios',
    variant: 'line',
    title: 'Pedir cambios',
    body: 'La ficha no se muestra al público. Todo el personal de la distribuidora puede leer esta nota en su panel.',
    confirm: 'Enviar nota',
    loading: 'Enviando la nota…',
    done: 'Nota enviada. La ficha queda sin mostrar.',
  },
  suspend: {
    label: 'Suspender',
    variant: 'line',
    title: '¿Suspender esta distribuidora?',
    body: 'Queda en solo lectura para su personal y deja de verse en el buscador y en su enlace. La aprobación de su ficha se conserva.',
    confirm: 'Sí, suspender',
    loading: 'Suspendiendo…',
    done: 'Distribuidora suspendida.',
  },
  reactivate: {
    label: 'Reactivar',
    variant: 'line',
    title: '¿Reactivar esta distribuidora?',
    body: 'Vuelve a operar: en su prueba si todavía corre, o como activa. Se muestra de nuevo solo si su ficha está aprobada.',
    confirm: 'Sí, reactivar',
    loading: 'Reactivando…',
    done: 'Distribuidora reactivada.',
  },
};
