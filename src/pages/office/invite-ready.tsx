import { CircleCheck } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/common/button';
import { ROLE_LABELS } from '@/components/layout/role-labels';
import { INVITE_TTL_DAYS } from '@/domain/staff/constants';
import type { MemberRole } from '@/domain/tenancy/types';
import { ICON_STROKE } from '@/lib/icons';
import { InviteShare } from './invite-share';

type InviteReadyProps = {
  link: string;
  role: MemberRole;
  email: string | null;
  distributorName: string;
  onDone: () => void;
};

/**
 * Right after creating an invitation: the link, ready to send (PLAN 3.2). WhatsApp is the main
 * action here; the link is also in sight, to select it by hand.
 */
export function InviteReady({ link, role, email, distributorName, onDone }: InviteReadyProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const linkId = useId();
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2.5">
        <CircleCheck
          aria-hidden="true"
          className="mt-0.5 size-6 shrink-0 text-state-free-text"
          strokeWidth={ICON_STROKE}
        />
        <h2 ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">
          Invitación lista.
        </h2>
      </div>
      <p className="text-muted-foreground">
        Envíale este enlace a la persona. Entra como {ROLE_LABELS[role]}, sirve una sola vez y vence
        en {INVITE_TTL_DAYS} días.{' '}
        {email
          ? `Solo la puede usar ${email}.`
          : 'La puede usar cualquier cuenta de Google que lo tenga.'}
      </p>
      <div>
        <label htmlFor={linkId} className="mb-1.5 block text-[0.9375rem] font-semibold">
          Enlace de la invitación
        </label>
        <input
          id={linkId}
          readOnly
          value={link}
          onFocus={(event) => event.target.select()}
          className="h-12 w-full rounded-lg border-[1.5px] border-border bg-muted px-4 text-sm text-muted-foreground"
        />
      </div>
      <InviteShare
        link={link}
        distributorName={distributorName}
        role={role}
        emphasis="primary"
        size="md"
        className="max-sm:*:w-full"
      />
      <Button type="button" variant="quiet" size="sm" className="self-start" onClick={onDone}>
        Listo
      </Button>
    </div>
  );
}
