import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/common/button';
import { ConfirmPanel } from '@/components/common/confirm-panel';
import { InlineAlert } from '@/components/common/inline-alert';
import { FieldError } from '@/components/common/text-field';
import type { Session } from '@/domain/auth/session';
import { REVIEW_NOTE_MAX_LENGTH } from '@/domain/tenancy/constants';
import { StaleReviewError } from '@/domain/tenancy/errors';
import type { ReviewVersion } from '@/domain/tenancy/review-version';
import {
  ListingGoneError,
  type ReviewAction,
  reviewNoteProblemOf,
  runReviewAction,
} from '@/features/platform/review-actions';
import { describeTenancyError } from '@/features/tenancy/tenancy-messages';
import { useAsyncAction } from '@/lib/use-async-action';
import { DECISION_COPY } from './decision-copy';

const GONE = 'Esta distribuidora ya no existe. Vuelve a la lista.';

type ReviewDecisionProps = {
  action: ReviewAction;
  admin: Session;
  distributorId: string;
  /** The version of the listing the admin looked at: an approval is sent for it. */
  seen: ReviewVersion;
  onCancel: () => void;
  onDone: () => void;
  /** The approval was refused because the listing changed meanwhile: nothing was decided. */
  onStale: () => void;
};

/**
 * Confirmation of one decision of the platform (PLAN 2.11), with its own loading and error.
 * Nothing is optimistic: the screen changes when the server has the decision.
 */
export function ReviewDecision({
  action,
  admin,
  distributorId,
  seen,
  onCancel,
  onDone,
  onStale,
}: ReviewDecisionProps) {
  const id = useId();
  const copy = DECISION_COPY[action];
  const { isRunning, run } = useAsyncAction();
  const [note, setNote] = useState('');
  const [noteProblem, setNoteProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const needsNote = action === 'requestChanges';

  const confirm = () => {
    const problem = needsNote ? reviewNoteProblemOf(note) : null;
    setNoteProblem(problem);
    if (problem) return;
    void run(async () => {
      try {
        await runReviewAction({ action, admin, distributorId, note, seen });
        toast.success(copy.done);
        onDone();
      } catch (error) {
        if (error instanceof StaleReviewError) return onStale();
        setFailure(error instanceof ListingGoneError ? GONE : describeTenancyError(error));
      }
    });
  };

  return (
    <ConfirmPanel
      title={copy.title}
      actions={
        <>
          <Button type="button" variant="line" size="sm" disabled={isRunning} onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="ink"
            size="sm"
            loading={isRunning}
            loadingLabel={copy.loading}
            onClick={confirm}
          >
            {copy.confirm}
          </Button>
        </>
      }
    >
      <p className="mt-1 text-muted-foreground">{copy.body}</p>
      {needsNote && (
        <div className="mt-3">
          <label htmlFor={`${id}-note`} className="mb-1 block font-semibold">
            Nota para la distribuidora
          </label>
          <p id={`${id}-help`} className="mb-1.5 text-[0.8125rem] text-muted-foreground">
            No escribas el RUC ni datos personales: la nota la lee todo su personal.
          </p>
          <textarea
            id={`${id}-note`}
            name="reviewNote"
            rows={3}
            maxLength={REVIEW_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={noteProblem ? true : undefined}
            aria-describedby={`${id}-help ${noteProblem ? `${id}-problem` : `${id}-count`}`}
            className="w-full rounded-lg border-[1.5px] border-input bg-card px-3 py-2.5 text-base text-foreground aria-invalid:border-destructive"
          />
          {noteProblem && <FieldError id={`${id}-problem`}>{noteProblem}</FieldError>}
          <p
            id={`${id}-count`}
            className="mt-1 text-[0.8125rem] text-muted-foreground tabular-nums"
          >
            {note.trim().length} de {REVIEW_NOTE_MAX_LENGTH} caracteres
          </p>
        </div>
      )}
      {failure && (
        <InlineAlert tone="error" className="mt-3">
          {failure}
        </InlineAlert>
      )}
    </ConfirmPanel>
  );
}
