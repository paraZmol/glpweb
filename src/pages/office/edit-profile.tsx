import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ButtonLink } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { EmptyState } from '@/components/common/state-views';
import { BrandPreview } from '@/components/founding/brand-preview';
import { PageHeader, Panel } from '@/components/layout/page-header';
import { useAccount } from '@/features/account/account-context';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { ProfileEditFormPanel } from './profile-edit-form';
import { isSuspended, SuspendedNotice } from './read-only-notice';

const SAVED = 'Guardamos los cambios de tu ficha.';
const SAVED_AND_IN_REVIEW =
  'Guardamos los cambios. Tu ficha volvió a revisión: Hornilla la mostrará cuando la apruebe.';

const BackToOffice = () => (
  <ButtonLink to={ROUTES.officeHome} variant="quiet" size="sm">
    <ArrowLeft aria-hidden="true" strokeWidth={ICON_STROKE} />
    Volver al monitor
  </ButtonLink>
);

function EditProfileSkeleton() {
  return (
    <LoadingRegion label="Cargando tu ficha" className="flex flex-col gap-6">
      <Bone className="h-8 w-56" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
        <Bone className="h-144 rounded-lg" />
        <Bone className="hidden h-72 rounded-lg lg:block" />
      </div>
    </LoadingRegion>
  );
}

/**
 * `/central/ficha` (PLAN 2.11): the owner edits what customers see of the distributor. Phone:
 * one column, with the sample of the brand under the colour. Desktop: the form on the left and
 * the live sample fixed on the right.
 */
export function EditProfilePage() {
  usePageTitle('Editar la ficha');
  const { current } = useAccount();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<{ name: string; brandColor: string } | null>(null);
  if (current.status !== 'ready') return <EditProfileSkeleton />;
  const { distributor, membership, isWritable } = current;

  const leave = (isBackInReview: boolean) => {
    toast.success(isBackInReview ? SAVED_AND_IN_REVIEW : SAVED);
    current.reload();
    void navigate(ROUTES.officeHome);
  };

  if (membership.role !== 'owner') {
    return (
      <Panel dense className="lg:max-w-2xl">
        <EmptyState
          title="La ficha la edita quien es titular."
          description="Si algo de la página pública está mal, avísale a la persona titular de tu distribuidora."
          action={<BackToOffice />}
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        dense
        title={isWritable ? 'Edita tu ficha.' : 'Tu ficha.'}
        lead={
          isWritable
            ? 'Lo que ven tus clientes en el buscador y en tu página. El enlace no se puede cambiar.'
            : 'Lo que ven tus clientes en el buscador y en tu página cuando tu distribuidora opera.'
        }
        aside={<BackToOffice />}
      />
      {!isWritable && (
        <InlineAlert tone="info">
          {isSuspended(distributor.status) ? (
            <SuspendedNotice />
          ) : (
            'Tu distribuidora está en solo lectura: no se pueden guardar cambios hasta regularizar el plan.'
          )}
        </InlineAlert>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:gap-8">
        <Panel dense>
          <ProfileEditFormPanel
            key={distributor.id}
            distributor={distributor}
            readOnly={!isWritable}
            onPreview={setPreview}
            onSaved={leave}
          />
        </Panel>
        <aside
          aria-label="Así se va a ver tu marca"
          className="sticky top-[calc(var(--top-inset)+1.5rem)] hidden rounded-lg bg-card p-7 shadow-card lg:block"
        >
          <h2 className="text-lg font-bold">Así se va a ver.</h2>
          <p className="mt-1 mb-4 text-muted-foreground">
            Tu nombre y tu color, de día y de noche, antes de guardar.
          </p>
          <BrandPreview
            color={preview?.brandColor ?? distributor.brandColor}
            name={preview?.name ?? distributor.name}
          />
        </aside>
      </div>
    </div>
  );
}
