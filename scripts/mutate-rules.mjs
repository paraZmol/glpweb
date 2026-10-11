// Mutation test of firebase/firestore.rules: breaks one condition at a time and checks that some
// rules test notices. A mutant that survives is a condition no test defends.
//
//   npm run test:mutation                      every mutant (well over an hour: run it before a
//                                              release of the rules, not in `npm run check`)
//   MUTANTS=H01,D12 npm run test:mutation      only those
//   MUTATION_WORKERS=2 npm run test:mutation   fewer copies in parallel (3 by default)
//   MUTATION_FILES=users,members npm run …     only the test files whose name contains one of them
//
// Do not edit the rules tests while it runs: every mutant runs the files as they are on disk.
//
// It never touches firebase/firestore.rules: each worker tests a broken copy in the temp folder
// (RULES_FILE) inside emulator projects of its own (RULES_PROJECT_PREFIX); see
// firebase/tests/helpers.ts. Runs through scripts/emulators.mjs like every emulator command, so
// the lane comes from E2E_LANE. Exits with 1 when a mutant survives or a mutant no longer applies
// (the rule it breaks was rewritten: update the list).
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RULES = 'firebase/firestore.rules';
const TESTS_DIR = 'firebase/tests';
const DEFAULT_WORKERS = 3;

