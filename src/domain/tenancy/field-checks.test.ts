import { describe, expect, it } from 'vitest';
import { checkVisibleText, isVisibleText } from './field-checks';

describe('isVisibleText', () => {
  it.each([
    ['a plain brand', 'Marca Uno'],
    ['one letter', 'A'],
    ['one digit', '7'],
    ['letters with tildes and ñ', 'Ñandú Gas'],
    ['punctuation around a letter', '«Gas»'],
    ['an emoji next to a word', 'Gas 🔥'],
    ['a non-Latin script', 'Газ'],
  ])('accepts %s', (_case, value) => {
    expect(isVisibleText(value)).toBe(true);
  });

  it.each([
    ['the empty text', ''],
    ['punctuation only', '---'],
    ['an emoji only', '🔥'],
    ['a zero-width space only', '​'],
    ['a zero-width space inside', 'Gas​Uno'],
    ['a NUL inside', 'Gas\u0000Uno'],
    ['a bell at the end', 'Gas\u0007'],
    ['a right-to-left override', '‮Gas'],
    ['a byte order mark', '﻿Gas'],
    ['a new line inside', 'Gas\nUno'],
    ['a space at the start', ' Gas'],
    ['a non-breaking space at the end', 'Gas '],
  ])('refuses %s', (_case, value) => {
    expect(isVisibleText(value)).toBe(false);
  });
});

describe('checkVisibleText', () => {
  it('says what is missing before what is invisible', () => {
    expect(checkVisibleText('', 1, 30)).toBe('required');
    expect(checkVisibleText('-', 2, 30)).toBe('tooShort');
    expect(checkVisibleText('x'.repeat(31), 1, 30)).toBe('tooLong');
  });

  it('lets an optional text stay empty', () => {
    expect(checkVisibleText('', 0, 30)).toBeNull();
  });

  it('calls a text without a letter or digit invalid', () => {
    expect(checkVisibleText('...', 1, 30)).toBe('invalid');
  });
});
