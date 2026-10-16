import type { Product } from '../catalog/product';
import type { GeoPoint } from '../geo/distance';
import { haversineKm, isWithinCoverage } from '../geo/distance';
import {
  DISPATCH_MINUTES,
  MAX_PHONE_ORDER_CYLINDERS,
  MIN_PROMISE_DISTANCE_KM,
  URBAN_SPEED_KMH,
} from './constants';
import type { LineRequest, LineRequestIssue } from './lines';
import { lineRequestsIssue } from './lines';
import type { OrderOrigin } from './order';
import type { OrderActorRole } from './transitions';

const MINUTES_PER_HOUR = 60;

/**
 * Who creates orders, and of which origin (glp-domain §1): the customer from the app, the owner
 * or the dispatcher taking a call. A driver creates none.
 */
export function originFor(role: OrderActorRole): OrderOrigin | null {
  if (role === 'customer') return 'app';
  return role === 'owner' || role === 'dispatcher' ? 'phone' : null;
}

/**
 * Cylinders an order may carry: the distributor's `maxCylindersPerOrder` for a customer; the
 * office may go over it on the phone (a business served by the truck) up to the sanity cap.
 */
export function cylinderLimitFor(origin: OrderOrigin, maxCylindersPerOrder: number): number {
  return origin === 'app' ? maxCylindersPerOrder : MAX_PHONE_ORDER_CYLINDERS;
}

export interface CreationRequest {
  role: OrderActorRole;
  /** The distributor accepts business writes (`isWritable` of tenancy). */
  writable: boolean;
  /** Writable and approved for the public: what a customer's order needs. */
  acceptingOrders: boolean;
  maxCylindersPerOrder: number;
  lines: readonly LineRequest[];
  products: readonly Product[];
  /** The customer already has an order in `ALIVE` with this distributor (app orders only). */
  hasAliveOrder: boolean;
  plant: GeoPoint;
  coverageRadiusKm: number;
  destination: GeoPoint;
}

export type CreationRefusal =
  | 'notAllowed'
  | 'readOnly'
  | 'notAcceptingOrders'
  | 'aliveOrderExists'
  | 'outOfCoverage'
  | LineRequestIssue;

function customerRefusal(request: CreationRequest): CreationRefusal | null {
  if (!request.acceptingOrders) return 'notAcceptingOrders';
  if (request.hasAliveOrder) return 'aliveOrderExists';
  const { plant, destination, coverageRadiusKm } = request;
  return isWithinCoverage(plant, destination, coverageRadiusKm) ? null : 'outOfCoverage';
}

/**
 * Why the order cannot be created, or null (glp-domain §1, PLAN 4.2 and 4.4). Prices are not
 * checked here: they come from `freezeLines`. A phone order needs neither an account nor the
 * coverage circle: the office decides whether it goes (PLAN §11, 2026-10-16, to confirm).
 */
export function creationRefusal(request: CreationRequest): CreationRefusal | null {
  const origin = originFor(request.role);
  if (!origin) return 'notAllowed';
  if (!request.writable) return 'readOnly';
  const refusal = origin === 'app' ? customerRefusal(request) : null;
  if (refusal) return refusal;
  const limit = cylinderLimitFor(origin, request.maxCylindersPerOrder);
  return lineRequestsIssue(request.lines, request.products, limit);
}

/**
 * Minutes promised to the customer (glp-domain §1): the distance from the plant, never under
 * `MIN_PROMISE_DISTANCE_KM`, at `URBAN_SPEED_KMH`, plus `DISPATCH_MINUTES`; rounded up.
 */
export function promisedMinutesFor(plant: GeoPoint, destination: GeoPoint): number {
  const distanceKm = Math.max(haversineKm(plant, destination), MIN_PROMISE_DISTANCE_KM);
  return Math.ceil((distanceKm * MINUTES_PER_HOUR) / URBAN_SPEED_KMH) + DISPATCH_MINUTES;
}
