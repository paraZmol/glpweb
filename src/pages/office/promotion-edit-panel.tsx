import { type FormEvent, useEffect, useRef, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { CHIP_CLASS } from '@/components/catalog/weight-choice';
import { Button } from '@/components/common/button';
import { FieldError, TextField } from '@/components/common/text-field';
import { MAX_PROMOTION_DAYS, PROMOTION_TITLE_MAX_LENGTH } from '@/domain/pricing/constants';
import type { Promotion } from '@/domain/pricing/promotion';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import { editPromotion } from '@/features/promotions/promotion-actions';
import {
  type PromotionFormErrors,
  promotionFormErrorsOf,
} from '@/features/promotions/promotion-form';
import { whenText, withStop } from '@/features/promotions/promotion-texts';
import { useAsyncAction } from '@/lib/use-async-action';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para guardar los cambios necesitas internet.';
const MS_PER_DAY = 86_400_000;
const EXTENSIONS_DAYS = [0, 1, 3, 7] as const;

type PromotionEditPanelProps = {
  distributorId: string;
  promotion: Promotion;
  onSaved: (message: string) => void;
  onCancel: () => void;
};

/**
 * Edit a saved promotion (PLAN §11, 2026-10-16): only its name and a later end. Its price,
 * products and caps never change: that is another promotion, so the history tells the truth.
 * The end never moves earlier (customers saw it) nor beyond 30 days from its start.
 */
export function PromotionEditPanel({
  distributorId,
  promotion,
  onSaved,
  onCancel,
}: PromotionEditPanelProps) {
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(promotion.title);
  const [extraDays, setExtraDays] = useState<number>(0);
  const [errors, setErrors] = useState<PromotionFormErrors>({});
  const lastEnd = promotion.startsAt.getTime() + MAX_PROMOTION_DAYS * MS_PER_DAY;
  const endsAt = new Date(promotion.endsAt.getTime() + extraDays * MS_PER_DAY);

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isOnline) return;
    void run(async () => {
      try {
        await editPromotion(distributorId, promotion, { title, endsAt });
        onSaved(`Guardamos los cambios de “${title.trim()}”.`);
      } catch (error) {
        setErrors(promotionFormErrorsOf(error));
      }
    });
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      aria-labelledby="promotion-edit-title"
      className="flex scroll-mt-[calc(var(--top-inset)+1rem)] flex-col gap-6"
    >
      <div>
        <h2 id="promotion-edit-title" className="text-xl font-extrabold">
          Editar “{promotion.title}”.
        </h2>
        <p className="mt-1 text-muted-foreground">
          Puedes cambiar el nombre y alargarla. Para otro precio, otros productos u otros topes,
          apágala y crea otra.
        </p>
      </div>
      <TextField
        label="Nombre"
        name="title"
        autoComplete="off"
        maxLength={PROMOTION_TITLE_MAX_LENGTH}
        value={title}
        error={errors.title}
        onChange={(event) => {
          setTitle(event.target.value);
          setErrors({});
        }}
      />
      <fieldset>
        <legend className="mb-1.5 text-[0.9375rem] font-semibold">Alargar</legend>
        <div role="radiogroup" aria-label="Alargar" className="flex flex-wrap gap-2">
          {EXTENSIONS_DAYS.map((days) => (
            <button
              key={days}
              type="button"
              role="radio"
              aria-checked={extraDays === days}
              disabled={promotion.endsAt.getTime() + days * MS_PER_DAY > lastEnd}
              onClick={() => {
                setExtraDays(days);
                setErrors({});
              }}
              className={`${CHIP_CLASS} disabled:opacity-40`}
            >
              {days === 0 ? 'Sin alargar' : `${days} ${days === 1 ? 'día' : 'días'} más`}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[0.9375rem] font-semibold">
          {withStop(`Termina ${whenText(endsAt, DEFAULT_TIMEZONE)}`)}
        </p>
        {errors.validity && <FieldError id="promotion-edit-end">{errors.validity}</FieldError>}
      </fieldset>
      <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isRunning} loadingLabel="Guardando…" disabled={!isOnline}>
          Guardar cambios
        </Button>
        <Button type="button" variant="line" disabled={isRunning} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
