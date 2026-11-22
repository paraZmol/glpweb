import { Copy, MessageCircle, Share2 } from 'lucide-react';
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
import { ROW_BUTTON } from './row-button';

type InviteShareProps = {
  link: string;
  distributorName: string;
  role: MemberRole;
  /** The look of the share button: the main action right after creating one. */
  emphasis?: ButtonVariant;
  size?: 'sm' | 'md';
  /** Read by screen readers after each button: which invitation. */
  which?: string;
  /** Under the share button, what happens when it is pressed. */
  withHint?: boolean;
  className?: string;
};

const WHATSAPP_HINT = 'Se abrirá WhatsApp: elige el chat de la persona y envía.';

/**
 * The two ways to hand over an invitation (PLAN 3.2): copy the link, or share the message with
 * the link ready. Where the device has a share sheet, "Compartir enlace" opens that one, so the
 * link goes from the phone straight to the app the owner picks (WhatsApp among them); elsewhere
 * "Compartir por WhatsApp" opens WhatsApp through its address, in another tab, for the owner to
 * choose the chat (PLAN §11, 2026-10-16). There is no e-mail to send.
 */
export function InviteShare(props: InviteShareProps) {
  const { link, distributorName, role, emphasis = 'line', size = 'sm', which } = props;
  const look = { variant: emphasis, size, className: size === 'sm' ? ROW_BUTTON : undefined };
  const shareData = inviteShareDataOf(distributorName, role, link);
  const hasShareSheet = canShareThroughDevice(navigator, shareData);
  const copy = () => {
    navigator.clipboard.writeText(link).then(
      () => toast.success('Enlace copiado. Pégalo en el chat de la persona.'),
      () => toast.error('No pudimos copiarlo. Selecciónalo y cópialo a mano.'),
    );
  };
  const share = () => {
    void shareThroughDevice(navigator, shareData).then((outcome) => {
      if (outcome === 'failed')
        toast.error('No pudimos abrir el menú para compartir. Usa “Copiar enlace”.');
    });
  };
  const suffix = which ? <span className="sr-only"> {which}</span> : null;
  return (
    <div className={cn('flex flex-wrap gap-2', props.className)}>
      {hasShareSheet ? (
        <Button type="button" data-share="" {...look} onClick={share}>
          <Share2 aria-hidden="true" strokeWidth={ICON_STROKE} />
          Compartir enlace
          {suffix}
        </Button>
      ) : (
        <a
          href={whatsappShareHref(inviteMessageOf(distributorName, role, link))}
          data-share=""
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName(look)}
        >
          <MessageCircle aria-hidden="true" strokeWidth={ICON_STROKE} />
          Compartir por WhatsApp
          {suffix}
          <span className="sr-only"> (abre WhatsApp en otra pestaña)</span>
        </a>
      )}
      {props.withHint && !hasShareSheet && (
        <p className="-mt-0.5 text-center text-sm text-muted-foreground">{WHATSAPP_HINT}</p>
      )}
      <Button type="button" variant="line" size={size} className={look.className} onClick={copy}>
        <Copy aria-hidden="true" strokeWidth={ICON_STROKE} />
        Copiar enlace
        {suffix}
      </Button>
    </div>
  );
}
