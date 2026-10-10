import { FileText } from 'lucide-react';
import { useMemo } from 'react';
import { NavLink } from 'react-router';
import { LegalBlocks } from '@/components/legal/legal-blocks';
import { type DraftMark, formatLegalDate, type LegalBlock } from '@/domain/legal/legal-markdown';
import { type LegalDocumentId, legalDocument } from '@/features/legal/legal-documents';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';

const DOCUMENTS: { id: LegalDocumentId; to: string; label: string }[] = [
  { id: 'terms', to: ROUTES.terms, label: 'Términos y condiciones' },
  { id: 'privacy', to: ROUTES.privacy, label: 'Política de privacidad' },
  { id: 'cookies', to: ROUTES.cookies, label: 'Cookies y almacenamiento' },
];

/** Shown on every legal page until a professional reviews the texts (PLAN 2.7 and 10.2). */
function DraftStrip({ draft }: { draft: DraftMark }) {
  return (
    <div
      role="note"
      className="bg-[color-mix(in_srgb,var(--state-paused)_14%,var(--card))] text-state-paused-text"
    >
      <p className="mx-auto flex w-full max-w-7xl items-start gap-2.5 px-4 py-3 text-[0.9375rem] font-semibold lg:px-8">
        <FileText aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={ICON_STROKE} />
        <span>
          <strong className="font-extrabold">Borrador en revisión.</strong> Este texto (versión{' '}
          {draft.version}) todavía no pasó la revisión legal y puede cambiar antes del lanzamiento.
        </span>
      </p>
    </div>
  );
}

function SideIndex({ blocks, currentId }: { blocks: LegalBlock[]; currentId: LegalDocumentId }) {
  const sections = blocks.flatMap((block) =>
    block.kind === 'heading' && block.level === 2 ? [block] : [],
  );
  const linkClass =
    'inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline lg:min-h-9';
  return (
    <aside className="flex flex-col gap-6 text-[0.9375rem] lg:sticky lg:top-[calc(var(--top-inset)+2rem)] lg:self-start">
      <nav aria-label="Secciones de este documento" className="rounded-xl bg-muted p-4 lg:p-5">
        <h2 className="font-heading text-base font-bold">En esta página</h2>
        <ol className="mt-1 flex flex-col text-muted-foreground">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={linkClass}>
                {section.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <nav aria-label="Documentos legales" className="px-4 lg:px-5">
        <ul className="flex flex-col font-semibold text-muted-foreground">
          {DOCUMENTS.filter((other) => other.id !== currentId).map((other) => (
            <li key={other.id}>
              <NavLink to={other.to} className={linkClass}>
                {other.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/** `/terminos`, `/privacidad` and `/cookies`: the documents of docs/legal, as they are. */
export function LegalPage({ documentId }: { documentId: LegalDocumentId }) {
  const legal = useMemo(() => legalDocument(documentId), [documentId]);
  usePageTitle(legal.title);

  return (
    <article className="flex flex-1 flex-col">
      {legal.draft && <DraftStrip draft={legal.draft} />}
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 pt-8 pb-16 lg:grid-cols-[18rem_minmax(0,44rem)] lg:gap-16 lg:px-8 lg:pt-12 lg:pb-24">
        <header className="lg:col-start-2 lg:row-start-1">
          <h1 className="text-[2.125rem] font-extrabold lg:text-[3.25rem]">{legal.title}</h1>
          {legal.draft && (
            <p className="mt-3 font-semibold text-muted-foreground tabular-nums">
              Versión {legal.draft.version} · {formatLegalDate(legal.draft.date)}
            </p>
          )}
        </header>
        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <SideIndex blocks={legal.blocks} currentId={documentId} />
        </div>
        <div className="lg:col-start-2 lg:row-start-2">
          <LegalBlocks blocks={legal.blocks} />
        </div>
      </div>
    </article>
  );
}
