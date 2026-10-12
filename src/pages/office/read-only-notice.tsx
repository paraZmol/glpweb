import { TextLink } from '@/components/common/text-link';
import { isSuspendedByPlatform } from '@/domain/tenancy/status';
import { ROUTES } from '@/lib/routes';

export const isSuspended = isSuspendedByPlatform;

/**
 * What a suspended distributor reads wherever its office says it is read-only: who decided it
 * and where to ask. Reviewed by `legal-compliance`: change it together with docs/legal. The link
 * takes the colour of the text around it, so it reads on any notice.
 */
export function SuspendedNotice() {
  return (
    <>
      Hornilla suspendió tu distribuidora: está en solo lectura y no aparece en el buscador ni en tu
      enlace. Para conocer el motivo o pedir que se revise, escribe a{' '}
      <TextLink to={ROUTES.contact} className="text-current">
        Contacto y reclamos
      </TextLink>
      .
    </>
  );
}
