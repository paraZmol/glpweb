import { describe, expect, it } from 'vitest';
import {
  formatLegalDate,
  parseInline,
  parseLegalDocument,
  plainText,
  slugOf,
} from './legal-markdown';

const run = (text: string, strong = false) => ({ text, strong });

describe('parseInline', () => {
  it.each([
    ['texto simple', [run('texto simple')]],
    ['un **dato** clave', [run('un '), run('dato', true), run(' clave')]],
    ['**todo**', [run('todo', true)]],
    ['**a** y **b**.', [run('a', true), run(' y '), run('b', true), run('.')]],
    ['', []],
  ])('reads %j', (text, expected) => {
    expect(parseInline(text)).toEqual(expected);
  });

  it('keeps anything that looks like HTML as plain text', () => {
    const runs = parseInline('<img src=x onerror=alert(1)> y <script>alert(2)</script>');

    expect(runs).toEqual([run('<img src=x onerror=alert(1)> y <script>alert(2)</script>')]);
  });
});

describe('slugOf', () => {
  it.each([
    ['1. Qué es Hornilla', '1-que-es-hornilla'],
    ['4. Precios, productos y promociones', '4-precios-productos-y-promociones'],
    ['  Ubicación en vivo  ', 'ubicacion-en-vivo'],
    ['¿¡!?', ''],
  ])('turns %j into %j', (text, expected) => {
    expect(slugOf(text)).toBe(expected);
  });
});

describe('parseLegalDocument', () => {
  const SOURCE = [
    '# Título del documento',
    '',
    '> **BORRADOR v0.3 (2026-11-05) — pendiente de revisión.**',
    '> Segunda línea de la nota.',
    '',
    '## 1. Primera sección',
    'Primera línea del párrafo,',
    'que **sigue** en la segunda.',
    '',
    'Otro párrafo.',
    '',
    '- Uno',
    '- Dos con **negrita**',
    '  que continúa abajo.',
    '',
    '1. Primero',
    '   sigue.',
    '2. Segundo',
    '',
    '### Detalle',
    '| Qué | Para qué |',
    '|---|---|',
    '| Sesión | No pedir la **contraseña** |',
    '| Preferencias | Recordar |',
    '',
    '> Una nota normal.',
  ].join('\n');

  const document = parseLegalDocument(SOURCE);

  it('reads the title and the draft mark, and removes the draft note from the body', () => {
    expect(document.title).toBe('Título del documento');
    expect(document.draft).toEqual({ version: '0.3', date: '2026-11-05' });
    expect(document.blocks.map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'list',
      'list',
      'heading',
      'table',
      'note',
    ]);
  });

  it('reads headings with their level and anchor', () => {
    expect(document.blocks[0]).toEqual({
      kind: 'heading',
      level: 2,
      id: '1-primera-seccion',
      text: '1. Primera sección',
    });
    expect(document.blocks[5]).toMatchObject({ kind: 'heading', level: 3, id: 'detalle' });
  });

  it('joins the lines of a paragraph', () => {
    expect(document.blocks[1]).toEqual({
      kind: 'paragraph',
      runs: [run('Primera línea del párrafo, que '), run('sigue', true), run(' en la segunda.')],
    });
  });

  it('reads bullet and numbered lists, with items that continue on the next line', () => {
    expect(document.blocks[3]).toEqual({
      kind: 'list',
      ordered: false,
      items: [[run('Uno')], [run('Dos con '), run('negrita', true), run(' que continúa abajo.')]],
    });
    expect(document.blocks[4]).toEqual({
      kind: 'list',
      ordered: true,
      items: [[run('Primero sigue.')], [run('Segundo')]],
    });
  });

  it('reads a table without its divider row', () => {
    expect(document.blocks[6]).toEqual({
      kind: 'table',
      header: [[run('Qué')], [run('Para qué')]],
      rows: [
        [[run('Sesión')], [run('No pedir la '), run('contraseña', true)]],
        [[run('Preferencias')], [run('Recordar')]],
      ],
    });
  });

  it('keeps a note that is not the draft mark', () => {
    expect(document.blocks[7]).toEqual({ kind: 'note', runs: [run('Una nota normal.')] });
  });

  it('reports no draft when the text does not declare one', () => {
    const published = parseLegalDocument('# Título\n\n> Nota cualquiera.\n\nTexto.');

    expect(published.draft).toBeNull();
    expect(published.blocks.map((block) => block.kind)).toEqual(['note', 'paragraph']);
  });

  it('reads Windows line endings and an empty text', () => {
    expect(parseLegalDocument('# Título\r\n\r\nTexto.\r\n').blocks).toEqual([
      { kind: 'paragraph', runs: [run('Texto.')] },
    ]);
    expect(parseLegalDocument('')).toEqual({ title: '', draft: null, blocks: [] });
  });

  it('never produces markup: a script in the text stays text', () => {
    const hostile = parseLegalDocument('# T\n\n<script>alert(1)</script> [x](javascript:alert(1))');
    const [block] = hostile.blocks;

    expect(block?.kind === 'paragraph' && plainText(block.runs)).toBe(
      '<script>alert(1)</script> [x](javascript:alert(1))',
    );
  });
});

describe('formatLegalDate', () => {
  it.each([
    ['2026-10-10', '10 de octubre de 2026'],
    ['2027-01-05', '5 de enero de 2027'],
    ['2026-13-01', '2026-13-01'],
    ['ayer', 'ayer'],
    ['', ''],
  ])('formats %j as %j', (iso, expected) => {
    expect(formatLegalDate(iso)).toBe(expected);
  });
});
