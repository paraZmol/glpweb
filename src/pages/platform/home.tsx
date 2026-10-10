import { ButtonLink } from '@/components/common/button';
import { EmptyState } from '@/components/common/state-views';
import { PageHeader, Panel } from '@/components/layout/page-header';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';

/**
 * Home of the platform panel (super admin). The list of distributors arrives with phase 9.
 * Being here grants nothing: every admin action is checked again by the security rules.
 */
export function PlatformHomePage() {
  usePageTitle('Distribuidoras');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        dense
        title="Distribuidoras."
        lead="El estado y el plan de cada distribuidora de Hornilla."
      />
      <Panel dense className="lg:max-w-2xl">
        <EmptyState
          title="Todavía no hay nada que revisar."
          description="La lista de distribuidoras, con su prueba, su plan y la opción de suspender, va a vivir en este panel."
          action={
            <ButtonLink to={ROUTES.account} variant="ink" size="sm">
              Revisar mi cuenta
            </ButtonLink>
          }
        />
      </Panel>
    </div>
  );
}
