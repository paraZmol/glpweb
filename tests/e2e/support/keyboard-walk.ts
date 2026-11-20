import type { Page } from '@playwright/test';

/** What a person using only the keyboard finds at one stop of the Tab key. */
export interface TabStop {
  /** Tag and role, e.g. `a`, `button`, `input`. */
  tag: string;
  /** The accessible name as a screen reader would say it (empty when there is none). */
  name: string;
  /** Whether the browser draws a focus ring (outline or shadow) around it. */
  hasFocusRing: boolean;
  /** Whether it is inside the visible part of the page after the browser scrolled to it. */
  isOnScreen: boolean;
}

const MAX_STOPS = 150;

/**
 * Presses Tab until the focus leaves the page, comes back to where it started or `MAX_STOPS`
 * is reached (a trap), and reports every stop. The caller decides what is acceptable.
 */
export async function walkWithTab(page: Page): Promise<{ stops: TabStop[]; looped: boolean }> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const stops: TabStop[] = [];
  const seen = new Set<string>();
  let looped = false;
  for (let step = 0; step < MAX_STOPS; step += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const labelledBy = element
        .getAttribute('aria-labelledby')
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ');
      const labels = 'labels' in element ? [...((element as HTMLInputElement).labels ?? [])] : [];
      const name = (
        element.getAttribute('aria-label') ||
        labelledBy ||
        labels.map((label) => label.textContent ?? '').join(' ') ||
        element.textContent ||
        element.querySelector('img')?.getAttribute('alt') ||
        element.getAttribute('title') ||
        element.getAttribute('placeholder') ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      const style = getComputedStyle(element);
      const hasOutline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
      const hasShadow = style.boxShadow !== 'none';
      const box = element.getBoundingClientRect();
      const key = `${element.tagName}|${name}|${Math.round(box.x)}|${Math.round(box.y + scrollY)}`;
      return {
        key,
        tag: element.tagName.toLowerCase(),
        name,
        hasFocusRing: hasOutline || hasShadow,
        isOnScreen:
          box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth,
      };
    });
    if (stop === null) break;
    if (seen.has(stop.key)) {
      looped = true;
      break;
    }
    seen.add(stop.key);
    stops.push({
      tag: stop.tag,
      name: stop.name,
      hasFocusRing: stop.hasFocusRing,
      isOnScreen: stop.isOnScreen,
    });
  }
  return { stops, looped };
}
