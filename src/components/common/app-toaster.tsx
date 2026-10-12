import type { CSSProperties } from 'react';
import { Toaster } from 'sonner';
import { useIsDesktop } from '@/lib/use-media-query';

// Sonner reads its colours from these variables: every toast uses the tokens of the theme.
const TOKENS = {
  '--normal-bg': 'var(--card)',
  '--normal-text': 'var(--foreground)',
  '--normal-border': 'var(--border)',
  '--border-radius': 'var(--radius-lg)',
  '--width': '22.5rem',
} as CSSProperties;

const OFFSET = '1rem';
const ABOVE_BOTTOM_NAV = 'calc(var(--bottom-nav-height) + 0.75rem)';
const BELOW_TOP_CHROME = 'calc(var(--top-inset) + 1rem)';

/**
 * Container of the toasts (motion-system §5): they rise from the bottom on a phone, above the
 * bottom bar, and come in at the top right on desktop. Show one with `toast` from `sonner`.
 */
export function AppToaster() {
  const isDesktop = useIsDesktop();
  return (
    <Toaster
      theme="system"
      position={isDesktop ? 'top-right' : 'bottom-center'}
      offset={{ top: BELOW_TOP_CHROME, right: OFFSET, bottom: OFFSET, left: OFFSET }}
      mobileOffset={{ bottom: ABOVE_BOTTOM_NAV, left: OFFSET, right: OFFSET }}
      containerAriaLabel="Avisos"
      style={TOKENS}
      toastOptions={{
        classNames: {
          toast: 'font-sans shadow-raised!',
          title: 'text-[0.9375rem] font-semibold',
          description: 'text-muted-foreground!',
        },
      }}
    />
  );
}
