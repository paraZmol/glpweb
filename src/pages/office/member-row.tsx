import { useState } from 'react';
import { Button } from '@/components/common/button';
import { StateChip } from '@/components/common/state-chip';
import { ROLE_LABELS } from '@/components/layout/role-labels';
import type { Member, MemberRole } from '@/domain/tenancy/types';
import { ActiveConfirm, RoleEditor } from './member-row-edits';
import { ROW_BUTTON, SOFT_ROW_TEXT } from './row-button';
import { FOUNDER_SEAL } from './staff-copy';

const SEAL = 'rounded-full px-2.5 py-1 text-[0.8125rem] font-bold whitespace-nowrap';

export type MemberRowProps = {
  member: Member;
  distributorName: string;
  isMe: boolean;
  isFounder: boolean;
  /** The roles the owner may give; empty when this row can not be changed by the owner. */
  roles: readonly MemberRole[];
  /** Another change runs, or there is no connection. */
  isLocked: boolean;
  busy: 'role' | 'active' | null;
  onRole: (role: MemberRole) => Promise<boolean>;
  onActive: (active: boolean) => Promise<boolean>;
  /** Why this row offers nothing, when that is not obvious ("tú", quien fundó). */
  note?: string;
};

type Mode = 'idle' | 'role' | 'active';

function Identity({
  member,
  isMe,
  isFounder,
}: Pick<MemberRowProps, 'member' | 'isMe' | 'isFounder'>) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <h3 className="max-w-full font-heading text-base font-bold wrap-anywhere">
        {member.displayName}
        {isMe && <span className="font-semibold text-muted-foreground"> (tú)</span>}
      </h3>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${SEAL} bg-muted`}>{ROLE_LABELS[member.role]}</span>
        {isFounder && <span className={`${SEAL} bg-aji text-aji-foreground`}>{FOUNDER_SEAL}</span>}
        {member.active ? (
          <StateChip state="free">Con acceso</StateChip>
        ) : (
          <StateChip state="offline">Sin acceso</StateChip>
        )}
      </div>
    </div>
  );
}

/**
 * One person of the staff (PLAN 3.2): name, role, whether it still works there, and — for the
 * owner, when the rules allow it — change its role, switch it off or back on. Switching off or
 * on asks first (`ConfirmPanel`); nobody is ever removed.
 */
export function MemberRow(props: MemberRowProps) {
  const { member, distributorName, roles, isLocked, busy, onRole, onActive, note } = props;
  const [mode, setMode] = useState<Mode>('idle');
  const name = member.displayName;
  const finish = (done: boolean) => done && setMode('idle');
  const canManage = roles.length > 0;

  return (
    <article className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
      <Identity {...props} />
      {!canManage && note && <p className="text-sm text-muted-foreground lg:max-w-64">{note}</p>}
      {canManage && mode === 'idle' && (
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {member.active && (
            <Button
              type="button"
              variant="line"
              size="sm"
              className={ROW_BUTTON}
              disabled={isLocked}
              onClick={() => setMode('role')}
            >
              Cambiar rol<span className="sr-only"> de {name}</span>
            </Button>
          )}
          <Button
            type="button"
            variant={member.active ? 'quiet' : 'soft'}
            size="sm"
            className={`min-w-28 ${ROW_BUTTON} ${SOFT_ROW_TEXT}`}
            disabled={isLocked}
            onClick={() => setMode('active')}
          >
            {member.active ? 'Desactivar' : 'Reactivar'}
            <span className="sr-only"> a {name}</span>
          </Button>
        </div>
      )}
      {mode === 'role' && (
        <RoleEditor
          member={member}
          roles={roles}
          isLocked={isLocked}
          isBusy={busy === 'role'}
          onCancel={() => setMode('idle')}
          onSave={(role) => void onRole(role).then(finish)}
        />
      )}
      {mode === 'active' && (
        <ActiveConfirm
          member={member}
          distributorName={distributorName}
          isLocked={isLocked}
          isBusy={busy === 'active'}
          onCancel={() => setMode('idle')}
          onConfirm={() => void onActive(!member.active).then(finish)}
        />
      )}
    </article>
  );
}
