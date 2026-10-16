/** Single source of Firestore and Realtime Database paths. See docs/PLAN.md §5.4. */
export const paths = {
  user: (uid: string) => `users/${uid}`,
  userAddresses: (uid: string) => `users/${uid}/addresses`,
  userAddress: (uid: string, slot: string) => `users/${uid}/addresses/${slot}`,
  userAcceptances: (uid: string) => `users/${uid}/acceptances`,
  userAcceptance: (uid: string, entryId: string) => `users/${uid}/acceptances/${entryId}`,
  platformAdmin: (uid: string) => `platformAdmins/${uid}`,
  slug: (slug: string) => `slugs/${slug}`,
  distributors: () => 'distributors',
  distributor: (d: string) => `distributors/${d}`,
  distributorControl: (d: string) => `distributors/${d}/private/control`,
  distributorPrivateSettings: (d: string) => `distributors/${d}/private/settings`,
  /** The text of the platform's note: the founder and platform admins only (PLAN 3.2). */
  distributorReview: (d: string) => `distributors/${d}/private/review`,
  members: (d: string) => `distributors/${d}/members`,
  member: (d: string, uid: string) => `distributors/${d}/members/${uid}`,
  invites: (d: string) => `distributors/${d}/invites`,
  /** `code` is the secret of the link: 20 letters and digits (`isInviteCode`). */
  invite: (d: string, code: string) => `distributors/${d}/invites/${code}`,
  helpers: (d: string) => `distributors/${d}/helpers`,
  /** `slot` is `h00` … `h29` (HELPER_SLOT_IDS in src/domain/staff/helper.ts). */
  helper: (d: string, slot: string) => `distributors/${d}/helpers/${slot}`,
  vehicles: (d: string) => `distributors/${d}/vehicles`,
  products: (d: string) => `distributors/${d}/products`,
  /** `slot` is `p00` … `p29` (PRODUCT_SLOT_IDS in src/domain/catalog/catalog.ts). */
  product: (d: string, slot: string) => `distributors/${d}/products/${slot}`,
  promotions: (d: string) => `distributors/${d}/promotions`,
  /** `slot` is `o00` … `o19` (PROMOTION_SLOT_IDS in src/domain/pricing/promotion.ts). */
  promotion: (d: string, slot: string) => `distributors/${d}/promotions/${slot}`,
  plantStock: (d: string) => `distributors/${d}/plantStock`,
  customers: (d: string) => `distributors/${d}/customers`,
  orders: (d: string) => `distributors/${d}/orders`,
  orderHistory: (d: string, orderId: string) => `distributors/${d}/orders/${orderId}/history`,
  shifts: (d: string) => `distributors/${d}/shifts`,
} as const;

/** Collection ids for collection-group queries. */
export const collectionGroups = {
  members: 'members',
  /** `private/control`, `private/settings` and `private/review` of every distributor. */
  private: 'private',
} as const;

export const realtimePaths = {
  driverLocation: (d: string, driverUid: string) => `locations/${d}/${driverUid}`,
  distributorLocations: (d: string) => `locations/${d}`,
  orderTracking: (orderId: string) => `orderTracking/${orderId}`,
  staff: (d: string, uid: string) => `staff/${d}/${uid}`,
} as const;
