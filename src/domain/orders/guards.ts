import type { OrderLine } from './lines';
import { cylindersByProduct } from './lines';
import type { Order } from './order';
import type { Payment, PaymentIssue } from './payment';
import { paymentIssue } from './payment';
import type { Cancellation, CancellationIssue } from './reasons';
import { cancellationIssue, isOrderNote } from './reasons';
import type { OrderStatus } from './status';
import type { OrderActor } from './transitions';
import { findTransition, mayMove } from './transitions';

/** What decides whether a driver can take an order, read by the caller in the same transaction. */
export interface DriverReadiness {
  /** Its shift is `approved`: not requested, paused, rejected or closed (phase 5). */
  shiftApproved: boolean;
  /** It carries an order in `WITH_DRIVER` (`arrived` included: glp-domain §6.7). */
  hasOrderWithDriver: boolean;
  /** Full cylinders it still carries, by product id (approved load − delivered lines). */
  fullByProduct: Readonly<Record<string, number>>;
}

/** The driver that gets a pending order: the one accepting it, or the one the office picks. */
export interface Assignee {
  uid: string;
  readiness: DriverReadiness;
}

export interface TransitionRequest {
  order: Pick<Order, 'status' | 'customerUid' | 'driverUid' | 'totalCents' | 'lines'>;
  to: OrderStatus;
  actor: OrderActor;
  /** The distributor accepts business writes (`isWritable` of tenancy). */
  writable: boolean;
  /** `pending → assigned` and `assigned → assigned` (reassignment). */
  assignee?: Assignee;
  /** `→ cancelled`. */
  cancellation?: Cancellation;
  /** `assigned → pending` and `assigned → assigned`: why the office moves the driver. */
  note?: string;
  /** `arrived → delivered`. */
  payment?: Payment;
}

export type AssignmentIssue =
  | 'driverRequired'
  /** A reassignment to the driver that already has it. */
  | 'sameDriver'
  | 'driverNotOnShift'
  | 'driverBusy'
  | 'notEnoughStock';

export type OrderRefusal =
  /**
   * The distributor is read-only: suspended, past due or with its trial over (§6.10). Except
   * for the customer cancelling its pending order.
   */
  | 'readOnly'
  /** That change of status is not in the table (glp-domain §6.2). */
  | 'notATransition'
  /** Not that role, or not its order (another customer's, another driver's). */
  | 'notAllowed'
  | 'noteRequired'
  | AssignmentIssue
  | CancellationIssue
  | PaymentIssue;

/** Products whose cylinders the driver lacks for the whole order (orders are never split). */
export function stockShortfall(
  lines: readonly Pick<OrderLine, 'productId' | 'quantity'>[],
  fullByProduct: Readonly<Record<string, number>>,
): string[] {
  return [...cylindersByProduct(lines)]
    .filter(([productId, needed]) => (fullByProduct[productId] ?? 0) < needed)
    .map(([productId]) => productId);
}

/** A change that moves the driver: a reassignment (`assigned → assigned`) or taking it off. */
export function isReassignment(request: Pick<TransitionRequest, 'order' | 'to'>): boolean {
  return request.order.status === 'assigned' && request.to === 'assigned';
}

const hasNote = (request: TransitionRequest) =>
  request.note !== undefined && isOrderNote(request.note);

function assignmentIssue(request: TransitionRequest): OrderRefusal | null {
  const { assignee, actor, order } = request;
  if (!assignee) return 'driverRequired';
  if (isReassignment(request)) {
    if (assignee.uid === order.driverUid) return 'sameDriver';
    if (!hasNote(request)) return 'noteRequired';
  }
  if (actor.role === 'driver' && assignee.uid !== actor.uid) return 'notAllowed';
  if (!assignee.readiness.shiftApproved) return 'driverNotOnShift';
  if (assignee.readiness.hasOrderWithDriver) return 'driverBusy';
  const short = stockShortfall(order.lines, assignee.readiness.fullByProduct);
  return short.length > 0 ? 'notEnoughStock' : null;
}

/** What the change needs besides the role: a ready driver, a note, a reason, a payment. */
function requirementIssue(request: TransitionRequest): OrderRefusal | null {
  const { order, to, actor } = request;
  if (to === 'assigned') return assignmentIssue(request);
  if (to === 'cancelled') return cancellationIssue(request.cancellation, actor.role === 'customer');
  if (to === 'delivered') return paymentIssue(request.payment, order.totalCents);
  if (to === 'pending') return hasNote(request) ? null : 'noteRequired';
  return null;
}

/**
 * The customer cancelling its pending order: the one change a read-only distributor still
 * accepts (decided by the user on 2026-10-16), so nobody is left with an order nobody serves.
 * Whether it is really its order is checked like any other change.
 */
export function isCustomerCancellation(request: Pick<TransitionRequest, 'order' | 'to' | 'actor'>) {
  return (
    request.order.status === 'pending' &&
    request.to === 'cancelled' &&
    request.actor.role === 'customer'
  );
}

/**
 * Why the actor cannot move the order to `to`, or null when it can (glp-domain §1). The rules
 * hold the same conditions; the repository runs this inside the transaction that reads the
 * order, so the status it checks is the one it writes over.
 */
export function transitionRefusal(request: TransitionRequest): OrderRefusal | null {
  if (!request.writable && !isCustomerCancellation(request)) return 'readOnly';
  if (!findTransition(request.order.status, request.to)) return 'notATransition';
  if (!mayMove(request.order, request.to, request.actor)) return 'notAllowed';
  return requirementIssue(request);
}
