import { Copy, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/common/button';
import { ICON_STROKE } from '@/lib/icons';
import { distributorPath } from '@/lib/routes';

function publicUrlOf(slug: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${distributorPath(slug)}`;
}

/** The link customers use, to open it or to copy it and share it. */
export function PublicLink({ slug }: { slug: string }) {
  const url = publicUrlOf(slug);
  const copy = () => {
    navigator.clipboard.writeText(url).then(
      () => toast.success('Enlace copiado.'),
      () => toast.error('No pudimos copiarlo. Selecciónalo y cópialo a mano.'),
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link
        to={distributorPath(slug)}
        className="inline-flex min-w-0 items-center gap-1.5 rounded-md font-semibold wrap-anywhere text-primary-text underline underline-offset-4"
      >
        <ExternalLink aria-hidden="true" className="size-4 shrink-0" strokeWidth={ICON_STROKE} />
        {url}
      </Link>
      <Button type="button" variant="line" size="sm" onClick={copy}>
        <Copy aria-hidden="true" strokeWidth={ICON_STROKE} />
        Copiar enlace
      </Button>
    </div>
  );
}
