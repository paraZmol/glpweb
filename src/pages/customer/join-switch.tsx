import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/common/button';
import { FocusShell } from '@/components/layout/focus-shell';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { useKeptInviteHash, useSwitchAccount } from './join-link';

const SWITCH_LABEL = 'Cambiar de cuenta';
const SWITCHING_LABEL = 'Cerrando sesión…';

/** Under "Entras como": the way back to this invitation with another Google account. */
export function SwitchAccountLink({
  linkHash,
  className,
}: {
  linkHash: string;
  className?: string;
}) {
  const { switchAccount, isSwitching } = useSwitchAccount(linkHash);
  return (
    <p className={cn('text-[0.9375rem] text-muted-foreground', className)}>
      ¿No es tu cuenta?{' '}
      <button
        type="button"
        disabled={isSwitching}
        aria-busy={isSwitching || undefined}
        onClick={switchAccount}
        // Inline in a sentence, yet a finger still gets 44 px.
        className="inline-flex min-h-11 items-center rounded-[0.25rem] font-semibold text-primary-text underline underline-offset-4 disabled:opacity-70"
      >
        {isSwitching ? SWITCHING_LABEL : SWITCH_LABEL}
      </button>
    </p>
  );
}

/**
 * The frame of `/unirme` (PLAN 3.2): the focused frame, whose way out here is to sign out and
 * come back to the same invitation with another account, which is what a person who opened it
 * with the wrong one needs.
 */
export function JoinShell() {
  const linkHash = useKeptInviteHash();
  const { switchAccount, isSwitching } = useSwitchAccount(linkHash);
  return (
    <FocusShell
      exit={
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="h-11"
          loading={isSwitching}
          loadingLabel={SWITCHING_LABEL}
          onClick={switchAccount}
        >
          <ArrowRightLeft aria-hidden="true" strokeWidth={ICON_STROKE} />
          {SWITCH_LABEL}
        </Button>
      }
    />
  );
}
