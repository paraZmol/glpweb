import { describe, expect, it } from 'vitest';
import { nextKeptHash } from './join-link';

const FIRST = '#d=seed-dist-a&c=abcdefghijklmnopqrstuv';

describe('nextKeptHash', () => {
  it('keeps the invitation when the skip link jumps to the content', () => {
    expect(nextKeptHash(FIRST, '#contenido')).toBe(FIRST);
  });

  it('keeps the invitation once the address bar drops the fragment', () => {
    expect(nextKeptHash(FIRST, '')).toBe(FIRST);
  });

  it('takes a broken link opened after it, so the screen can say it is incomplete', () => {
    expect(nextKeptHash(FIRST, '#d=seed-dist-a&c=corto')).toBe('#d=seed-dist-a&c=corto');
  });

  it('takes another invitation opened in the same tab', () => {
    const second = '#d=seed-dist-b&c=zyxwvutsrqponmlkjihgfe';
    expect(nextKeptHash(FIRST, second)).toBe(second);
  });
});
