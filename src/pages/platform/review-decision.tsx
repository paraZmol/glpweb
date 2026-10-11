import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { FieldError } from '@/components/common/text-field';
import type { Session } from '@/domain/auth/session';
import { REVIEW_NOTE_MAX_LENGTH } from '@/domain/tenancy/constants';
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
  onCancel: () => void;
  onDone: () => void;
};

/**
 * Confirmation of one decision of the platform (PLAN 2.11), with its own loading and error.
 * Nothing is optimistic: the screen changes when the server has the decision.
 */
export function ReviewDecision({
  action,
  admin,
  distributorId,
  onCancel,
  onDone,
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
        await runReviewAction({ action, admin, distributorId, note });
        toast.success(copy.done);
        onDone();
      } catch (error) {
        setFailure(error instanceof ListingGoneError ? GONE : describeTenancyError(error));
      }
    });
  };

  return (
    <div role="group" aria-labelledby={`${id}-title`} className="rounded-lg bg-muted p-4">
      <p id={`${id}-title`} className="font-heading text-lg font-bold">
        {copy.title}
      </p>
      <p className="mt-1 text-muted-foreground">{copy.body}</p>
      {needsNote && (
        <div className="mt-3">
          <label htmlFor={`${id}-note`} className="mb-1.5 block font-semibold">
            Nota para su titular
          </label>
          <textarea
            id={`${id}-note`}
            name="reviewNote"
            rows={3}
            maxLength={REVIEW_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={noteProblem ? true : undefined}
            aria-describedby={noteProblem ? `${id}-problem` : `${id}-count`}
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
      <div className="mt-4 flex flex-wrap gap-3">
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
        <Button type="button" variant="line" size="sm" disabled={isRunning} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
