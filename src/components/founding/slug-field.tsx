import { Check, CircleAlert, Link2, LoaderCircle, type LucideIcon } from 'lucide-react';
import { TextField } from '@/components/common/text-field';
import { SLUG_MAX_LENGTH } from '@/domain/tenancy/slug';
import { describeFieldIssue } from '@/features/tenancy/tenancy-messages';
import type { SlugAvailability } from '@/features/tenancy/use-slug-check';
import { GLYPH_STROKE, ICON_STROKE } from '@/lib/icons';
import { distributorPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

type Verdict = { icon: LucideIcon; text: string; tone: string; isSpinning?: boolean };

function verdictOf(availability: SlugAvailability): Verdict | null {
  switch (availability.status) {
    case 'empty':
      return null;
    case 'checking':
      return {
        icon: LoaderCircle,
        text: 'Comprobando si está libre…',
        tone: 'text-muted-foreground',
        isSpinning: true,
      };
    case 'available':
      return { icon: Check, text: 'Está libre.', tone: 'text-state-free-text' };
    case 'taken':
      return {
        icon: CircleAlert,
        text: 'Ya lo usa otra distribuidora. Prueba con otro.',
        tone: 'text-destructive',
      };
    case 'invalid':
      return {
        icon: CircleAlert,
        text: describeFieldIssue({ field: 'slug', code: availability.issue }),
        tone: 'text-destructive',
      };
    case 'unknown':
      return {
        icon: CircleAlert,
        text: 'No pudimos comprobarlo ahora. Lo confirmamos al crear la distribuidora.',
        tone: 'text-muted-foreground',
      };
  }
}

type SlugFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Set when the step was refused: it replaces the live verdict. */
  error?: string;
  availability: SlugAvailability;
};

/**
 * The link of the distributor's own page (PLAN 2.2): proposed from the name, checked while the
 * person types, and shown as the final address. The verdict is icon and words, never colour alone.
 */
export function SlugField({ value, onChange, error, availability }: SlugFieldProps) {
  const verdict = error ? null : verdictOf(availability);
  const slug = availability.status === 'empty' ? '' : availability.slug;

  return (
    <div>
      <TextField
        label="Enlace de tu página"
        name="slug"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={SLUG_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        hint="Letras minúsculas, números y guiones. Es lo que compartes con tus clientes."
      />
      <p role="status" className="mt-2 min-h-5 text-sm font-semibold">
        {verdict && (
          <span className={cn('flex items-start gap-1.5', verdict.tone)}>
            <verdict.icon
              aria-hidden="true"
              className={cn('mt-0.5 size-4 shrink-0', verdict.isSpinning && 'animate-spin')}
              strokeWidth={GLYPH_STROKE}
            />
            {verdict.text}
          </span>
        )}
      </p>
      {slug !== '' && (
        <p className="mt-2 flex max-w-full items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-[0.9375rem]">
          <Link2
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
            strokeWidth={ICON_STROKE}
          />
          {/* Only the path: the host is where the app happens to be served from. */}
          <span className="shrink-0 text-muted-foreground">Tu enlace</span>
          <strong className="min-w-0 wrap-anywhere tabular-nums">{distributorPath(slug)}</strong>
        </p>
      )}
    </div>
  );
}
