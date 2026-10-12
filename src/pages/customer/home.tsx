import { Highlight } from '@/components/brand/highlight';
import { DistributorFinder } from '@/components/finder/distributor-finder';
import { LocationField } from '@/components/finder/location-field';
import { OwnersBand } from '@/components/finder/owners-band';
import { PageHeader } from '@/components/layout/page-header';
import { useAccount } from '@/features/account/account-context';
import { useDeliveryLocation } from '@/features/location/use-delivery-location';
import { greetingFor } from '@/lib/greeting';
import { usePageTitle } from '@/lib/page-title';

/**
 * Home of the customer (PLAN 2.6): the same search of the public home, inside the app frame
 * and greeting the person by name. Ordering arrives with phase 4.
 */
export function CustomerHomePage() {
  usePageTitle('Inicio');
  const { profile, role } = useAccount();
  const delivery = useDeliveryLocation();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={
          <>
            {greetingFor(profile?.displayName)} <Highlight>¿Quién te lleva el gas hoy?</Highlight>
          </>
        }
        lead="Dinos dónde estás y mira qué distribuidoras llegan hasta tu puerta."
      />
      <LocationField delivery={delivery} className="lg:max-w-xl" />
      <DistributorFinder point={delivery.location?.point ?? null} />
      {/* Whoever already works at a distributor does not need the invitation. */}
      {role === null && <OwnersBand />}
    </div>
  );
}
