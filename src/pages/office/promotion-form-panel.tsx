import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { Button } from '@/components/common/button';
import { Panel } from '@/components/layout/page-header';
import { TemplateChoice } from '@/components/promotions/template-choice';
import type { Product } from '@/domain/catalog/product';
import type { Promotion } from '@/domain/pricing/promotion';
import type { Distributor } from '@/domain/tenancy/types';
import { addPromotion } from '@/features/promotions/promotion-actions';
import { promotionFormErrorsOf, readPromotionForm } from '@/features/promotions/promotion-form';
import { ICON_STROKE } from '@/lib/icons';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';
import { PromotionFields } from './promotion-fields';
import { PromotionReview } from './promotion-review';
import { usePromotionForm } from './use-promotion-form';

const OFFLINE_TEXT = 'Sin conexión: para guardar la promoción necesitas internet.';
const ACCEPT_RISK =
  'Marca "Entiendo y quiero publicarla" para publicarla, o guárdala sin publicar.';

type PromotionFormPanelProps = {
  distributor: Distributor;
  uid: string;
  catalog: readonly Product[];
  promotions: readonly Promotion[];
  /** "Repetir": the promotion whose terms fill the form. */
  repeat: Promotion | null;
  onSaved: (message: string) => void;
  onCancel: () => void;
};

/**
 * "Añadir promoción" (PLAN 3.5; marketing §4): the template, then its fields on the left and,
 * fixed on the right of a desktop, how the customer will see it and what stops being charged,
 * with "Publicar promoción" and "Guardar sin publicar". On a phone the review follows the fields.
 */
export function PromotionFormPanel(props: PromotionFormPanelProps) {
  const { distributor, uid, catalog, promotions, repeat, onSaved, onCancel } = props;
  const state = usePromotionForm(distributor, catalog, repeat);
  const { form, errors, setErrors } = state;
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const rootRef = useRef<HTMLDivElement>(null);
  useFocusFirstInvalid(rootRef, errors);

  // Each step (the templates, then the fields) starts at its top.
  const step = form?.template ?? null;
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'start' });
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const save = (publish: boolean) => {
    if (!form) return;
    const read = readPromotionForm(form, new Date(), state.settings, publish);
    if (!read.ok) return setErrors(read.errors);
    if (publish && state.preview?.level === 'risk' && !form.acceptsRisk)
      return setErrors({ form: ACCEPT_RISK });
    if (!isOnline) return;
    void run(async () => {
      try {
        await addPromotion(distributor.id, uid, read.input, catalog);
        const title = read.input.title.trim();
        onSaved(publish ? `Publicamos “${title}”.` : `Guardamos “${title}” sin publicar.`);
      } catch (error) {
        setErrors(promotionFormErrorsOf(error));
      }
    });
  };

  if (!form) {
    return (
      <div ref={rootRef} className="flex scroll-mt-[calc(var(--top-inset)+1rem)] flex-col gap-4">
        <Panel dense>
          <TemplateChoice catalog={catalog} onChoose={state.choose} />
        </Panel>
        <Button type="button" variant="line" className="self-start" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="grid scroll-mt-[calc(var(--top-inset)+1rem)] grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_25rem]"
    >
      <Panel dense>
        <div className="mb-6 flex flex-col items-start gap-2">
          {!repeat && (
            <Button
              type="button"
              variant="quiet"
              size="sm"
              className="-ml-3"
              onClick={() => state.choose(null)}
            >
              <ArrowLeft aria-hidden="true" strokeWidth={ICON_STROKE} />
              Cambiar de tipo
            </Button>
          )}
          <h2 className="text-xl font-extrabold">
            {repeat ? `Repetir “${repeat.title}”.` : 'Nueva promoción.'}
          </h2>
        </div>
        <PromotionFields state={state} form={form} />
      </Panel>
      <Panel dense className="flex flex-col gap-5 lg:sticky lg:top-[calc(var(--top-inset)+1rem)]">
        <PromotionReview state={state} form={form} catalog={catalog} promotions={promotions} />
        <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            loading={isRunning}
            loadingLabel="Guardando…"
            disabled={!isOnline}
            onClick={() => save(true)}
          >
            Publicar promoción
          </Button>
          <Button
            type="button"
            variant="line"
            disabled={isRunning || !isOnline}
            onClick={() => save(false)}
          >
            Guardar sin publicar
          </Button>
          <Button type="button" variant="quiet" disabled={isRunning} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </Panel>
    </div>
  );
}
