/**
 * Minimal reader for the legal texts of docs/legal (PLAN 2.7). It understands only what those
 * documents use (title, sections, paragraphs, lists, tables, quotes and bold) and returns plain
 * data: the screen builds elements from it, so no HTML from the text is ever injected.
 */
export interface InlineRun {
  text: string;
  strong: boolean;
}

export type LegalBlock =
  | { kind: 'heading'; level: 2 | 3; id: string; text: string }
  | { kind: 'paragraph'; runs: InlineRun[] }
  | { kind: 'note'; runs: InlineRun[] }
  | { kind: 'list'; ordered: boolean; items: InlineRun[][] }
  | { kind: 'table'; header: InlineRun[][]; rows: InlineRun[][][] };

export interface DraftMark {
  version: string;
  /** ISO date (`2026-10-10`) of the draft. */
  date: string;
}

export interface LegalDocument {
  title: string;
  /** Present while the text is a draft waiting for legal review. */
  draft: DraftMark | null;
  blocks: LegalBlock[];
}

const DRAFT_PATTERN = /BORRADOR v(\d+(?:\.\d+)*) \((\d{4}-\d{2}-\d{2})\)/;
const HEADING_PATTERN = /^(#{1,3}) (.+)$/;
const BULLET_PATTERN = /^- (.+)$/;
const NUMBERED_PATTERN = /^\d+\. (.+)$/;
const TABLE_DIVIDER_PATTERN = /^\|(?:\s*:?-+:?\s*\|)+$/;
const BOLD_MARK = '**';
const DIACRITICS = /[̀-ͯ]/g;

export function parseInline(text: string): InlineRun[] {
  return text
    .split(BOLD_MARK)
    .map((part, index) => ({ text: part, strong: index % 2 === 1 }))
    .filter((run) => run.text !== '');
}

export function plainText(runs: readonly InlineRun[]): string {
  return runs.map((run) => run.text).join('');
}

export function slugOf(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cellsOf(row: string): InlineRun[][] {
  return row
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => parseInline(cell.trim()));
}

type Pending =
  | { kind: 'paragraph' | 'note'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; rows: string[] };

function finish(pending: Pending): LegalBlock {
  if (pending.kind === 'list') {
    return { kind: 'list', ordered: pending.ordered, items: pending.items.map(parseInline) };
  }
  if (pending.kind === 'table') {
    const [header = '', ...rows] = pending.rows.filter((row) => !TABLE_DIVIDER_PATTERN.test(row));
    return { kind: 'table', header: cellsOf(header), rows: rows.map(cellsOf) };
  }
  return { kind: pending.kind, runs: parseInline(pending.lines.join(' ')) };
}

/** Adds the line to the block being read, or returns the block it starts. */
function extend(pending: Pending | null, line: string): Pending | null {
  const text = line.trim();
  const item = BULLET_PATTERN.exec(text) ?? NUMBERED_PATTERN.exec(text);
  if (item?.[1]) {
    const ordered = NUMBERED_PATTERN.test(text);
    if (pending?.kind !== 'list' || pending.ordered !== ordered) {
      return { kind: 'list', ordered, items: [item[1]] };
    }
    pending.items.push(item[1]);
    return null;
  }
  if (pending?.kind === 'list' && /^\s/.test(line)) {
    pending.items[pending.items.length - 1] += ` ${text}`;
    return null;
  }
  if (text.startsWith('|')) {
    if (pending?.kind !== 'table') return { kind: 'table', rows: [text] };
    pending.rows.push(text);
    return null;
  }
  const kind = text.startsWith('>') ? 'note' : 'paragraph';
  const content = kind === 'note' ? text.replace(/^>\s?/, '') : text;
  if (pending?.kind !== kind) return { kind, lines: [content] };
  pending.lines.push(content);
  return null;
}

function headingOf(level: number, text: string): LegalBlock {
  return { kind: 'heading', level: level === 2 ? 2 : 3, id: slugOf(text), text };
}

export function parseLegalDocument(source: string): LegalDocument {
  const document: LegalDocument = { title: '', draft: null, blocks: [] };
  let pending: Pending | null = null;

  const flush = () => {
    if (pending) document.blocks.push(finish(pending));
    pending = null;
  };

  for (const line of source.split(/\r?\n/)) {
    const heading = HEADING_PATTERN.exec(line);
    if (line.trim() === '' || heading) flush();
    if (heading?.[1] && heading[2]) {
      if (heading[1].length === 1) document.title = heading[2].trim();
      else document.blocks.push(headingOf(heading[1].length, heading[2].trim()));
    } else if (line.trim() !== '') {
      const started = extend(pending, line);
      if (started) {
        flush();
        pending = started;
      }
    }
  }
  flush();
  return takeDraftMark(document);
}

/** The opening note that declares the draft becomes data; the screen shows its own banner. */
function takeDraftMark(document: LegalDocument): LegalDocument {
  const index = document.blocks.findIndex(
    (block) => block.kind === 'note' && DRAFT_PATTERN.test(plainText(block.runs)),
  );
  const block = document.blocks[index];
  if (block?.kind !== 'note') return document;
  const [, version = '', date = ''] = DRAFT_PATTERN.exec(plainText(block.runs)) ?? [];
  return {
    ...document,
    draft: { version, date },
    blocks: document.blocks.filter((_, position) => position !== index),
  };
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** `2026-10-10` → "10 de octubre de 2026". Returns the input when it is not an ISO date. */
export function formatLegalDate(isoDate: string): string {
  const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate) ?? [];
  const monthName = MONTHS[Number(month) - 1];
  return year && day && monthName ? `${Number(day)} de ${monthName} de ${year}` : isoDate;
}
