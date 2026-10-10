import { BurnerRing } from '@/components/brand/burner-ring';
import { GasCylinder } from '@/components/brand/gas-cylinder';
import { Highlight } from '@/components/brand/highlight';
import { ButtonLink } from '@/components/common/button';
import { EmptyState } from '@/components/common/state-views';
import { PageHeader, Panel } from '@/components/layout/page-header';
import { Stagger } from '@/components/motion/stagger';
import { useAccount } from '@/features/account/account-context';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';

const EMPTY_CYLINDER_PX = 72;
const STEPS = [
  {
    title: 'Eliges',
    text: 'La distribuidora y la marca de gas que prefieras, con el precio a la vista.',
  },
  { title: 'Pides', text: 'Tu balón y tu dirección, en tres toques. Pagas al recibir.' },
  { title: 'Lo ves llegar', text: 'Sigues la moto en el mapa hasta tu puerta.' },
];

function firstNameOf(displayName: string | undefined): string {
  return displayName?.trim().split(/\s+/)[0] ?? '';
}

/**
 * Home of the customer. The search of nearby distributors arrives with step 2.6 of the plan;
 * until then this says so plainly and leaves the account ready for the first order.
 */
export function CustomerHomePage() {
  usePageTitle('Inicio');
  const { profile } = useAccount();
  const firstName = firstNameOf(profile?.displayName);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={
          <>
            {firstName ? `Hola, ${firstName}. ` : 'Hola. '}
            <Highlight>Tu gas, a un toque.</Highlight>
          </>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
        <Panel className="relative overflow-hidden">
          <BurnerRing thin className="-top-12 -right-12 size-40" />
          <EmptyState
            className="relative"
            symbol={<GasCylinder weightKg={10} tone="mono" height={EMPTY_CYLINDER_PX} />}
            title="Todavía no hay distribuidoras para pedir desde aquí."
            description="Estamos sumando las primeras de tu zona. Mientras tanto, deja tu celular en tu cuenta: es lo que la distribuidora usa para coordinar la entrega."
            action={
              <ButtonLink to={ROUTES.account} variant="primary">
                Completar mis datos
              </ButtonLink>
            }
          />
        </Panel>
        <section aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="text-xl font-bold">
            Así va a funcionar
          </h2>
          <Stagger as="ol" className="mt-4 flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex gap-4 rounded-xl bg-muted p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-heading text-lg font-extrabold text-primary-text tabular-nums">
                  {index + 1}
                </span>
                <p className="text-[0.9375rem] text-muted-foreground">
                  <strong className="block font-heading text-base text-foreground">
                    {step.title}
                  </strong>
                  {step.text}
                </p>
              </div>
            ))}
          </Stagger>
        </section>
      </div>
    </div>
  );
}
