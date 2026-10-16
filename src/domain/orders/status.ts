/**
 * The statuses of an order (glp-domain §1). This is the only place the list exists: rules tests,
 * repositories and screens import it; nobody writes `'assigned'` by hand. In GLP-DEV the list was
 * repeated in five files and a forgotten `arrived` assigned two orders to one driver.
 *
 * `pending → assigned → onTheWay → arrived → delivered`, and `cancelled`.
 */
export const ORDER_STATUSES = [
  'pending',
  'assigned',
  'onTheWay',
  'arrived',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** A driver is carrying it: the driver is not free while one of its orders is in here. */
export const WITH_DRIVER = [
  'assigned',
  'onTheWay',
  'arrived',
] as const satisfies readonly OrderStatus[];

/** Still in progress: a customer keeps at most one of these per distributor. */
export const ALIVE = ['pending', ...WITH_DRIVER] as const satisfies readonly OrderStatus[];

/** Nothing moves an order out of these. */
export const FINAL = ['delivered', 'cancelled'] as const satisfies readonly OrderStatus[];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (ORDER_STATUSES as readonly unknown[]).includes(value);
}

export function isWithDriver(status: OrderStatus): boolean {
  return (WITH_DRIVER as readonly OrderStatus[]).includes(status);
}

export function isAlive(status: OrderStatus): boolean {
  return (ALIVE as readonly OrderStatus[]).includes(status);
}

export function isFinal(status: OrderStatus): boolean {
  return (FINAL as readonly OrderStatus[]).includes(status);
}

/**
 * The timestamp a transition writes when the order enters that status. Going back to `pending`
 * (the office takes the driver off) writes none: `createdAt` never changes.
 */
export const STATUS_TIMESTAMP = {
  assigned: 'assignedAt',
  onTheWay: 'onTheWayAt',
  arrived: 'arrivedAt',
  delivered: 'deliveredAt',
  cancelled: 'cancelledAt',
} as const satisfies Record<Exclude<OrderStatus, 'pending'>, string>;

export type StatusTimestampField = (typeof STATUS_TIMESTAMP)[keyof typeof STATUS_TIMESTAMP];
