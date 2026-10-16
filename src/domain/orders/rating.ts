import { RATING_MAX, RATING_MIN } from './constants';
import type { Order } from './order';
import type { OrderActor } from './transitions';

export type RatingRefusal = 'notAllowed' | 'notDelivered' | 'alreadyRated' | 'invalidRating';

/**
 * Why the actor cannot rate the order, or null (glp-domain §6.9): only its customer, only once
 * it is delivered, only once, a whole number from 1 to 5. Not a change of status: the rating
 * is a field of the delivered order the rules let its customer write a single time.
 */
export function ratingRefusal(
  order: Pick<Order, 'status' | 'customerUid' | 'rating'>,
  actor: OrderActor,
  rating: number,
): RatingRefusal | null {
  const isItsCustomer = actor.role === 'customer' && order.customerUid === actor.uid;
  if (!isItsCustomer) return 'notAllowed';
  if (order.status !== 'delivered') return 'notDelivered';
  if (order.rating !== null) return 'alreadyRated';
  const isValid = Number.isInteger(rating) && rating >= RATING_MIN && rating <= RATING_MAX;
  return isValid ? null : 'invalidRating';
}
