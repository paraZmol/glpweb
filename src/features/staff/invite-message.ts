import type { MemberRole } from '../../domain/tenancy/types';

const WHATSAPP_SHARE = 'https://wa.me/';

// How the person invited reads its job in the message (neutral wording, like the screens).
const ROLE_IN_MESSAGE: Record<MemberRole, string> = {
  owner: 'titular',
  dispatcher: 'parte de la central',
  driver: 'repartidor',
};

/** How the invitation names the job it offers: "te invita como repartidor". */
export function invitedRoleOf(role: MemberRole): string {
  return ROLE_IN_MESSAGE[role];
}

/** The text the owner sends with the link (PLAN 3.2). It names no one: the link says the rest. */
export function inviteMessageOf(distributorName: string, role: MemberRole, link: string): string {
  return `${distributorName} te invita a Hornilla como ${invitedRoleOf(role)}. Entra con tu cuenta de Google desde este enlace (sirve una sola vez): ${link}`;
}

/**
 * "Compartir por WhatsApp" without a number: WhatsApp asks whom to send it to. The message,
 * link included, goes to WhatsApp in the address: it is the channel the owner chose.
 */
export function whatsappShareHref(message: string): string {
  return `${WHATSAPP_SHARE}?text=${encodeURIComponent(message)}`;
}