const DOCS = '/databases/$(database)/documents';
/** [id, what the broken rule would allow, text to find (exactly once), replacement]. */
const MUTANTS = [
  ['H01', 'hasRole ignores active', 'member(d).active == true && ', ''],
  ['H02', 'hasRole ignores the role', 'member(d).role in roles', 'true'],
  [
    'H03',
    'platform admin from a token claim',
    `exists(${DOCS}/platformAdmins/$(request.auth.uid))`,
    'request.auth.token.platformAdmin == true',
  ],
  ['H04', 'emailVerified always true', 'request.auth.token.email_verified == true', 'true'],
  ['H05', 'trial never expires', 'control.trialEndsAt > request.time', 'true'],
  [
    'H06',
    'pastDue is writable',
    "control.status == 'active'",
    "control.status in ['active', 'pastDue']",
  ],
  [
    'H07',
    'foundedNow ignores the founder',
    'control.ownerUid == request.auth.uid && control',
    'control',
  ],
  ['H08', 'foundedNow ignores request.time', ' && control.createdAt == request.time', ''],
  ['H09', 'phone without end anchor', "'^9[0-9]{8}$'", "'^9[0-9]{8}'"],
  [
    'H10',
    'geo point accepts extra keys',
    "hasExactly(point, ['lat', 'lng'])",
    "point.keys().hasAll(['lat', 'lng'])",
  ],
  ['H11', 'isDocId accepts any string', " && value.matches('^[A-Za-z0-9_-]{1,64}$')", ''],
  ['H12', 'slug without end anchor', "'^[a-z0-9]+(-[a-z0-9]+)*$'", "'^[a-z0-9]+(-[a-z0-9]+)*'"],
  ['H13', 'any version accepted', 'acceptance.version in versions', 'acceptance.version is string'],
  [
    'H14',
    'acceptance accepts extra keys',
    "hasExactly(acceptance, ['version', 'acceptedAt'])",
    "acceptance.keys().hasAll(['version', 'acceptedAt'])",
  ],
  [
    'H15',
    'text may end in white space',
    "\n        && !value.matches('(?s).*[\\\\s\\\\x0b\\\\pZ\\\\x{feff}]$')",
    '',
  ],
  [
    'H16',
    'text may start with white space',
    "\n        && !value.matches('(?s)^[\\\\s\\\\x0b\\\\pZ\\\\x{feff}].*')",
    '',
  ],
  [
    'H17',
    'schedule days may repeat',
    '\n        && schedule.days.toSet().size() == schedule.days.size()',
    '',
  ],
  ['H18', 'eighth brand unchecked', ' && isBrandAt(brands, 7)', ''],
  ['H19', 'no cap on owned distributors', ' && data.ownedDistributorIds.size() <= 3', ''],
  ['H20', 'text has no upper bound', ' && value.size() <= max', ''],
  ['H21', 'time of day without end anchor', "[0-5][0-9]$'", "[0-5][0-9]'"],
  ['H22', 'brand colour without end anchor', "'^#[0-9a-f]{6}$'", "'^#[0-9a-f]{6}'"],
  ['H23', 'any currency', "data.currency == 'PEN'", 'data.currency is string'],
  ['H24', 'any plan', "data.plan in ['trial']", 'data.plan is string'],
  [
    'H25',
    'stampedNow ignores createdAt',
    'return data.createdAt == request.time && data.updatedAt',
    'return data.updatedAt',
  ],
  [
    'H26',
    'stampedNow ignores updatedAt',
    'data.createdAt == request.time && data.updatedAt == request.time',
    'data.createdAt == request.time',
  ],
  ['H27', 'profile phone unchecked', '(data.phone == null || isPhone(data.phone))', 'true'],
  ['H28', 'member uid may differ from its id', '\n        && data.uid == memberUid', ''],
  ['H29', 'member distributorId may differ', '\n        && data.distributorId == d', ''],
  [
    'H30',
    'schedule accepts extra keys',
    "hasExactly(schedule, ['days', 'opensAt', 'closesAt'])",
    "schedule.keys().hasAll(['days', 'opensAt', 'closesAt'])",
  ],
  ['H31', 'schedule may have no days', 'schedule.days.size() >= 1 && ', ''],
  ['H32', 'time of day without start anchor', "'^([01][0-9]|2[0-3])", "'([01][0-9]|2[0-3])"],
  ['H33', 'phone without start anchor', "'^9[0-9]{8}$'", "'9[0-9]{8}$'"],
  [
    'H34',
    'distributor name without a letter or digit',
    " && value.matches('(?s).*[\\\\pL\\\\pN].*')",
    '',
  ],

  [
    'U01',
    'profile created with distributors',
    '\n        && request.resource.data.ownedDistributorIds.size() == 0',
    '',
  ],
  [
    'U02',
    'profile created with old terms date',
    '\n        && request.resource.data.terms.acceptedAt == request.time\n        && request.resource.data.privacy',
    '\n        && request.resource.data.privacy',
  ],
  [
    'U03',
    'profile created with old privacy date',
    '\n        && request.resource.data.privacy.acceptedAt == request.time\n        && stampedNow',
    '\n        && stampedNow',
  ],
  [
    'U04',
    'terms re-dated on update',
    "(unchanged(['terms']) || request.resource.data.terms.acceptedAt == request.time)",
    'true',
  ],
  [
    'U05',
    'privacy re-dated on update',
    "(unchanged(['privacy']) || request.resource.data.privacy.acceptedAt == request.time)",
    'true',
  ],
  [
    'U06',
    'owned list freely editable',
    "(unchanged(['ownedDistributorIds']) || recordsFounding())",
    'true',
  ],
  [
    'U07',
    'profile createdAt editable',
    "&& unchanged(['createdAt'])\n        && request.resource.data.updatedAt == request.time\n        // Each text",
    '&& request.resource.data.updatedAt == request.time\n        // Each text',
  ],
  [
    'U08',
    'profile updatedAt free',
    "&& unchanged(['createdAt'])\n        && request.resource.data.updatedAt == request.time\n        // Each text",
    "&& unchanged(['createdAt'])\n        // Each text",
  ],
  ['U09', 'owned list may drop old ids', '\n          && after.hasAll(before)', ''],
  ['U10', 'owned list id not founded now', '\n          && foundedNow(after[before.size()])', ''],
  [
    'U11',
    'owned list may keep its size',
    'after.size() == before.size() + 1',
    'after.size() >= before.size()',
  ],
  ['U12', 'owned list new id unchecked shape', '\n          && isDocId(after[before.size()])', ''],
  [
    'U13',
    'any account reads any profile',
    'allow get: if isSelf(uid);\n\n      allow create: if isSelf(uid)\n        && isValidUserProfile',
    'allow get: if signedIn();\n\n      allow create: if isSelf(uid)\n        && isValidUserProfile',
  ],
  [
    'U14',
    'addresses listed without cap',
    'allow list: if isSelf(uid) && request.query.limit <= 10;',
    'allow list: if isSelf(uid);',
  ],
  ['U15', 'any address slot', '\n          && isSlot()', ''],
  [
    'U16',
    'address createdAt editable',
    "&& isValidAddress(request.resource.data)\n          && unchanged(['createdAt'])",
    '&& isValidAddress(request.resource.data)',
  ],
  [
    'U17',
    'anyone deletes addresses',
    'allow delete: if isSelf(uid);',
    'allow delete: if signedIn();',
  ],
  [
    'U18',
    'address updatedAt free',
    "&& unchanged(['createdAt'])\n          && request.resource.data.updatedAt == request.time;\n\n        allow delete",
    "&& unchanged(['createdAt']);\n\n        allow delete",
  ],
  [
    'U19',
    'anyone reads addresses',
    'allow get: if isSelf(uid);\n        allow list',
    'allow get: if signedIn();\n        allow list',
  ],
  [
    'U20',
    'admin doc readable by any account',
    'match /platformAdmins/{uid} {\n      allow get: if isSelf(uid);',
    'match /platformAdmins/{uid} {\n      allow get: if signedIn();',
  ],
  [
    'U21',
    'address stored without a profile',
    '\n          && exists(/databases/$(database)/documents/users/$(uid))',
    '',
  ],

  [
    'S01',
    'slug outside a founding',
    '\n        && foundedNow(request.resource.data.distributorId)',
    '',
  ],
  [
    'S02',
    'slug the distributor does not carry',
    '\n        && getAfter(distributorPath(request.resource.data.distributorId)).data.slug == slug',
    '',
  ],
  ['S03', 'slug id unchecked', '\n        && isSlug(slug)', ''],
  [
    'S04',
    'slug by unverified account',
    'allow create: if emailVerified()\n        && isSlug(slug)',
    'allow create: if signedIn()\n        && isSlug(slug)',
  ],
  [
    'S05',
    'slug createdAt free',
    '\n        && request.resource.data.createdAt == request.time\n        && foundedNow(request.resource.data.distributorId)',
    '\n        && foundedNow(request.resource.data.distributorId)',
  ],
  [
    'S06',
    'slug accepts extra fields',
    "hasExactly(request.resource.data, ['distributorId', 'createdAt'])",
    "request.resource.data.keys().hasAll(['distributorId', 'createdAt'])",
  ],

  ['D01', 'search without limit', 'request.query.limit <= 50\n        && ', ''],
  [
    'D02',
    'search lists closed distributors',
    'request.query.limit <= 50\n        && resource.data.acceptingOrders == true',
    'request.query.limit <= 50',
  ],
  [
    'D03',
    'founding with any flag',
    '\n        && request.resource.data.acceptingOrders == true',
    '',
  ],
  ['D04', 'founding slug unchecked', '\n        && isSlug(request.resource.data.slug)', ''],
  ['D05', 'founding with brands', '\n        && request.resource.data.brands.size() == 0', ''],
  ['D06', 'founding with price', '\n        && request.resource.data.priceFromCents == null', ''],
  [
    'D07',
    'founding without slug document',
    `\n        && getAfter(${DOCS}/slugs/$(request.resource.data.slug)).data.distributorId == d`,
    '',
  ],
  [
    'D08',
    'distributor created outside founding',
    '\n        && foundedNow(d);\n\n      // Owner: profile whitelist',
    ';\n\n      // Owner: profile whitelist',
  ],
  [
    'D09',
    'distributor id unchecked',
    'allow create: if emailVerified()\n        && isDocId(d)',
    'allow create: if emailVerified()',
  ],
  [
    'D10',
    'distributor by unverified account',
    'allow create: if emailVerified()\n        && isDocId(d)',
    'allow create: if signedIn()\n        && isDocId(d)',
  ],
  [
    'D11',
    'distributor updatedAt free',
    'allow update: if isValidDistributor(request.resource.data)\n        && request.resource.data.updatedAt == request.time',
    'allow update: if isValidDistributor(request.resource.data)',
  ],
  [
    'D12',
    'owner edits while read-only',
    "&& hasRole(d, ['owner'])\n            && writable(d)",
    "&& hasRole(d, ['owner'])",
  ],
  [
    'D13',
    'any staff edits the profile',
    "&& hasRole(d, ['owner'])\n            && writable(d)",
    '&& isStaff(d)\n            && writable(d)',
  ],
  [
    'D14',
    'flag written freely by staff',
    '\n            && request.resource.data.acceptingOrders == isWritableData(getAfter(controlPath(d)).data)',
    '',
  ],
  [
    'D15',
    'flag corrected by anyone signed in',
    '&& (isStaff(d) || isPlatformAdmin())',
    '&& signedIn()',
  ],
  [
    'D16',
    'owner whitelist includes the flag',
    "'priceFromCents',\n              'updatedAt'\n            ])",
    "'priceFromCents',\n              'updatedAt', 'acceptingOrders'\n            ])",
  ],
  [
    'D17',
    'owner whitelist includes the slug',
    "'priceFromCents',\n              'updatedAt'\n            ])",
    "'priceFromCents',\n              'updatedAt', 'slug'\n            ])",
  ],
  [
    'D18',
    'flag branch allows other fields',
    "onlyChanges(['acceptingOrders', 'updatedAt'])",
    "onlyChanges(['acceptingOrders', 'name', 'updatedAt'])",
  ],
  [
    'D19',
    'founding stamps free',
    '\n        && stampedNow(request.resource.data)\n        && isSlug(request.resource.data.slug)',
    '\n        && isSlug(request.resource.data.slug)',
  ],
  [
    'D20',
    'flag read from the control before the batch',
    'isWritableData(getAfter(controlPath(d)).data)\n            && (isStaff',
    'isWritableData(get(controlPath(d)).data)\n            && (isStaff',
  ],
  [
    'D21',
    'owner whitelist includes createdAt',
    "'priceFromCents',\n              'updatedAt'\n            ])",
    "'priceFromCents',\n              'updatedAt', 'createdAt', 'currency'\n            ])",
  ],

  [
    'C01',
    'control readable by any account',
    '(resource.data.ownerUid == request.auth.uid || isStaff(d) || isPlatformAdmin());\n\n        // The anchor',
    'true;\n\n        // The anchor',
  ],
  [
    'C02',
    'control for another owner',
    "\n          && request.resource.data.ownerUid == request.auth.uid\n          && request.resource.data.status == 'trial'",
    "\n          && request.resource.data.status == 'trial'",
  ],
  [
    'C03',
    'control created in any status',
    "\n          && request.resource.data.status == 'trial'",
    '',
  ],
  [
    'C04',
    'trial without lower bound',
    "\n          && request.resource.data.trialEndsAt > request.time + duration.value(29, 'd')",
    '',
  ],
  [
    'C05',
    'trial without upper bound',
    "\n          && request.resource.data.trialEndsAt <= request.time + duration.value(721, 'h')",
    '',
  ],
  [
    'C06',
    'control without a new distributor',
    '\n          && getAfter(distributorPath(d)).data.createdAt == request.time',
    '',
  ],
  [
    'C07',
    'control without owner member',
    `\n          && getAfter(${DOCS}/distributors/$(d)/members/$(request.auth.uid)).data.role == 'owner'`,
    '',
  ],
  [
    'C08',
    'control without settings',
    `\n          && getAfter(${DOCS}/distributors/$(d)/private/settings).data.ownerUid == request.auth.uid`,
    '',
  ],
  [
    'C09',
    'control without the profile record',
    `\n          && d in getAfter(${DOCS}/users/$(request.auth.uid)).data.ownedDistributorIds`,
    '',
  ],
  [
    'C10',
    'admin changes the trial end',
    "onlyChanges(['status', 'updatedAt'])",
    "onlyChanges(['status', 'trialEndsAt', 'updatedAt'])",
  ],
  [
    'C11',
    'admin changes the founder',
    "onlyChanges(['status', 'updatedAt'])",
    "onlyChanges(['status', 'ownerUid', 'updatedAt'])",
  ],
  [
    'C12',
    'status and flag may disagree',
    '\n          && getAfter(distributorPath(d)).data.acceptingOrders == isWritableData(request.resource.data)',
    '',
  ],
  [
    'C13',
    'owner changes the status',
    'allow update: if isPlatformAdmin()\n          && isValidControl',
    "allow update: if (isPlatformAdmin() || hasRole(d, ['owner']))\n          && isValidControl",
  ],
  [
    'C14',
    'control updatedAt free',
    "&& onlyChanges(['status', 'updatedAt'])\n          && request.resource.data.updatedAt == request.time",
    "&& onlyChanges(['status', 'updatedAt'])",
  ],
  [
    'C15',
    'control by unverified account',
    'allow create: if emailVerified()\n          && isValidControl',
    'allow create: if signedIn()\n          && isValidControl',
  ],
  [
    'C16',
    'control stamps free',
    "duration.value(721, 'h')\n          && stampedNow(request.resource.data)",
    "duration.value(721, 'h')",
  ],
  [
    'C17',
    'control readable by the staff of any distributor (role only)',
    '(resource.data.ownerUid == request.auth.uid || isStaff(d) || isPlatformAdmin());\n\n        // The anchor',
    '(resource.data.ownerUid == request.auth.uid || isStaff(d) || isPlatformAdmin() || request.auth.token.email_verified == true);\n\n        // The anchor',
  ],
  [
    'C18',
    'control status list accepts anything',
    "data.status in ['trial', 'active', 'pastDue', 'suspended']",
    'data.status is string',
  ],

  [
    'P01',
    'settings readable by any staff',
    "(resource.data.ownerUid == request.auth.uid || hasRole(d, ['owner']) || isPlatformAdmin());",
    '(resource.data.ownerUid == request.auth.uid || isStaff(d) || isPlatformAdmin());',
  ],
  [
    'P02',
    'settings with a foreign e-mail',
    '\n          && request.resource.data.ownerEmail == request.auth.token.email',
    '',
  ],
  [
    'P03',
    'settings terms date free',
    '\n          && request.resource.data.terms.acceptedAt == request.time\n          && request.resource.data.authorityDeclaredAt',
    '\n          && request.resource.data.authorityDeclaredAt',
  ],
  [
    'P04',
    'settings authority date free',
    '\n          && request.resource.data.authorityDeclaredAt == request.time',
    '',
  ],
  [
    'P05',
    'settings outside a founding',
    '\n          && stampedNow(request.resource.data)\n          && foundedNow(d);\n\n        // Reads added by rules: 1 (get control).',
    '\n          && stampedNow(request.resource.data);\n\n        // Reads added by rules: 1 (get control).',
  ],
  [
    'P06',
    'settings edited while read-only',
    '&& request.resource.data.updatedAt == request.time\n          && writable(d);',
    '&& request.resource.data.updatedAt == request.time;',
  ],
  [
    'P07',
    'settings edited by any staff',
    '&& resource.data.ownerUid == request.auth.uid\n          && isValidPrivateSettings',
    '&& isStaff(d)\n          && isValidPrivateSettings',
  ],
  [
    'P08',
    'settings plan editable',
    "onlyChanges(['ownerName', 'ownerPhone', 'updatedAt'])",
    "onlyChanges(['ownerName', 'ownerPhone', 'plan', 'ownerEmail', 'updatedAt'])",
  ],
  [
    'P09',
    'settings for another owner',
    '\n          && request.resource.data.ownerUid == request.auth.uid\n          && request.resource.data.ownerEmail',
    '\n          && request.resource.data.ownerEmail',
  ],
  [
    'P10',
    'settings updatedAt free',
    "&& onlyChanges(['ownerName', 'ownerPhone', 'updatedAt'])\n          && request.resource.data.updatedAt == request.time",
    "&& onlyChanges(['ownerName', 'ownerPhone', 'updatedAt'])",
  ],
  [
    'P11',
    'settings terms editable',
    "onlyChanges(['ownerName', 'ownerPhone', 'updatedAt'])",
    "onlyChanges(['ownerName', 'ownerPhone', 'terms', 'authorityDeclaredAt', 'updatedAt'])",
  ],

  [
    'M01',
    'drivers read the staff',
    "allow get: if isSelf(memberUid) || hasRole(d, ['owner', 'dispatcher']);",
    'allow get: if isSelf(memberUid) || isStaff(d);',
  ],
  [
    'M02',
    'staff list without limit',
    "allow list: if request.query.limit <= 100 && hasRole(d, ['owner', 'dispatcher']);",
    "allow list: if hasRole(d, ['owner', 'dispatcher']);",
  ],
  [
    'M03',
    'drivers list the staff',
    "allow list: if request.query.limit <= 100 && hasRole(d, ['owner', 'dispatcher']);",
    'allow list: if request.query.limit <= 100 && isStaff(d);',
  ],
  [
    'M04',
    'founding member with any role',
    "\n          && request.resource.data.role == 'owner'\n          && request.resource.data.active == true",
    '\n          && request.resource.data.active == true',
  ],
  [
    'M05',
    'founding member inactive',
    '\n          && request.resource.data.active == true\n          && carriesPublicName()',
    '\n          && carriesPublicName()',
  ],
  [
    'M06',
    'member created outside a founding',
    '&& carriesPublicName()\n          && foundedNow(d);',
    '&& carriesPublicName();',
  ],
  [
    'M07',
    'founding member with any distributor name',
    '&& request.resource.data.active == true\n          && carriesPublicName()',
    '&& request.resource.data.active == true',
  ],
  [
    'M08',
    'member by unverified account',
    'allow create: if isSelf(memberUid)\n          && emailVerified()',
    'allow create: if isSelf(memberUid)',
  ],
  ['M09', 'owner changes itself', 'memberUid != request.auth.uid\n              && ', ''],
  [
    'M10',
    'staff managed while read-only, founder included',
    "&& hasRole(d, ['owner'])\n              && writableAndNotFounder(memberUid)",
    "&& hasRole(d, ['owner'])",
  ],
  [
    'M11',
    'founder can be changed',
    'return isWritableData(control) && control.ownerUid != uid;',
    'return isWritableData(control);',
  ],
  [
    'M12',
    'staff managed while read-only',
    'return isWritableData(control) && control.ownerUid != uid;',
    'return control.ownerUid != uid;',
  ],
  [
    'M13',
    'name copy with any value',
    "onlyChanges(['distributorName', 'updatedAt'])\n              && carriesPublicName()",
    "onlyChanges(['distributorName', 'updatedAt'])",
  ],
  [
    'M14',
    'name copy written by any staff',
    "(isSelf(memberUid) || hasRole(d, ['owner']))",
    '(isSelf(memberUid) || isStaff(d))',
  ],
  [
    'M15',
    'member updatedAt free',
    '&& isValidMember(request.resource.data, d, memberUid)\n          && request.resource.data.updatedAt == request.time',
    '&& isValidMember(request.resource.data, d, memberUid)',
  ],
  [
    'M16',
    'owner writes any distributor name',
    "onlyChanges(['role', 'active', 'displayName', 'updatedAt'])",
    "onlyChanges(['role', 'active', 'displayName', 'distributorName', 'updatedAt'])",
  ],
  [
    'M17',
    'any staff manages members',
    "&& hasRole(d, ['owner'])\n              && writableAndNotFounder(memberUid)",
    '&& isStaff(d)\n              && writableAndNotFounder(memberUid)',
  ],
  [
    'M18',
    'founding member for another account',
    'allow create: if isSelf(memberUid)\n          && emailVerified()',
    'allow create: if signedIn()\n          && emailVerified()',
  ],
  [
    'M19',
    'name copy branch allows the role',
    "onlyChanges(['distributorName', 'updatedAt'])",
    "onlyChanges(['distributorName', 'role', 'active', 'updatedAt'])",
  ],
  [
    'M20',
    'owner whitelist allows createdAt',
    "onlyChanges(['role', 'active', 'displayName', 'updatedAt'])",
    "onlyChanges(['role', 'active', 'displayName', 'createdAt', 'updatedAt'])",
  ],
  [
    'M21',
    'member stamps free on founding',
    '&& isValidMember(request.resource.data, d, memberUid)\n          && stampedNow(request.resource.data)',
    '&& isValidMember(request.resource.data, d, memberUid)',
  ],

  ['G01', 'memberships without limit', '\n        && request.query.limit <= 20', ''],
  ['G02', 'memberships of anyone', '\n        && resource.data.uid == request.auth.uid', ''],
  [
    'G03',
    'memberships for anonymous',
    'allow list: if signedIn()\n        && request.query.limit <= 20',
    'allow list: if request.query.limit <= 20',
  ],
];

