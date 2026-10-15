import { useId } from 'react';
import { CHIP_CLASS } from '@/components/catalog/weight-choice';
import { ROLE_DUTIES, ROLE_LABELS } from '@/components/layout/role-labels';
import type { MemberRole } from '@/domain/tenancy/types';
import { cn } from '@/lib/utils';

type RoleChoiceProps = {
  label: string;
  /** What the account may offer (`assignableRoles`). */
  roles: readonly MemberRole[];
  value: MemberRole;
  onChange: (role: MemberRole) => void;
  /** Cards with what each role does (inviting); plain chips in a row of the list. */
  withDuties?: boolean;
};

const CARD_CLASS = [
  'press flex flex-col items-start gap-0.5 rounded-lg p-3.5 text-left motion-instant',
  'inset-ring-[1.5px] inset-ring-input hover:bg-muted',
  'aria-checked:bg-primary-soft aria-checked:inset-ring-2 aria-checked:inset-ring-primary-text',
].join(' ');

/** The role of a person of the staff (PLAN 3.2): never a drop-down, the choices in sight. */
export function RoleChoice({ label, roles, value, onChange, withDuties = false }: RoleChoiceProps) {
  const labelId = useId();
  return (
    <div>
      <p id={labelId} className="mb-1.5 text-[0.9375rem] font-semibold">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={cn('flex gap-2', withDuties ? 'flex-col' : 'flex-wrap')}
      >
        {roles.map((role) => (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={value === role}
            onClick={() => onChange(role)}
            className={withDuties ? CARD_CLASS : CHIP_CLASS}
          >
            {withDuties ? (
              <>
                <span className="font-heading text-base font-bold">{ROLE_LABELS[role]}</span>
                <span className="text-sm text-muted-foreground">{ROLE_DUTIES[role]}</span>
              </>
            ) : (
              ROLE_LABELS[role]
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
