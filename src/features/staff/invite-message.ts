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

/** What the message says before the link. It names no one: the link says the rest. */
function inviteIntroOf(distributorName: string, role: MemberRole): string {
  return `${distributorName} te invita a Hornilla como ${invitedRoleOf(role)}. Entra con tu cuenta de Google desde este enlace (sirve una sola vez):`;
}

/** The text the owner sends with the link (PLAN 3.2), the link at its end. */
export function inviteMessageOf(distributorName: string, role: MemberRole, link: string): string {
  return `${inviteIntroOf(distributorName, role)} ${link}`;
}

/** The same message for the share sheet of the device: the text, and the link apart. */
export function inviteShareDataOf(
  distributorName: string,
  role: MemberRole,
  link: string,
): ShareData {
  return { text: inviteIntroOf(distributorName, role), url: link };
}

/**
 * "Compartir por WhatsApp" without a number: WhatsApp asks whom to send it to. The message,
 * link included, goes to WhatsApp in the address: it is the channel the owner chose. Used when
 * the device has no share sheet of its own (`shareThroughDevice`).
 */
export function whatsappShareHref(message: string): string {
  return `${WHATSAPP_SHARE}?text=${encodeURIComponent(message)}`;
}

/** How a try at the share sheet of the device ended. */
export type DeviceShareOutcome = 'shared' | 'cancelled' | 'failed';

/** The part of `navigator` the share sheet needs. */
export type DeviceShare = Partial<Pick<Navigator, 'share' | 'canShare'>>;

/**
 * Whether the device offers its own share sheet for this message. Then the link goes from the
 * phone straight to the app the owner picks there (WhatsApp, SMS, e-mail…), with no address of
 * a third party in between (PLAN §11, 2026-10-16). Otherwise: `whatsappShareHref`.
 */
export function canShareThroughDevice(device: DeviceShare, data: ShareData): boolean {
  if (typeof device.share !== 'function') return false;
  return typeof device.canShare !== 'function' || device.canShare(data);
}

/** Opens the share sheet. Closing it without sending is `cancelled`, not a failure. */
export async function shareThroughDevice(
  device: DeviceShare,
  data: ShareData,
): Promise<DeviceShareOutcome> {
  if (!canShareThroughDevice(device, data)) return 'failed';
  try {
    await device.share?.(data);
    return 'shared';
  } catch (error) {
    return error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
