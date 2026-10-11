import { type LucideIcon, Mail, Store } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { Highlight } from '@/components/brand/highlight';
import { ButtonLink } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { TextLink } from '@/components/common/text-link';
import { platformContactEmail } from '@/features/legal/legal-documents';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';

type WayProps = {
  icon: LucideIcon;
  /** When this is the way to follow. */
  when: string;
  /** Who answers. */
  title: string;
  children: ReactNode;
};

function Way({ icon: Icon, when, title, children }: WayProps) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-5 shadow-card lg:p-7">
      <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary-text">
        <Icon aria-hidden="true" className="size-6" strokeWidth={ICON_STROKE} />
      </span>
      <div>
        <p className="text-[0.8125rem] font-bold text-muted-foreground">{when}</p>
        <h2 className="mt-1 text-2xl font-extrabold">{title}</h2>
      </div>
      <div className="flex flex-col gap-3 text-muted-foreground">{children}</div>
    </section>
  );
}

/** The address of the terms, or the plain statement that the channel is not open yet. */
function PlatformChannel({ email }: { email: string | null }) {
  if (email === null) {
    return (
      <InlineAlert tone="info">
        El correo de contacto de Hornilla todavía no está publicado. Se publicará aquí antes de
        abrir el servicio: Hornilla está en prueba y aún no atiende a personas reales.
      </InlineAlert>
    );
  }
  return (
    <a
      href={`mailto:${email}`}
      className="self-start rounded-md font-heading text-xl font-bold wrap-anywhere text-foreground underline underline-offset-4"
    >
      {email}
    </a>
  );
}

/**
 * `/contacto` (PLAN 2.9): the two ways to complain, as terms §8 states them. A problem with an
 * order, a price or a promotion belongs to the distributor; the platform answers for itself.
 */
export function ContactPage() {
  usePageTitle('Contacto y reclamos');
  const email = useMemo(() => platformContactEmail(), []);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-16 lg:px-8 lg:pt-10 lg:pb-24">
      <header className="max-w-3xl">
        <h1 className="text-[2.125rem] font-extrabold text-balance lg:text-[3.25rem]">
          Contacto y <Highlight>reclamos.</Highlight>
        </h1>
        <p className="mt-4 text-lg text-pretty text-muted-foreground lg:text-xl">
          Hornilla conecta a quien pide gas con la distribuidora que lo vende. Por eso hay dos
          caminos, según de qué se trate.
        </p>
      </header>
      <div className="mt-8 grid items-start gap-5 lg:mt-12 lg:grid-cols-2 lg:gap-8">
        <Way
          icon={Store}
          when="Por un pedido, un precio o una promoción"
          title="Ante la distribuidora."
        >
          <p>
            Ella vende el gas, fija sus precios, publica sus promociones y hace el reparto. El
            reclamo se le presenta a ella, que debe contar con su Libro de Reclamaciones.
          </p>
          <p>Su teléfono y su WhatsApp están en su página de Hornilla.</p>
          <ButtonLink to={ROUTES.home} variant="line" className="self-start">
            Buscar una distribuidora
          </ButtonLink>
        </Way>
        <Way icon={Mail} when="Por el funcionamiento de la plataforma" title="Ante Hornilla.">
          <p>
            Si la aplicación falla, si viste un precio o una promoción engañosos, si una
            distribuidora suplanta a otro negocio o publica datos falsos, o si quieres eliminar tu
            cuenta, cambiar tu correo o pedir una copia de tus datos. Para reportar una
            distribuidora, indica su nombre y su enlace.
          </p>
          <PlatformChannel email={email} />
          <p className="text-[0.9375rem]">
            El Libro de Reclamaciones virtual de Hornilla todavía no está disponible; lo estará
            antes de abrir al público.
          </p>
        </Way>
      </div>
      <p className="mt-8 max-w-3xl text-[0.9375rem] text-muted-foreground">
        Nada de esto te quita los derechos que la ley te da como consumidor. El detalle está en los{' '}
        <TextLink to={ROUTES.terms}>Términos y condiciones</TextLink> y en la{' '}
        <TextLink to={ROUTES.privacy}>Política de privacidad</TextLink>.
      </p>
    </div>
  );
}
