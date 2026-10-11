/** Single source of Firestore and Realtime Database paths. See docs/PLAN.md §5.4. */
export const paths = {
  user: (uid: string) => `users/${uid}`,
  userAddresses: (uid: string) => `users/${uid}/addresses`,
  userAddress: (uid: string, slot: string) => `users/${uid}/addresses/${slot}`,
  platformAdmin: (uid: string) => `platformAdmins/${uid}`,
  slug: (slug: string) => `slugs/${slug}`,
  distributors: () => 'distributors',
  distributor: (d: string) => `distributors/${d}`,
  distributorControl: (d: string) => `distributors/${d}/private/control`,
  distributorPrivateSettings: (d: string) => `distributors/${d}/private/settings`,
  members: (d: string) => `distributors/${d}/members`,
  member: (d: string, uid: string) => `distributors/${d}/members/${uid}`,
  invites: (d: string) => `distributors/${d}/invites`,
  helpers: (d: string) => `distributors/${d}/helpers`,
  vehicles: (d: string) => `distributors/${d}/vehicles`,
  products: (d: string) => `distributors/${d}/products`,
  plantStock: (d: string) => `distributors/${d}/plantStock`,
  customers: (d: string) => `distributors/${d}/customers`,
  orders: (d: string) => `distributors/${d}/orders`,
  orderHistory: (d: string, orderId: string) => `distributors/${d}/orders/${orderId}/history`,
  shifts: (d: string) => `distributors/${d}/shifts`,
} as const;

/** Collection ids for collection-group queries. */
export const collectionGroups = {
  members: 'members',
  /** `private/control` and `private/settings` of every distributor. */
  private: 'private',
} as const;

export const realtimePaths = {
  driverLocation: (d: string, driverUid: string) => `locations/${d}/${driverUid}`,
  distributorLocations: (d: string) => `locations/${d}`,
  orderTracking: (orderId: string) => `orderTracking/${orderId}`,
  staff: (d: string, uid: string) => `staff/${d}/${uid}`,
} as const;
