import { CornerDownRight } from 'lucide-react';
import { DEFAULT_TIMEZONE } from '@/domain/tenancy/constants';
import { formatDateTime } from '@/lib/format-date';
import { GLYPH_STROKE } from '@/lib/icons';

type SentNoteProps = {
  note: string;
  /** When the owner answered it with a correction; null while it has not. */
  correctedAt: Date | null;
};

/** The note the platform sent to a distributor, as the admin reads it back in the review. */
export function SentNote({ note, correctedAt }: SentNoteProps) {
  return (
    <figure className="rounded-lg bg-muted p-3.5">
      <figcaption className="text-[0.8125rem] font-bold text-muted-foreground">
        Nota enviada a la distribuidora
      </figcaption>
      <blockquote className="mt-1 font-semibold wrap-anywhere whitespace-pre-line">
        {note}
      </blockquote>
      {/* The note stays after a correction: it says what to look at again. */}
      {correctedAt && (
        <p className="mt-3 flex items-start gap-2 border-t pt-3 text-[0.8125rem] font-bold">
          <CornerDownRight
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-flame-text"
            strokeWidth={GLYPH_STROKE}
          />
          <span className="tabular-nums">
            Su titular envió correcciones el {formatDateTime(correctedAt, DEFAULT_TIMEZONE)}:
            compara de nuevo los datos.
          </span>
        </p>
      )}
    </figure>
  );
}
