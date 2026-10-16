import { Copy, MessageCircle } from 'lucide-react';
import type { MouseEvent } from 'react';
import { toast } from 'sonner';
import { Button, type ButtonVariant, buttonClassName } from '@/components/common/button';
import type { MemberRole } from '@/domain/tenancy/types';
import {
  canShareThroughDevice,
  inviteMessageOf,
  inviteShareDataOf,
  shareThroughDevice,
  whatsappShareHref,
} from '@/features/staff/invite-message';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

type InviteShareProps = {
  link: string;
  distributorName: string;
  role: MemberRole;
  /** The look of "Compartir por WhatsApp": the main action right after creating one. */
  emphasis?: ButtonVariant;
  size?: 'sm' | 'md';
  /** Read by screen readers after each button: which invitation. */
  which?: string;
  className?: string;
};

/**
 * The two ways to hand over an invitation (PLAN 3.2): copy the link, or share the message with
 * the link ready. Where the device has a share sheet it opens that one, so the link goes from the
 * phone straight to the app the owner picks (WhatsApp among them); elsewhere it opens WhatsApp
 * through its address, for the owner to choose the chat (PLAN §11, 2026-10-16). There is no
 * e-mail to send.
 */
export function InviteShare(props: InviteShareProps) {
  const { link, distributorName, role, emphasis = 'line', size = 'sm', which, className } = props;
  const copy = () => {
    navigator.clipboard.writeText(link).then(
      () => toast.success('Enlace copiado. Pégalo en el chat de la persona.'),
      () => toast.error('No pudimos copiarlo. Selecciónalo y cópialo a mano.'),
    );
  };
  const whatsapp = whatsappShareHref(inviteMessageOf(distributorName, role, link));
  const shareData = inviteShareDataOf(distributorName, role, link);
  const share = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!canShareThroughDevice(navigator, shareData)) return;
    event.preventDefault();
    void shareThroughDevice(navigator, shareData).then((outcome) => {
      if (outcome === 'failed')
        toast.error('No pudimos abrir el menú para compartir. Usa “Copiar enlace”.');
    });
  };
  const suffix = which ? <span className="sr-only"> {which}</span> : null;
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <a
        href={whatsapp}
        onClick={share}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClassName({ variant: emphasis, size })}
      >
        <MessageCircle aria-hidden="true" strokeWidth={ICON_STROKE} />
        Compartir por WhatsApp
        {suffix}
        <span className="sr-only"> (se abre en otra pestaña)</span>
      </a>
      <Button type="button" variant="line" size={size} onClick={copy}>
        <Copy aria-hidden="true" strokeWidth={ICON_STROKE} />
        Copiar enlace
        {suffix}
      </Button>
    </div>
  );
}
