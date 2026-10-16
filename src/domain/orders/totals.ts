import type { OrderLine } from './lines';

/** Money and cylinders of an order, all in integer cents and whole units. */
export interface OrderTotals {
  /** What the customer pays at the door; frozen at creation. */
  totalCents: number;
  /** The same lines at list price, for "antes" (only ever the real list price). */
  listTotalCents: number;
  discountCents: number;
  cylinders: number;
  /** Empty cylinders the driver collects: one per refill unit, none for a full one (§6.13). */
  expectedEmpties: number;
}

function whole(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Money and units must be integers, got ${value}`);
  }
  return value;
}

/** Every amount and quantity of the line, checked one by one: 0.5 × 2 is not money. */
function lineAmounts(line: OrderLine) {
  const quantity = whole(line.quantity);
  return {
    quantity,
    paid: whole(whole(line.unitPriceCents) * quantity),
    list: whole(whole(line.listPriceCents) * quantity),
    discount: whole(line.discountCents),
  };
}

/** Totals of the frozen lines. Throws on anything that is not integer money: never a float. */
export function orderTotals(lines: readonly OrderLine[]): OrderTotals {
  return lines.reduce<OrderTotals>(
    (totals, line) => {
      const amounts = lineAmounts(line);
      return {
        totalCents: whole(totals.totalCents + amounts.paid),
        listTotalCents: whole(totals.listTotalCents + amounts.list),
        discountCents: whole(totals.discountCents + amounts.discount),
        cylinders: totals.cylinders + amounts.quantity,
        expectedEmpties:
          totals.expectedEmpties + (line.saleMode === 'refill' ? amounts.quantity : 0),
      };
    },
    { totalCents: 0, listTotalCents: 0, discountCents: 0, cylinders: 0, expectedEmpties: 0 },
  );
}

/** Empty cylinders the customer must have ready, by weight ("2 balones vacíos de 10 kg"). */
export function expectedEmptiesByWeight(lines: readonly OrderLine[]): Map<number, number> {
  const byWeight = new Map<number, number>();
  for (const line of lines) {
    if (line.saleMode !== 'refill') continue;
    byWeight.set(line.weightKg, (byWeight.get(line.weightKg) ?? 0) + line.quantity);
  }
  return byWeight;
}
