import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { ErrorState } from '@/components/common/state-views';
import { ROLE_LABELS } from '@/components/layout/role-labels';
import { Panel } from '@/components/layout/page-header';
import { Stagger } from '@/components/motion/stagger';
import { assignableRoles, memberChangeRefusal } from '@/domain/staff/member-management';
import type { Distributor, Member, MemberRole } from '@/domain/tenancy/types';
import { type Actor, changeStaffMember } from '@/features/staff/staff-actions';
import { useStaff } from '@/features/staff/use-staff';
import { useLastReady } from '@/lib/use-last-ready';
import { MemberRow } from './member-row';
import { OWNERS_BY_FOUNDER } from './staff-copy';
import { useStaffWrite } from './use-staff-write';

type StaffMembersProps = {
  distributor: Distributor;
  actor: Actor;
  /** False on a read-only distributor: the list is shown without a single control. */
  canEdit: boolean;
  isOnline: boolean;
};

const SKELETON_ROWS = 3;

export function MembersSkeleton() {
  return (
    <LoadingRegion label="Cargando tu personal" className="flex flex-col divide-y">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex flex-col gap-2 py-4">
          <Bone className="h-5 w-48" />
          <Bone className="h-7 w-56 rounded-full" />
        </div>
      ))}
    </LoadingRegion>
  );
}

function Counts({ members }: { members: readonly Member[] }) {
  const active = members.filter((member) => member.active).length;
  return (
    <p className="text-sm font-semibold text-muted-foreground tabular-nums">
      {active} con acceso · {members.length - active} sin acceso
    </p>
  );
}

/**
 * Who works at the distributor (PLAN 3.2), active first and owners first. The owner changes the
 * role of the others or switches them off; what each row offers is what the rules accept
 * (`memberChangeRefusal`): nobody changes itself or the founder, and only the founder touches
 * another owner.
 */
export function StaffMembers({ distributor, actor, canEdit, isOnline }: StaffMembersProps) {
  const staff = useStaff(distributor.id);
  const { data: members, isRefreshing } = useLastReady(staff, distributor.id);
  const write = useStaffWrite(staff.reload);
  const founderUid = distributor.ownerUid;
  const isLocked = write.busy !== null || isRefreshing || !isOnline;

  const rolesFor = (member: Member): MemberRole[] => {
    const refusal = memberChangeRefusal({
      actorUid: actor.uid,
      founderUid,
      target: member,
      change: {},
    });
    return canEdit && refusal === null ? assignableRoles(actor.uid === founderUid) : [];
  };
  const change = (member: Member, key: 'role' | 'active', patch: object, done: string) =>
    write.run(
      `${member.uid}:${key}`,
      () => changeStaffMember(distributor.id, actor, member.uid, patch),
      done,
    );

  if (staff.status === 'error' && !members) {
    return (
      <ErrorState
        title="No pudimos cargar tu personal."
        description="Puede ser la conexión. Vuelve a intentar en un momento."
        onRetry={staff.reload}
        className="rounded-lg"
      />
    );
  }

  return (
    <Panel dense>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-bold">Personal</h2>
        {members && <Counts members={members} />}
      </div>
      {members ? (
        <Stagger className="flex flex-col divide-y">
          {members.map((member) => (
            <MemberRow
              key={member.uid}
              member={member}
              distributorName={distributor.name}
              isMe={member.uid === actor.uid}
              isFounder={member.uid === founderUid}
              roles={rolesFor(member)}
              isLocked={isLocked}
              busy={
                write.busy?.startsWith(`${member.uid}:`)
                  ? write.busy.endsWith('role')
                    ? 'role'
                    : 'active'
                  : null
              }
              note={
                member.role === 'owner' && member.uid !== actor.uid && member.uid !== founderUid
                  ? OWNERS_BY_FOUNDER
                  : undefined
              }
              onRole={(role) =>
                change(
                  member,
                  'role',
                  { role },
                  `${member.displayName} ahora tiene el rol ${ROLE_LABELS[role]}.`,
                )
              }
              onActive={(active) =>
                change(
                  member,
                  'active',
                  { active },
                  active
                    ? `${member.displayName} vuelve a entrar a ${distributor.name}.`
                    : `${member.displayName} ya no entra a ${distributor.name}.`,
                )
              }
            />
          ))}
        </Stagger>
      ) : (
        <MembersSkeleton />
      )}
    </Panel>
  );
}
