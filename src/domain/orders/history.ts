import { OrderTransitionError } from './errors';
import type { TransitionRequest } from './guards';
import { transitionRefusal } from './guards';
import type { Order } from './order';
import type { CancelReason } from './reasons';
import type { OrderStatus } from './status';
import { STATUS_TIMESTAMP } from './status';
import type { OrderActorRole } from './transitions';

/**
 * One entry of the log `/distributors/{d}/orders/{id}/history` (glp-domain §1): written in the
 * same transaction as the change it records, never edited or removed.
 */
export interface OrderLogEntry {
  /** Null for the entry that records the creation. */
  from: OrderStatus | null;
  to: OrderStatus;
  at: Date;
  byUid: string;
  byRole: OrderActorRole;
  /**
   * The driver concerned: the one that gets it (`assigned`), the one taken off (back to
   * `pending`) or the one carrying it; null when there is none.
   */
  driverUid: string | null;
  reason: CancelReason | null;
  note: string | null;
}

/** The fields of the order a change of status writes. Nothing else of the order moves. */
export type OrderPatch = Partial<
  Pick<
    Order,
    | 'status'
    | 'driverUid'
    | 'assignedAt'
    | 'onTheWayAt'
    | 'arrivedAt'
    | 'deliveredAt'
    | 'cancelledAt'
    | 'payment'
    | 'cancellation'
  >
>;

function patchFor(request: TransitionRequest, at: Date): OrderPatch {
  const { to } = request;
  if (to === 'pending') return { status: to, driverUid: null, assignedAt: null };
  const patch: OrderPatch = { status: to, [STATUS_TIMESTAMP[to]]: at };
  if (to === 'assigned') patch.driverUid = request.assignee?.uid ?? null;
  if (to === 'delivered') patch.payment = request.payment ?? null;
  if (to === 'cancelled') patch.cancellation = request.cancellation ?? null;
  return patch;
}

/** Only a cancellation and taking the driver off carry a note. */
function noteOf(request: TransitionRequest): string | null {
  if (request.to === 'cancelled') return request.cancellation?.note ?? null;
  return request.to === 'pending' ? (request.note ?? null) : null;
}

function entryFor(request: TransitionRequest, at: Date): OrderLogEntry {
  const { order, to, actor } = request;
  const isAssignment = to === 'assigned';
  return {
    from: order.status,
    to,
    at,
    byUid: actor.uid,
    byRole: actor.role,
    driverUid: isAssignment ? (request.assignee?.uid ?? null) : order.driverUid,
    reason: to === 'cancelled' ? (request.cancellation?.reason ?? null) : null,
    note: noteOf(request),
  };
}

/**
 * The write of a change of status: the order's patch and its log entry. Throws
 * `OrderTransitionError` when `transitionRefusal` refuses it; `at` is the time of the change
 * (the server's, in the repository).
 */
export function applyTransition(
  request: TransitionRequest,
  at: Date,
): { patch: OrderPatch; entry: OrderLogEntry } {
  const refusal = transitionRefusal(request);
  if (refusal) throw new OrderTransitionError(refusal);
  return { patch: patchFor(request, at), entry: entryFor(request, at) };
}

/** The first entry of the log, written with the order. */
export function creationEntry(
  order: Pick<Order, 'createdBy' | 'createdAt'>,
  byRole: OrderActorRole,
): OrderLogEntry {
  return {
    from: null,
    to: 'pending',
    at: order.createdAt,
    byUid: order.createdBy,
    byRole,
    driverUid: null,
    reason: null,
    note: null,
  };
}
