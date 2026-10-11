import { LogOut } from 'lucide-react';
import { Button } from '@/components/common/button';
import { EmptyState } from '@/components/common/state-views';
import { TextLink } from '@/components/common/text-link';
import { workAreasOf } from '@/components/layout/nav-items';
import { PageHeader, Panel } from '@/components/layout/page-header';
import { Stagger } from '@/components/motion/stagger';
import { useAccount } from '@/features/account/account-context';
import { useSignOut } from '@/features/account/use-sign-out';
import { foundingAvailabilityOf } from '@/features/tenancy/founding-availability';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { OwnersPanel } from './owners-panel';
import { ProfileForm } from './profile-form';
import { WorkAreas } from './work-areas';

function SessionPanel({ email }: { email: string | null }) {
  const { signOut, isSigningOut } = useSignOut();
  return (
    <Panel>
      <h2 className="text-xl font-bold">Sesión</h2>
      <p className="mt-1.5 text-muted-foreground">
        Ingresaste como <strong className="wrap-anywhere text-foreground">{email}</strong>. Para
        volver a entrar vas a necesitar ese correo.
      </p>
      <Button
        variant="line"
        className="mt-5"
        loading={isSigningOut}
        loadingLabel="Cerrando sesión…"
        onClick={signOut}
      >
        <LogOut aria-hidden="true" strokeWidth={ICON_STROKE} />
        Cerrar sesión
      </Button>
      <p className="mt-3 text-sm text-muted-foreground">
        Al cerrar sesión se borran de este dispositivo tu sesión, la copia de tus datos y el último
        punto desde el que buscaste.
      </p>
      <p className="mt-4 border-t pt-4 text-[0.9375rem]">
        <TextLink to={ROUTES.contact}>Contacto y reclamos</TextLink>
      </p>
    </Panel>
  );
}

/** "Mi cuenta" (PLAN 2.1): see and edit name and phone, reach the work areas, sign out. */
export function AccountPage() {
  usePageTitle('Tu cuenta');
  const account = useAccount();
  const { session, profile } = account;
  const availability = foundingAvailabilityOf({
    uid: session.uid,
    profile,
    current: account.current,
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Tu cuenta."
        lead="Tus datos son los que ve la distribuidora cuando le haces un pedido."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
        <Panel>
          {profile ? (
            <ProfileForm
              uid={session.uid}
              profile={profile}
              email={session.email}
              onSaved={account.reloadProfile}
            />
          ) : (
            <EmptyState
              title="Tu perfil todavía no está listo."
              description="Vuelve a intentar en un momento."
              action={
                <Button variant="ink" onClick={account.reloadProfile}>
                  Reintentar
                </Button>
              }
            />
          )}
        </Panel>
        <Stagger className="flex flex-col gap-5">
          {workAreasOf(account).length > 0 && (
            <WorkAreas role={account.role} isPlatformAdmin={account.isPlatformAdmin} />
          )}
          <OwnersPanel availability={availability} />
          <SessionPanel email={session.email} />
        </Stagger>
      </div>
    </div>
  );
}
