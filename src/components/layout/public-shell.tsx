import { Link } from 'react-router';
import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { PageTransition } from '@/components/motion/page-transition';
import { ROUTES } from '@/lib/routes';
import { PublicHeader } from './public-header';

const FOOTER_SYMBOL_PX = 28;
const LEGAL_LINKS = [
  { to: ROUTES.terms, label: 'Términos y condiciones' },
  { to: ROUTES.privacy, label: 'Política de privacidad' },
  { to: ROUTES.cookies, label: 'Cookies y almacenamiento' },
  { to: ROUTES.contact, label: 'Contacto y reclamos' },
  { to: ROUTES.forDistributors, label: 'Para distribuidoras' },
];

function PublicFooter() {
  return (
    <footer className="bg-band text-band-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          {/* On the band the crown uses the flame blue of the dark theme in both themes (§9.1). */}
          <span className="dark shrink-0">
            <HornillaLogo variant="symbol" size={FOOTER_SYMBOL_PX} />
          </span>
          <p className="text-sm text-band-foreground/80">
            Hornilla conecta a quien necesita gas con la distribuidora de su barrio. Hornilla no
            vende ni reparte gas.
          </p>
        </div>
        <nav aria-label="Pie de página">
          <ul className="flex flex-col gap-1 text-sm font-semibold sm:flex-row sm:flex-wrap sm:gap-x-6">
            {LEGAL_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

/** Frame of the public pages: header with the logo, the page, and the footer with legal links. */
export function PublicShell() {
  return (
    <div data-ambient="customer" className="flex flex-1 flex-col overflow-x-clip">
      <PublicHeader />
      <main id="contenido" className="flex flex-1 flex-col">
        <PageTransition className="flex flex-1 flex-col" />
      </main>
      <PublicFooter />
    </div>
  );
}
