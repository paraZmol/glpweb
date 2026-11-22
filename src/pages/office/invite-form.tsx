import { type FormEvent, useRef, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { Button } from '@/components/common/button';
import { TextField } from '@/components/common/text-field';
import { assignableRoles } from '@/domain/staff/member-management';
import { normalizeInviteEmail } from '@/domain/staff/invite-input';
import type { Distributor, MemberRole } from '@/domain/tenancy/types';
import { type Actor, inviteStaff } from '@/features/staff/staff-actions';
import { describeStaffError, staffFieldMessagesOf } from '@/features/staff/staff-messages';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { InviteReady } from './invite-ready';
import { RoleChoice } from './role-choice';
import { EMAIL_RECOMMENDED, EMAIL_REQUIRED_FOR_OWNER, OFFLINE_TEXT } from './staff-copy';

type InviteFormProps = {
  distributor: Distributor;
  actor: Actor;
  /** Full address of `/unirme`, without `#`. */
  joinUrl: string;
  isOnline: boolean;
  /** An invitation was created: the list of those that wait loads again. */
  onCreated: () => void;
  onClose: () => void;
};

type Created = { link: string; role: MemberRole; email: string | null };
type Errors = Record<string, string>;

/**
 * "Invitar a alguien" (PLAN 3.2): the role, and the Google address to tie it to — optional for
 * the central and the driver, and recommended; required for another owner, whom only the
 * founder invites. Then the link, ready to share.
 */
export function InviteForm({ distributor, actor, joinUrl, isOnline, ...on }: InviteFormProps) {
  const roles = assignableRoles(distributor.ownerUid === actor.uid);
  const [role, setRole] = useState<MemberRole>('driver');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [created, setCreated] = useState<Created | null>(null);
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, errors);

  if (created) {
    return <InviteReady {...created} distributorName={distributor.name} onDone={on.onClose} />;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isOnline) return;
    const typed = normalizeInviteEmail(email);
    void run(async () => {
      try {
        const shared = await inviteStaff(
          distributor,
          actor,
          { role, email: typed || undefined },
          joinUrl,
        );
        setCreated({ link: shared.link, role, email: typed || null });
        on.onCreated();
      } catch (error) {
        const fields = staffFieldMessagesOf(error);
        setErrors(Object.keys(fields).length > 0 ? fields : { form: describeStaffError(error) });
      }
    });
  };

  return (
    <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-5">
      <h2 className="text-xl font-bold">Invitar a alguien.</h2>
      <RoleChoice
        label="¿Qué hará en tu distribuidora?"
        roles={roles}
        value={role}
        onChange={setRole}
        withDuties
      />
      <TextField
        label={role === 'owner' ? 'Correo de Google' : 'Correo de Google (opcional)'}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="off"
        placeholder="nombre@example.com"
        value={email}
        error={errors.email ?? errors.role}
        hint={role === 'owner' ? EMAIL_REQUIRED_FOR_OWNER : EMAIL_RECOMMENDED}
        onChange={(event) => setEmail(event.target.value)}
      />
      <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="line" disabled={isRunning} onClick={on.onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={isRunning}
          loadingLabel="Creando la invitación…"
          disabled={!isOnline}
        >
          Crear invitación
        </Button>
      </div>
    </form>
  );
}
