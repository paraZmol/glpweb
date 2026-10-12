import { MessageCircle, Phone } from 'lucide-react';
import { type ButtonVariant, buttonClassName } from '@/components/common/button';
import { formatPhone, telHref, whatsappHref } from '@/domain/tenancy/contact-links';
import type { PublicDistributor } from '@/domain/tenancy/types';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

const FIRST_MESSAGE = 'Hola. Los encontré en Hornilla y quiero pedir gas.';

type ContactActionsProps = {
  distributor: Pick<PublicDistributor, 'contactPhone' | 'whatsapp'>;
  /** Look of the WhatsApp button; the phone is always a line button. */
  emphasis?: ButtonVariant;
  className?: string;
};

/**
 * WhatsApp and phone of the business (PLAN 2.5). Both links are built from the validated
 * number, with the message encoded; a number that does not pass is not linked at all.
 */
export function ContactActions({ distributor, emphasis = 'line', className }: ContactActionsProps) {
  const whatsapp = whatsappHref(distributor.whatsapp, FIRST_MESSAGE);
  const phone = telHref(distributor.contactPhone);
  if (!whatsapp && !phone) return null;

  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName({ variant: emphasis, className: 'min-w-0 flex-1' })}
        >
          <MessageCircle aria-hidden="true" strokeWidth={ICON_STROKE} />
          WhatsApp
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      )}
      {phone && (
        <a
          href={phone}
          className={buttonClassName({ variant: 'line', className: 'min-w-0 flex-1' })}
        >
          <Phone aria-hidden="true" strokeWidth={ICON_STROKE} />
          <span className="sr-only">Llamar al </span>
          <span className="tabular-nums">{formatPhone(distributor.contactPhone)}</span>
        </a>
      )}
    </div>
  );
}
