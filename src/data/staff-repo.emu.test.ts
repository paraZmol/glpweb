// PLAN 3.2: invitations and the staff against the emulators, through the repository the screens
// use. The seed leaves one invitation of A waiting (SEED_INVITE_CODE), for any Google account.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SEED_DISTRIBUTORS, SEED_INVITE_CODE, SEED_USERS } from '../../tests/seed/data';
import { seedEmulators } from '../../tests/seed/seed';
import { signInAs, signInAsNewcomer } from '../../tests/support/emulated-session';
import { renameProfileAsAdmin } from '../../tests/support/emulator';
import {
  AlreadyMemberError,
  InviteNotFoundError,
  InviteRevokedError,
  InviteUsedError,
  MemberChangeNotAllowedError,
  UnreadableNameError,
} from '../domain/staff/errors';
import { type InviteRef, inviteStateOf } from '../domain/staff/invite';
import {
  NothingChangedError,
  PermissionDeniedError,
  ProfileRequiredError,
} from '../domain/tenancy/errors';
import { signOutSession } from './auth-repo';
import { listMyMemberships, updateDistributorProfile } from './distributors-repo';
import {
  acceptInvite,
  changeStaffMember,
  createInvite,
  getInvite,
  listPendingInvites,
  listStaff,
  revokeInvite,
} from './staff-repo';

const { a: A, b: B, c: SUSPENDED } = SEED_DISTRIBUTORS;
const SEEDED: InviteRef = { distributorId: A.id, code: SEED_INVITE_CODE };
const join = (session: { uid: string; email: string | null }, ref: InviteRef = SEEDED) =>
  acceptInvite({ ref, joiner: { uid: session.uid, email: session.email ?? '' }, now: new Date() });

beforeEach(async () => {
  await signOutSession();
  await seedEmulators();
});

afterAll(async () => {
  await signOutSession();
});

