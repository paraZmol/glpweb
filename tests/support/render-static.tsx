import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RootLayout } from '../../src/components/layout/root-layout';
import {
  AccountGateContext,
  type AccountGateValue,
} from '../../src/features/account/account-context';

interface RenderOptions {
  /** Route pattern of the screen. */
  path?: string;
  /** Address the visitor is at (defaults to `path`). */
  at?: string;
  /** Navigation state the visitor arrives with. */
  state?: unknown;
  /** Frame around the screen: it must render the page through `PageTransition`. */
  shell?: ReactElement;
  /** Account every guard, frame and page under it will see. */
  account?: AccountGateValue;
}

/**
 * Renders a screen to its first HTML, inside the real root layout, without a browser. It shows
 * what is there before any effect runs: enough to check structure, states, links and names, and
 * to catch a screen that throws while rendering. Effects, focus and motion need a browser.
 */
export function renderStatic(page: ReactElement, options: RenderOptions = {}): string {
  const { path = '/', at = path, state, shell, account } = options;
  const screen = { path, element: page };
  const framed = shell ? { element: shell, children: [screen] } : screen;
  const router = createMemoryRouter(
    [
      {
        element: <RootLayout />,
        children: [framed, { path: '*', element: <p>otra pantalla</p> }],
      },
    ],
    { initialEntries: [{ pathname: at, state }] },
  );
  const app = <RouterProvider router={router} />;
  return renderToString(
    account ? <AccountGateContext value={account}>{app}</AccountGateContext> : app,
  );
}

/** How many times `pattern` appears in the markup. */
export function count(html: string, pattern: RegExp): number {
  return html.match(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`))?.length ?? 0;
}

/** Opening tags of `tagName`, each as written in the markup. */
export function tags(html: string, tagName: string): string[] {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'g')) ?? [];
}

/** Visible text of the markup, without tags or the comments React leaves between pieces. */
export function textOf(html: string): string {
  return html
    .replace(/<!--.*?-->/g, '')
    .replace(/<(style|script)\b.*?<\/\1>/gs, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