/**
 * Mutants no test can tell apart from the real rules, with the reason. They are run anyway and
 * reported apart; one that starts failing a test should leave this list.
 */
const WHOLE_STRING =
  'matches() of the rules always compares the whole string: the anchor is redundant';
// The pieces of the founding batch vouch for one another, so some checks are written twice on
// purpose: breaking one copy changes nothing while the other stands.
const VERIFIED_BY_CONTROL =
  'the piece needs foundedNow(d), so the control document is created in the same request, and that requires a verified e-mail';
const EQUIVALENT = {
  H07: 'a control document stamped with request.time was created by this request, and creating it already requires the caller as ownerUid (pair of C02)',
  H09: WHOLE_STRING,
  H12: WHOLE_STRING,
  H21: WHOLE_STRING,
  H22: WHOLE_STRING,
  H32: WHOLE_STRING,
  H33: WHOLE_STRING,
  H24: 'creating the settings requires plan == "trial" and no update may change it: the list in the validator is a second lock',
  U12: 'the id is then passed to foundedNow(), which only holds for a distributor created in this request, whose id is checked there and in the slug',
  S03: 'the slug id must equal the slug field of the new distributor, which is checked with isSlug() when it is created (pair of D04)',
  S04: VERIFIED_BY_CONTROL,
  D04: 'the slug document it names must exist after the request, and creating that one checks isSlug() on its id (pair of S03)',
  D09: 'the slug document must carry this id as distributorId, and creating it checks isDocId()',
  D10: VERIFIED_BY_CONTROL,
  C02: 'every other piece needs foundedNow(d), which requires the caller as ownerUid of the control document (pair of H07)',
  C15: 'the distributor, created in the same request, requires a verified e-mail',
  P09: 'the control document requires the settings to carry the caller as ownerUid',
  M04: 'the control document requires the member of the caller to have role owner',
  M08: VERIFIED_BY_CONTROL,
  G03: 'without a session request.auth is null, so comparing resource.data.uid with request.auth.uid fails',
};

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const occurrences = (text, part) => text.split(part).length - 1;

