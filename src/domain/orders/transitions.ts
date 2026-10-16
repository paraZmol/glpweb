import { MEMBER_ROLES } from '../tenancy/types';
import type { OrderStatus } from './status';

/**
 * Who may touch an order: the staff roles of the distributor, plus the customer who placed it.
 * The role comes from `members/{uid}` in the rules, never from the client; a platform admin
 * does not move orders.
 */
export const ORDER_ACTOR_ROLES = ['customer', ...MEMBER_ROLES] as const;
export type OrderActorRole = (typeof ORDER_ACTOR_ROLES)[number];

export interface OrderActor {
  uid: string;
  role: OrderActorRole;
}

/**
 * How the actor must stand towards the order for a role to count:
 * - `anyOrder`: any order of its distributor (the office);
 * - `ownOrder`: the customer who placed it (`customerUid`);
 * - `ownDelivery`: the driver carrying it (`driverUid`);
 * - `takesIt`: a driver that becomes its driver by accepting it.
 */
export type ActorRelation = 'anyOrder' | 'ownOrder' | 'ownDelivery' | 'takesIt';

export interface OrderTransition {
  from: OrderStatus;
  to: OrderStatus;
  by: Readonly<Partial<Record<OrderActorRole, ActorRelation>>>;
}

/** "La central" of glp-domain §1: the owner can do everything the dispatcher can (PLAN §3). */
const OFFICE = { owner: 'anyOrder', dispatcher: 'anyOrder' } as const;
const CARRYING_DRIVER = { driver: 'ownDelivery' } as const;

/**
 * Every allowed change of status and who makes it (glp-domain §1). A pair that is not here never
 * happens. firebase/firestore.rules holds the same table; its tests are generated from this one.
 * What each change additionally needs (a reason, a payment, a ready driver) is in `guards.ts`.
 */
export const ORDER_TRANSITIONS: readonly OrderTransition[] = [
  { from: 'pending', to: 'assigned', by: { ...OFFICE, driver: 'takesIt' } },
  { from: 'assigned', to: 'pending', by: OFFICE },
  // Reassignment in one write, so no other driver takes it in between (user, 2026-10-16).
  { from: 'assigned', to: 'assigned', by: OFFICE },
  { from: 'assigned', to: 'onTheWay', by: CARRYING_DRIVER },
  { from: 'onTheWay', to: 'arrived', by: CARRYING_DRIVER },
  { from: 'arrived', to: 'delivered', by: CARRYING_DRIVER },
  { from: 'pending', to: 'cancelled', by: { ...OFFICE, customer: 'ownOrder' } },
  { from: 'assigned', to: 'cancelled', by: OFFICE },
  { from: 'onTheWay', to: 'cancelled', by: OFFICE },
  { from: 'arrived', to: 'cancelled', by: OFFICE },
];

export function findTransition(from: OrderStatus, to: OrderStatus): OrderTransition | null {
  return ORDER_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

/** The parties of an order that decide whether a relation holds. */
export interface OrderParties {
  customerUid: string | null;
  driverUid: string | null;
}

export function holdsRelation(
  relation: ActorRelation,
  actor: OrderActor,
  order: OrderParties,
): boolean {
  switch (relation) {
    case 'anyOrder':
    case 'takesIt':
      return true;
    case 'ownOrder':
      return order.customerUid !== null && order.customerUid === actor.uid;
    case 'ownDelivery':
      return order.driverUid !== null && order.driverUid === actor.uid;
  }
}

/** Whether the role, and the actor's place in the order, allow this change (not its guards). */
export function mayMove(
  order: OrderParties & { status: OrderStatus },
  to: OrderStatus,
  actor: OrderActor,
): boolean {
  const relation = findTransition(order.status, to)?.by[actor.role];
  return relation !== undefined && holdsRelation(relation, actor, order);
}

/** The statuses the actor may move the order to, for the buttons of a screen. */
export function nextStatusesFor(
  order: OrderParties & { status: OrderStatus },
  actor: OrderActor,
): OrderStatus[] {
  return ORDER_TRANSITIONS.filter((t) => t.from === order.status)
    .map((t) => t.to)
    .filter((to) => mayMove(order, to, actor));
}