describe('creating and listing invitations', () => {
  it('lets the owner invite a driver and find it among those that wait', async () => {
    const owner = await signInAs(SEED_USERS.ownerA);

    const code = await createInvite({
      distributorId: A.id,
      invite: { role: 'dispatcher', email: null },
      createdBy: owner.uid,
    });

    const waiting = await listPendingInvites(A.id);
    expect(waiting.map((invite) => invite.id)).toEqual([code, SEED_INVITE_CODE]);
    expect(waiting[0]).toMatchObject({
      role: 'dispatcher',
      distributorName: A.name,
      // PLAN §11 (2026-10-15): who invites and the colour travel with the invitation.
      invitedByName: SEED_USERS.ownerA.displayName,
      brandColor: A.brandColor,
      status: 'pending',
      createdBy: owner.uid,
    });
    expect(waiting[0] && inviteStateOf(waiting[0], new Date())).toBe('usable');
  });

  it('refuses the dispatcher, and the owner of a suspended distributor', async () => {
    const dispatcher = await signInAs(SEED_USERS.dispatcherA);
    const invite = { role: 'driver', email: null } as const;
    await expect(
      createInvite({ distributorId: A.id, invite, createdBy: dispatcher.uid }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(listPendingInvites(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);

    const owner = await signInAs(SEED_USERS.ownerC);
    await expect(
      createInvite({ distributorId: SUSPENDED.id, invite, createdBy: owner.uid }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('lets whoever holds the link read the invitation, and nobody list them', async () => {
    await signInAs(SEED_USERS.customer);

    expect(await getInvite(SEEDED)).toMatchObject({ role: 'driver', distributorName: A.name });
    expect(await getInvite({ distributorId: A.id, code: 'NoSuchInvite00000000' })).toBeNull();
    expect(await getInvite({ distributorId: A.id, code: 'short' })).toBeNull();
    await expect(listPendingInvites(A.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

// PLAN §11 (2026-10-16): the address an owner typed is read only by that account and its owners,
// and using the invitation clears it.
describe('an invitation tied to an address', () => {
  it('is unreadable to another account, and loses the address once used', async () => {
    const owner = await signInAs(SEED_USERS.ownerA);
    const invite = { role: 'driver', email: SEED_USERS.customer.email } as const;
    const code = await createInvite({ distributorId: A.id, invite, createdBy: owner.uid });
    const ref = { distributorId: A.id, code };

    await signInAs(SEED_USERS.founder);
    expect(await getInvite(ref)).toBeNull();
    const customer = await signInAs(SEED_USERS.customer);
    expect(await getInvite(ref)).toMatchObject({ email: SEED_USERS.customer.email });
    await join(customer, ref);

    expect(await getInvite(ref)).toMatchObject({ status: 'accepted', email: null });
  });
});

describe('using an invitation', () => {
  it('makes a customer a driver of A, and the invitation is used', async () => {
    const customer = await signInAs(SEED_USERS.customer);

    expect(await join(customer)).toEqual({ distributorId: A.id, role: 'driver' });

    expect(await listMyMemberships(customer.uid)).toMatchObject([
      { distributorId: A.id, role: 'driver', active: true, distributorName: A.name },
    ]);
    expect(await getInvite(SEEDED)).toMatchObject({ status: 'accepted', acceptedBy: customer.uid });
  });

  it('works once: a second account is told it was used', async () => {
    await join(await signInAs(SEED_USERS.customer));

    const other = await signInAs(SEED_USERS.founder);
    await expect(join(other)).rejects.toBeInstanceOf(InviteUsedError);
  });

  // Two accounts at once need two app instances: that race is in invites.rules.test.ts.
  it('joins once when the same account sends the code twice at the same time', async () => {
    const customer = await signInAs(SEED_USERS.customer);

    const results = await Promise.allSettled([join(customer), join(customer)]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const refused = results.find((result) => result.status === 'rejected');
    expect(refused?.status === 'rejected' && refused.reason).toBeInstanceOf(AlreadyMemberError);
  });

  it('tells a member of A that it already works there', async () => {
    const driver = await signInAs(SEED_USERS.driverA);

    await expect(join(driver)).rejects.toEqual(new AlreadyMemberError(true));
  });

  it('asks for the terms first: an account without a profile cannot join', async () => {
    const newcomer = await signInAsNewcomer('recien@example.com');

    await expect(join(newcomer)).rejects.toBeInstanceOf(ProfileRequiredError);
  });

  // PLAN §11 (2026-10-15): the staff reads the name in its list.
  it('asks to change a stored name nobody can read before joining', async () => {
    const customer = await signInAs(SEED_USERS.customer);
    await renameProfileAsAdmin(customer.uid, '\u200b');

    await expect(join(customer)).rejects.toBeInstanceOf(UnreadableNameError);
  });

  // PLAN §11 (2026-10-16): it cannot even read it, so it is told what a missing one tells.
  it('refuses another account than the one an invitation names', async () => {
    const owner = await signInAs(SEED_USERS.ownerA);
    const code = await createInvite({
      distributorId: A.id,
      invite: { role: 'driver', email: 'alguien@example.com' },
      createdBy: owner.uid,
    });

    const customer = await signInAs(SEED_USERS.customer);
    await expect(join(customer, { distributorId: A.id, code })).rejects.toBeInstanceOf(
      InviteNotFoundError,
    );
  });

  it('refuses a code nobody created, and a code of A used for B', async () => {
    const customer = await signInAs(SEED_USERS.customer);

    await expect(
      join(customer, { distributorId: A.id, code: 'NoSuchInvite00000000' }),
    ).rejects.toBeInstanceOf(InviteNotFoundError);
    await expect(
      join(customer, { distributorId: B.id, code: SEED_INVITE_CODE }),
    ).rejects.toBeInstanceOf(InviteNotFoundError);
  });

  it('refuses a revoked invitation, and its owner cannot revoke it twice', async () => {
    const owner = await signInAs(SEED_USERS.ownerA);
    await revokeInvite(SEEDED, owner.uid);
    await expect(revokeInvite(SEEDED, owner.uid)).rejects.toBeInstanceOf(InviteRevokedError);
    expect(await listPendingInvites(A.id)).toEqual([]);

    const customer = await signInAs(SEED_USERS.customer);
    await expect(join(customer)).rejects.toBeInstanceOf(InviteRevokedError);
  });

  it('keeps a waiting invitation usable after the distributor is renamed', async () => {
    await signInAs(SEED_USERS.ownerA);
    await updateDistributorProfile(A.id, { name: 'Gas Demo Norte Nuevo' });
    expect((await getInvite(SEEDED))?.distributorName).toBe('Gas Demo Norte Nuevo');

    const customer = await signInAs(SEED_USERS.customer);
    await join(customer);
    expect(await listMyMemberships(customer.uid)).toMatchObject([
      { distributorName: 'Gas Demo Norte Nuevo' },
    ]);
  });
});

describe('managing the staff', () => {
  it('lists the staff to the owner, owner first', async () => {
    await signInAs(SEED_USERS.ownerA);

    const staff = await listStaff(A.id);

    expect(staff.map((member) => member.role)).toEqual(['owner', 'dispatcher', 'driver']);
  });

  it('lets the owner switch the driver off and on, and make it a dispatcher', async () => {
    const owner = await signInAs(SEED_USERS.ownerA);
    const change = (active: boolean) =>
      changeStaffMember({
        distributorId: A.id,
        actorUid: owner.uid,
        uid: SEED_USERS.driverA.uid,
        change: { active },
      });

    await change(false);
    expect((await listStaff(A.id)).at(-1)).toMatchObject({ role: 'driver', active: false });
    await change(true);
    await changeStaffMember({
      distributorId: A.id,
      actorUid: owner.uid,
      uid: SEED_USERS.driverA.uid,
      change: { role: 'dispatcher' },
    });

    const roles = (await listStaff(A.id)).map((member) => member.role);
    expect(roles).toEqual(['owner', 'dispatcher', 'dispatcher']);
  });

  it('refuses a change of itself and a change that changes nothing', async () => {
    const owner = await signInAs(SEED_USERS.ownerA);

    await expect(
      changeStaffMember({
        distributorId: A.id,
        actorUid: owner.uid,
        uid: owner.uid,
        change: { active: false },
      }),
    ).rejects.toEqual(new MemberChangeNotAllowedError('self'));
    await expect(
      changeStaffMember({
        distributorId: A.id,
        actorUid: owner.uid,
        uid: SEED_USERS.driverA.uid,
        change: { role: 'driver' },
      }),
    ).rejects.toBeInstanceOf(NothingChangedError);
  });

  // PLAN §11 (2026-10-16): an invitation works only while its author is an active owner, and
  // switching an owner off revokes the ones it left waiting, for good.
  it('revokes the waiting invitations of an owner it switches off, and keeps them revoked', async () => {
    const founder = await signInAs(SEED_USERS.ownerA);
    const ownerInvite = { role: 'owner', email: SEED_USERS.customer.email } as const;
    const ownerCode = await createInvite({
      distributorId: A.id,
      invite: ownerInvite,
      createdBy: founder.uid,
    });
    const coOwner = await signInAs(SEED_USERS.customer);
    await join(coOwner, { distributorId: A.id, code: ownerCode });
    const driverCode = await createInvite({
      distributorId: A.id,
      invite: { role: 'driver', email: null },
      createdBy: coOwner.uid,
    });
    const switchCoOwner = (active: boolean) =>
      changeStaffMember({
        distributorId: A.id,
        actorUid: founder.uid,
        uid: coOwner.uid,
        change: { active },
      });

    await signInAs(SEED_USERS.ownerA);
    await switchCoOwner(false);
    await switchCoOwner(true);

    const waiting = (await listPendingInvites(A.id)).map((invite) => invite.id);
    expect(waiting).toEqual([SEED_INVITE_CODE]);
    expect(await getInvite({ distributorId: A.id, code: driverCode })).toMatchObject({
      status: 'revoked',
      revokedBy: founder.uid,
    });
  });

  it('leaves the invitations alone when it switches off someone who is not an owner', async () => {
    const owner = await signInAs(SEED_USERS.ownerA);

    await changeStaffMember({
      distributorId: A.id,
      actorUid: owner.uid,
      uid: SEED_USERS.dispatcherA.uid,
      change: { active: false },
    });

    expect((await listPendingInvites(A.id)).map((invite) => invite.id)).toEqual([SEED_INVITE_CODE]);
  });

  it('refuses the dispatcher', async () => {
    const dispatcher = await signInAs(SEED_USERS.dispatcherA);

    await expect(
      changeStaffMember({
        distributorId: A.id,
        actorUid: dispatcher.uid,
        uid: SEED_USERS.driverA.uid,
        change: { active: false },
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
