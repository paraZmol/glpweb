import { useState } from 'react';
import { Button } from '@/components/common/button';
import { ConfirmPanel } from '@/components/common/confirm-panel';
import { ROLE_LABELS } from '@/components/layout/role-labels';
import type { Member, MemberRole } from '@/domain/tenancy/types';
import { RoleChoice } from './role-choice';
import { ROW_BUTTON } from './row-button';
import { ROLE_CHANGE_REACH } from './staff-copy';

type EditProps = {
  member: Member;
  isLocked: boolean;
  isBusy: boolean;
  onCancel: () => void;
};

/** Changing the role of one person: the choices in sight, saved with one button. */
export function RoleEditor({
  member,
  roles,
  isLocked,
  isBusy,
  onCancel,
  onSave,
}: EditProps & { roles: readonly MemberRole[]; onSave: (role: MemberRole) => void }) {
  const [role, setRole] = useState(member.role);
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted p-4 lg:min-w-96">
      <RoleChoice
        label={`Rol de ${member.displayName}`}
        roles={roles}
        value={role}
        onChange={setRole}
      />
      {role === 'owner' && member.role !== 'owner' && (
        <p className="text-sm text-muted-foreground">
          Un titular puede casi todo, como tú: personal, precios y la ficha.
        </p>
      )}
      {/* What the panels do (PLAN 2.11): /central and /reparto follow the member document live,
          and any other screen reads it again on the way into a panel. */}
      <p className="text-sm text-muted-foreground">{ROLE_CHANGE_REACH}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="line" size="sm" className={ROW_BUTTON} onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="ink"
          size="sm"
          className={ROW_BUTTON}
          disabled={role === member.role || (isLocked && !isBusy)}
          loading={isBusy}
          loadingLabel="Guardando el rol…"
          onClick={() => onSave(role)}
        >
          Guardar rol
        </Button>
      </div>
    </div>
  );
}

/** The question before switching a person off or back on (ui-system §8, `ConfirmPanel`). */
export function ActiveConfirm({
  member,
  distributorName,
  isLocked,
  isBusy,
  onCancel,
  onConfirm,
}: EditProps & { distributorName: string; onConfirm: () => void }) {
  const name = member.displayName;
  return (
    <ConfirmPanel
      className="lg:max-w-md"
      title={member.active ? `¿Desactivar a ${name}?` : `¿Reactivar a ${name}?`}
      actions={
        <>
          <Button type="button" variant="line" size="sm" className={ROW_BUTTON} onClick={onCancel}>
            Volver
          </Button>
          <Button
            type="button"
            variant="ink"
            size="sm"
            className={ROW_BUTTON}
            disabled={isLocked && !isBusy}
            loading={isBusy}
            loadingLabel="Guardando…"
            onClick={onConfirm}
          >
            {member.active ? 'Sí, desactivar' : 'Sí, reactivar'}
          </Button>
        </>
      }
    >
      <p className="mt-1 text-muted-foreground">
        {member.active
          ? `Deja de entrar a ${distributorName} al momento, también si tiene la app abierta. Lo que hizo queda a su nombre y puedes reactivar su acceso cuando quieras.`
          : `Vuelve a entrar a ${distributorName} como ${ROLE_LABELS[member.role]} desde ahora.`}
      </p>
    </ConfirmPanel>
  );
}
