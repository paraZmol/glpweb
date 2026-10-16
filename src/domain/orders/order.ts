import type { GeoPoint } from '../geo/distance';
import type { OrderLine } from './lines';
import type { Payment } from './payment';
import type { Cancellation } from './reasons';
import type { OrderStatus } from './status';

/** Where the order came from: the customer in the app, or the office taking a call. */
export const ORDER_ORIGINS = ['app', 'phone'] as const;
export type OrderOrigin = (typeof ORDER_ORIGINS)[number];

export interface DeliveryAddress {
  point: GeoPoint;
  /** The address as people read it. */
  line: string;
  /** "Portón azul, timbre 2"; null when none. */
  reference: string | null;
}

/**
 * `/distributors/{d}/orders/{id}` (PLAN §5.4). Lines, currency and total are frozen at creation
 * (glp-domain §6.4); each status change writes its timestamp and an entry of the log
 * (`/history`). A phone order may have no customer account: then `customerUid` is null and only
 * the name and phone the office typed identify the customer.
 */
export interface Order {
  id: string;
  status: OrderStatus;
  origin: OrderOrigin;
  customerUid: string | null;
  customerName: string;
  customerPhone: string;
  address: DeliveryAddress;
  lines: OrderLine[];
  /** The distributor's currency; every price of the order is in it. */
  currency: string;
  totalCents: number;
  /**
   * A phone order the office took outside the coverage circle ("Fuera de tu zona"). False when
   * the document has no such field.
   */
  outsideCoverage: boolean;
  /** Minutes promised when the order was made, to measure punctuality (`promisedMinutesFor`). */
  promisedMinutes: number;
  /** The driver carrying it; null while `pending` and after the office takes it back. */
  driverUid: string | null;
  /** Whoever created it: the customer, or the member of the office who took the call. */
  createdBy: string;
  createdAt: Date;
  assignedAt: Date | null;
  onTheWayAt: Date | null;
  arrivedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  /** Set when it is delivered, never before (glp-domain §6.3). */
  payment: Payment | null;
  cancellation: Cancellation | null;
  /** 1–5, by its customer, once, only after delivery. */
  rating: number | null;
}