/** Test files that take the rules from helpers.ts; the others would ignore the broken copy. */
function testFiles() {
  const wanted = process.env.MUTATION_FILES ? process.env.MUTATION_FILES.split(',') : null;
  return readdirSync(TESTS_DIR)
    .filter((name) => name.endsWith('.rules.test.ts'))
    .filter((name) => readFileSync(join(TESTS_DIR, name), 'utf8').includes("from './helpers'"))
    .filter((name) => wanted === null || wanted.some((part) => name.includes(part)))
    .map((name) => `${TESTS_DIR}/${name}`);
}

function runTests(env) {
  return new Promise((resolve) => {
    const command = `npx vitest run --config vitest.rules.config.ts --bail 1 ${testFiles().join(' ')}`;
    const child = spawn(command, { shell: true, windowsHide: true, env });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', () => resolve({ status: 1, output }));
    child.on('exit', (status) =>
      resolve({ status: status ?? 1, output: output.replace(ANSI, '') }),
    );
  });
}

async function judge([id, description, search, replacement], original, worker) {
  const copy = join(tmpdir(), `glpweb-rules-mutant-${process.pid}-${worker}.rules`);
  writeFileSync(
    copy,
    original.replace(search, () => replacement),
  );
  const started = Date.now();
  const env = { ...process.env, RULES_FILE: copy, RULES_PROJECT_PREFIX: `demo-glpweb-m${worker}` };
  const { status, output } = await runTests(env);
  rmSync(copy, { force: true });
  const compileError = /Error compiling rules[^"]*/.exec(output)?.[0] ?? null;
  const ran = /Tests\s+.*\d+ (passed|failed)/.test(output);
  let outcome = status === 0 ? 'SURVIVED' : 'killed';
  if (compileError || !ran) outcome = 'BROKEN';
  return {
    id,
    description,
    outcome,
    by: compileError ?? /FAIL\s+(.+)/.exec(output)?.[1]?.trim() ?? null,
    seconds: Math.round((Date.now() - started) / 1000),
  };
}

async function main() {
  const original = readFileSync(RULES, 'utf8');
  const stale = MUTANTS.filter(([, , search]) => occurrences(original, search) !== 1);
  if (stale.length > 0) {
    for (const [id, , search] of stale) {
      process.stderr.write(
        `${id}: its text occurs ${occurrences(original, search)} times in the rules\n`,
      );
    }
    process.exit(1);
  }
  const wanted = process.env.MUTANTS ? process.env.MUTANTS.split(',') : null;
  const queue = MUTANTS.filter(([id]) => wanted === null || wanted.includes(id));
  const workers = Number(process.env.MUTATION_WORKERS ?? DEFAULT_WORKERS);
  const results = [];
  await Promise.all(
    Array.from({ length: workers }, async (_, worker) => {
      for (let mutant = queue.shift(); mutant; mutant = queue.shift()) {
        const result = await judge(mutant, original, worker);
        results.push(result);
        const by = result.outcome === 'killed' ? `  ← ${result.by}` : '';
        process.stdout.write(
          `${result.id} ${result.outcome} (${result.seconds}s) ${result.description}${by}\n`,
        );
      }
    }),
  );

  const survivors = results.filter(
    ({ id, outcome }) => outcome === 'SURVIVED' && !(id in EQUIVALENT),
  );
  const equivalent = results.filter(
    ({ id, outcome }) => outcome === 'SURVIVED' && id in EQUIVALENT,
  );
  const broken = results.filter(({ outcome }) => outcome === 'BROKEN');
  const killed = results.filter(({ outcome }) => outcome === 'killed');
  process.stdout.write(
    `\nMutants: ${results.length} · killed ${killed.length} · survived ${survivors.length}` +
      ` · equivalent ${equivalent.length} · broken ${broken.length}\n`,
  );
  for (const { id, description } of survivors)
    process.stdout.write(`SURVIVED ${id}: ${description}\n`);
  for (const { id } of equivalent) process.stdout.write(`equivalent ${id}: ${EQUIVALENT[id]}\n`);
  for (const { id, by } of broken)
    process.stdout.write(`BROKEN ${id}: ${by ?? 'the tests did not run'}\n`);
  process.exit(survivors.length + broken.length > 0 ? 1 : 0);
}

await main();
