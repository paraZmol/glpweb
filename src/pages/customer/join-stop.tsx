import type { ReactNode } from 'react';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { Button, ButtonLink } from '@/components/common/button';
import { InviteForAnotherAccountError, InviteNotFoundError } from '@/domain/staff/errors';
import { describeJoinError } from '@/features/staff/staff-messages';
import { ROUTES } from '@/lib/routes';
import { useFocusOnMount } from '@/lib/use-focus-on-mount';
import { BROKEN_LINK, joinStopCopyOf } from './join-copy';
import { useSwitchAccount } from './join-link';

const SYMBOL_PX = 56;

type JoinStopProps = {
  title: string;
  description: ReactNode;
  /** The way out. */
  actions: ReactNode;
};

/**
 * An invitation that cannot be used, said as the whole screen (PLAN 3.2): what happened, what to
 * do about it and the way out. Never a blank page and never a button that would fail.
 */
export function JoinStop({ title, description, actions }: JoinStopProps) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <section className="flex flex-col items-start gap-4 rounded-xl bg-card p-6 shadow-card lg:p-8">
      <span className="text-muted-foreground">
        <HornillaLogo variant="symbol" tone="mono" size={SYMBOL_PX} />
      </span>
      <div>
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-[1.75rem] font-extrabold text-balance wrap-break-word outline-none lg:text-[2rem]"
        >
          {title}
        </h1>
        <p className="mt-2 max-w-prose text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">{actions}</div>
    </section>
  );
}

const HOME_LINK = (
  <ButtonLink to={ROUTES.appEntry} variant="ink">
    Ir a mi inicio
  </ButtonLink>
);

/** Beside the way out with another account, home is the quiet choice. */
const QUIET_HOME_LINK = (
  <ButtonLink to={ROUTES.appEntry} variant="quiet">
    Ir a mi inicio
  </ButtonLink>
);

/** The link lost its fragment, or the fragment is not an invitation. */
export function BrokenLink() {
  return <JoinStop {...BROKEN_LINK} actions={HOME_LINK} />;
}

type JoinRefusedProps = {
  refusal: Error;
  /** From the invitation; null when there is none. */
  distributorName: string | null;
  /** The Google address of the session, to say which account is in. */
  email: string | null;
  /** Already an active member there: go to its panel instead. */
  onEnter?: () => void;
  /** The fragment of the link, kept in memory once the address bar no longer shows it. */
  linkHash: string;
};

/** Why this account cannot use the invitation, and the way on (PLAN 3.2). */
export function JoinRefused(props: JoinRefusedProps) {
  const { refusal, distributorName, email, onEnter, linkHash } = props;
  const { switchAccount, isSwitching } = useSwitchAccount(linkHash);
  const name = distributorName ?? 'esta distribuidora';
  const copy = joinStopCopyOf(refusal, name) ?? {
    title: 'No pudimos usar esta invitación.',
    description: describeJoinError(refusal),
  };
  // A link it cannot read may be for another account: the way on is to enter with that one.
  if (refusal instanceof InviteForAnotherAccountError || refusal instanceof InviteNotFoundError) {
    return (
      <JoinStop
        title={copy.title}
        description={email ? `Estás con ${email}. ${copy.description}` : copy.description}
        actions={
          <>
            <Button
              type="button"
              variant="ink"
              className="h-auto min-h-12 py-2.5 text-balance whitespace-normal"
              loading={isSwitching}
              loadingLabel="Cerrando sesión…"
              onClick={switchAccount}
            >
              Ingresar con otra cuenta de Google
            </Button>
            {QUIET_HOME_LINK}
          </>
        }
      />
    );
  }
  return (
    <JoinStop
      title={copy.title}
      description={copy.description}
      actions={
        onEnter ? (
          <Button type="button" variant="ink" onClick={onEnter}>
            Ir a mi panel
          </Button>
        ) : (
          HOME_LINK
        )
      }
    />
  );
}
