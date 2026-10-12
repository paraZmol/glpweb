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

/** [id, what the broken rule would allow, text to find (exactly once), replacement]. */
const MUTANTS = [
  ['H01', 'hasRole ignores active', 'member(d).active == true && ', ''],
  ['H02', 'hasRole ignores the role', 'member(d).role in roles', 'true'],
  [
    'H03',
    'platform admin from a token claim',
    'exists(/databases/$(database)/documents/platformAdmins/$(request.auth.uid))',
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
    'H35',
    'isOpenData ignores the approval',
    "control.get('listingApproved', false) == true && isWritableData(control)",
    'isWritableData(control)',
  ],
  [
    'H36',
    'isOpenData ignores the plan state',
    "control.get('listingApproved', false) == true && isWritableData(control)",
    "control.get('listingApproved', false) == true",
  ],
  [
    'H37',
    'distributor id of any length',
    "value.matches('^[A-Za-z0-9]{20}$')",
    "value.matches('^[A-Za-z0-9]+$')",
  ],
  ['H38', 'RUC of any prefix', "'^(10|15|16|17|20)[0-9]{9}$'", "'^[0-9]{11}$'"],
  ['H39', 'RUC of any length', "'^(10|15|16|17|20)[0-9]{9}$'", "'^(10|15|16|17|20)[0-9]*$'"],
  [
    'H40',
    'record number of any characters',
    "\n        && value.matches('^[A-Z0-9]([A-Z0-9 ./-]*[A-Z0-9])?$')",
    '',
  ],
  [
    'H41',
    'record number without a lower bound',
    'value.size() >= 4 && value.size() <= 40',
    'value.size() <= 40',
  ],
  [
    'H42',
    'record number without an upper bound',
    'value.size() >= 4 && value.size() <= 40',
    'value.size() >= 4',
  ],
  [
    'H43',
    'link may carry the name of the platform',
    "\n        && !value.matches('.*(hornilla|glpweb).*')",
    '',
  ],
  ['H44', 'control approval of any type', '\n        && data.listingApproved is bool', ''],
  [
    'H45',
    'control without the approval field',
    "'ownerUid', 'status', 'trialEndsAt', 'listingApproved', 'createdAt', 'updatedAt'\n        ])\n        && data.keys().hasOnly",
    "'ownerUid', 'status', 'trialEndsAt', 'createdAt', 'updatedAt'\n        ])\n        && data.keys().hasOnly",
  ],
  [
    'H46',
    'control accepts extra fields',
    "'slug', 'createdAt', 'updatedAt'\n        ])\n        && data.ownerUid is string",
    "'slug', 'createdAt', 'updatedAt', 'plan', 'note'\n        ])\n        && data.ownerUid is string",
  ],
  [
    'H47',
    'approval without its date',
    'return data.approvedAt is timestamp\n        && data.approvedBy is string',
    'return data.approvedBy is string',
  ],
  [
    'H48',
    'approval without its author',
    '\n        && data.approvedBy is string\n        && !(',
    '\n        && !(',
  ],
  [
    'H49',
    'approval that keeps a note for the owner',
    "\n        && !('reviewNote' in data)\n        && !('correctedAt' in data);",
    "\n        && !('correctedAt' in data);",
  ],
  [
    'H50',
    'pending listing that claims an approval date',
    "return !('approvedAt' in data)\n        && !('approvedBy' in data)",
    "return !('approvedBy' in data)",
  ],
  [
    'H51',
    'pending listing that claims an approver',
    "\n        && !('approvedBy' in data)\n        && !('reviewedProfileAt'",
    "\n        && !('reviewedProfileAt'",
  ],
  [
    'H52',
    'review note of any size or type',
    "(!('reviewNote' in data) || isText(data.reviewNote, 1, 300))",
    'true',
  ],
  ['H53', 'settings RUC unchecked', '\n        && isTaxId(data.taxId)', ''],
  ['H54', 'settings legal name unchecked', '\n        && isText(data.legalName, 2, 120)', ''],
  [
    'H55',
    'settings record number unchecked',
    '\n        && isRegistryNumber(data.hydrocarbonsRegistry)',
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
    'profile created without the history entry of its terms',
    "\n        && logsAcceptance(uid, 'terms', request.resource.data.terms)",
    '',
  ],
  [
    'U03',
    'profile created without the history entry of its privacy consent',
    "\n        && logsAcceptance(uid, 'privacy', request.resource.data.privacy)",
    '',
  ],
  [
    'U04',
    'terms accepted on update without their history entry',
    "(unchanged(['terms']) || logsAcceptance(uid, 'terms', request.resource.data.terms))",
    'true',
  ],
  [
    'U05',
    'privacy accepted on update without its history entry',
    "(unchanged(['privacy'])\n          || logsAcceptance(uid, 'privacy', request.resource.data.privacy))",
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
    "&& unchanged(['createdAt'])\n        && request.resource.data.updatedAt == request.time\n        // A text is",
    '&& request.resource.data.updatedAt == request.time\n        // A text is',
  ],
  [
    'U08',
    'profile updatedAt free',
    "&& unchanged(['createdAt'])\n        && request.resource.data.updatedAt == request.time\n        // A text is",
    "&& unchanged(['createdAt'])\n        // A text is",
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
    'allow get: if isSelf(uid);\n\n      // A profile carries the consents',
    'allow get: if signedIn();\n\n      // A profile carries the consents',
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
    'U22',
    'profile created by an unverified account',
    'allow create: if isSelf(uid)\n        && emailVerified()\n        && isValidUserProfile',
    'allow create: if isSelf(uid)\n        && isValidUserProfile',
  ],
  [
    'U23',
    'profile edited by an unverified account',
    'allow update: if isSelf(uid)\n        && emailVerified()\n        && isValidUserProfile',
    'allow update: if isSelf(uid)\n        && isValidUserProfile',
  ],
  [
    'U24',
    'address saved by an unverified account',
    'allow create: if isSelf(uid)\n          && emailVerified()\n          && isSlot()',
    'allow create: if isSelf(uid)\n          && isSlot()',
  ],
  [
    'U25',
    'address edited by an unverified account',
    'allow update: if isSelf(uid)\n          && emailVerified()\n          && isValidAddress',
    'allow update: if isSelf(uid)\n          && isValidAddress',
  ],
  // History of acceptances (/users/{uid}/acceptances): the two halves of an acceptance.
  [
    'A01',
    'acceptance dated freely in the profile while its entry is stamped now',
    'return acceptance.acceptedAt == request.time\n        && entry.data.acceptedAt == request.time;',
    'return entry.data.acceptedAt == request.time;',
  ],
  [
    'A02',
    'acceptance in the profile needs no history entry',
    '\n        && entry.data.acceptedAt == request.time;',
    '\n        && (entry == null || entry != null);',
  ],
  [
    'A03',
    'an entry of any date is enough: an accepted version can be dated again',
    '\n        && entry.data.acceptedAt == request.time;',
    '\n        && entry.data.acceptedAt is timestamp;',
  ],
  [
    'A04',
    'any account reads any history',
    'return isSelf(uid) || isPlatformAdmin();',
    'return signedIn();',
  ],
  [
    'A05',
    'history listed without cap',
    'allow list: if mayRead() && request.query.limit <= 50;',
    'allow list: if mayRead();',
  ],
  [
    'A06',
    'history entry created by another account',
    'allow create: if isSelf(uid)\n          && emailVerified()\n          && isAcceptanceEntry',
    'allow create: if emailVerified()\n          && isAcceptanceEntry',
  ],
  [
    'A07',
    'history entry created by an unverified account',
    'allow create: if isSelf(uid)\n          && emailVerified()\n          && isAcceptanceEntry',
    'allow create: if isSelf(uid)\n          && isAcceptanceEntry',
  ],
  [
    'A08',
    'history entry under any id',
    '\n          && entryId == acceptanceEntryId(\n            request.resource.data.document, request.resource.data.version)',
    '',
  ],
  [
    'A09',
    'history entry dated freely',
    '\n          && request.resource.data.acceptedAt == request.time\n          && profileAccepts',
    '\n          && profileAccepts',
  ],
  [
    'A10',
    'history entry without the acceptance in the profile',
    '\n          && profileAccepts(request.resource.data);',
    ';',
  ],
  [
    'A11',
    'history entry for another version than the profile takes',
    'return held.version == entry.version && held.acceptedAt == request.time;',
    'return held.acceptedAt == request.time;',
  ],
  [
    'A12',
    'history entry dated now for an acceptance the profile made before',
    'return held.version == entry.version && held.acceptedAt == request.time;',
    'return held.version == entry.version;',
  ],
  [
    'A13',
    'history entry accepts extra keys',
    "hasExactly(entry, ['document', 'version', 'acceptedAt'])",
    "entry.keys().hasAll(['document', 'version', 'acceptedAt'])",
  ],
  [
    'A14',
    'history entry names any text and version',
    "((entry.document == 'terms' && entry.version in acceptedTermsVersions())\n          || (entry.document == 'privacy' && entry.version in acceptedPrivacyVersions()))",
    'entry.version is string',
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
  [
    'D01',
    'search without limit',
    'allow list: if request.query.limit <= 50\n        && resource.data.acceptingOrders == true;',
    'allow list: if resource.data.acceptingOrders == true;',
  ],
  [
    'D02',
    'search lists closed distributors',
    'request.query.limit <= 50\n        && resource.data.acceptingOrders == true',
    'request.query.limit <= 50',
  ],
  [
    'D03',
    'founding already listed',
    '\n        && request.resource.data.acceptingOrders == false\n        && stampedNow',
    '\n        && stampedNow',
  ],
  ['D04', 'founding slug unchecked', '\n        && isSlug(request.resource.data.slug)', ''],
  ['D05', 'founding with brands', '\n        && request.resource.data.brands.size() == 0', ''],
  ['D06', 'founding with price', '\n        && request.resource.data.priceFromCents == null', ''],
  [
    'D07',
    'founding without slug document',
    '\n        && getAfter(/databases/$(database)/documents/slugs/$(request.resource.data.slug)).data.distributorId == d',
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
    'distributor id chosen by the client',
    'allow create: if emailVerified()\n        && isDistributorId(d)',
    'allow create: if emailVerified()\n        && isDocId(d)',
  ],
  [
    'D10',
    'distributor by unverified account',
    'allow create: if emailVerified()\n        && isDistributorId(d)',
    'allow create: if signedIn()\n        && isDistributorId(d)',
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
    '\n            && request.resource.data.acceptingOrders == isOpenData(getAfter(controlPath(d)).data)',
    '',
  ],
  [
    'D15',
    'flag corrected by anyone signed in',
    '&& ((flipsTheFlag() && isStaff(d)) || isPlatformAdmin())',
    '&& signedIn()',
  ],
  [
    'D35',
    'staff rewrites the flag as it is, which moves the version a review is for',
    '((flipsTheFlag() && isStaff(d)) || isPlatformAdmin())',
    '(isStaff(d) || isPlatformAdmin())',
  ],
  [
    'D36',
    'a real change of the flag by an account that does not work there',
    '((flipsTheFlag() && isStaff(d)) || isPlatformAdmin())',
    '(flipsTheFlag() || isPlatformAdmin())',
  ],
  [
    'D16',
    'owner unlists or lists without an edit of the identity',
    "(changesIdentity() ? returnsToReview() : unchanged(['acceptingOrders']))",
    '(changesIdentity() ? returnsToReview() : true)',
  ],
  [
    'D17',
    'owner whitelist includes the slug',
    "'brands', 'priceFromCents',\n              'acceptingOrders', 'updatedAt'\n            ])",
    "'brands', 'priceFromCents',\n              'acceptingOrders', 'updatedAt', 'slug'\n            ])",
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
    'isOpenData(getAfter(controlPath(d)).data)\n            && ((flipsTheFlag',
    'isOpenData(get(controlPath(d)).data)\n            && ((flipsTheFlag',
  ],
  [
    'D21',
    'owner whitelist includes createdAt',
    "'brands', 'priceFromCents',\n              'acceptingOrders', 'updatedAt'\n            ])",
    "'brands', 'priceFromCents',\n              'acceptingOrders', 'updatedAt', 'createdAt', 'currency'\n            ])",
  ],
  [
    'D22',
    'public profile readable whatever its state',
    'allow get: if resource == null\n        || resource.data.acceptingOrders == true',
    'allow get: if true\n        || resource.data.acceptingOrders == true',
  ],
  [
    'D23',
    'unlisted profile readable by any account',
    '\n        || isStaff(d)\n        || isPlatformAdmin();',
    '\n        || signedIn();',
  ],
  [
    'D24',
    'unlisted profile closed to its own staff',
    '\n        || isStaff(d)\n        || isPlatformAdmin();',
    '\n        || isPlatformAdmin();',
  ],
  [
    'D25',
    'unlisted profile closed to platform admins',
    '\n        || isStaff(d)\n        || isPlatformAdmin();',
    '\n        || isStaff(d);',
  ],
  [
    'D26',
    'missing profile reads as a refusal',
    'allow get: if resource == null\n        || resource',
    'allow get: if resource',
  ],
  [
    'D27',
    'name or phone edited without returning to review',
    "(changesIdentity() ? returnsToReview() : unchanged(['acceptingOrders']))",
    "(changesIdentity() ? true : unchanged(['acceptingOrders']))",
  ],
  [
    'D28',
    'identity edit that stays listed',
    "return request.resource.data.acceptingOrders == false\n          && control.get('listingApproved'",
    "return control.get('listingApproved'",
  ],
  [
    'D29',
    'identity edit that keeps the approval',
    "request.resource.data.acceptingOrders == false\n          && control.get('listingApproved', false) == false\n",
    'request.resource.data.acceptingOrders == false\n',
  ],
  [
    'D30',
    'a new name is not an identity edit',
    ".hasAny(['name', 'contactPhone', 'whatsapp', 'addressLine', 'plant'])",
    ".hasAny(['contactPhone', 'whatsapp', 'addressLine', 'plant'])",
  ],
  [
    'D31',
    'a new contact phone is not an identity edit',
    ".hasAny(['name', 'contactPhone', 'whatsapp', 'addressLine', 'plant'])",
    ".hasAny(['name', 'whatsapp', 'addressLine', 'plant'])",
  ],
  [
    'D32',
    'a new WhatsApp is not an identity edit',
    ".hasAny(['name', 'contactPhone', 'whatsapp', 'addressLine', 'plant'])",
    ".hasAny(['name', 'contactPhone', 'addressLine', 'plant'])",
  ],
  [
    'D33',
    'a new address line is not an identity edit',
    ".hasAny(['name', 'contactPhone', 'whatsapp', 'addressLine', 'plant'])",
    ".hasAny(['name', 'contactPhone', 'whatsapp', 'plant'])",
  ],
  [
    'D34',
    'a plant somewhere else is not an identity edit',
    ".hasAny(['name', 'contactPhone', 'whatsapp', 'addressLine', 'plant'])",
    ".hasAny(['name', 'contactPhone', 'whatsapp', 'addressLine'])",
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
    "\n          && getAfter(/databases/$(database)/documents/distributors/$(d)/members/$(request.auth.uid)).data.role == 'owner'",
    '',
  ],
  [
    'C08',
    'control without settings',
    '\n          && getAfter(settingsPath(d)).data.ownerUid == request.auth.uid',
    '',
  ],
  [
    'C09',
    'control without the profile record',
    'return d in owned && isOperatingAt(owned, 0)',
    'return isOperatingAt(owned, 0)',
  ],
  [
    'C10',
    'admin changes the trial end',
    "'reviewedSettingsAt', 'reviewNote', 'correctedAt', 'distributorName', 'slug',\n                'updatedAt'\n              ])",
    "'reviewedSettingsAt', 'reviewNote', 'correctedAt', 'distributorName', 'slug',\n                'trialEndsAt', 'updatedAt'\n              ])",
  ],
  [
    'C11',
    'admin changes the founder',
    "'reviewedSettingsAt', 'reviewNote', 'correctedAt', 'distributorName', 'slug',\n                'updatedAt'\n              ])",
    "'reviewedSettingsAt', 'reviewNote', 'correctedAt', 'distributorName', 'slug',\n                'ownerUid', 'updatedAt'\n              ])",
  ],
  [
    'C12',
    'control and public flag may disagree',
    '\n          && getAfter(distributorPath(d)).data.acceptingOrders == isOpenData(request.resource.data)',
    '',
  ],
  [
    'C13',
    'owner changes the status or approves',
    '              isPlatformAdmin()\n              && onlyChanges([',
    "              (isPlatformAdmin() || hasRole(d, ['owner']))\n              && onlyChanges([",
  ],
  [
    'C14',
    'control updatedAt free',
    'allow update: if isValidControl(request.resource.data)\n          && request.resource.data.updatedAt == request.time',
    'allow update: if isValidControl(request.resource.data)',
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
    'C19',
    'control founded already approved',
    "\n          && request.resource.data.listingApproved == false\n          && !('reviewNote' in request.resource.data)",
    "\n          && !('reviewNote' in request.resource.data)",
  ],
  [
    'C20',
    'control founded with a note',
    "\n          && !('reviewNote' in request.resource.data)",
    '',
  ],
  [
    'C21',
    'founding with the first owned distributor read-only',
    'd in owned && isOperatingAt(owned, 0) && isOperatingAt(owned, 1)',
    'd in owned && isOperatingAt(owned, 1)',
  ],
  [
    'C22',
    'founding with the second owned distributor read-only',
    'd in owned && isOperatingAt(owned, 0) && isOperatingAt(owned, 1)',
    'd in owned && isOperatingAt(owned, 0)',
  ],
  ['C23', 'approval not signed', '\n              && approvalIsSigned()', ''],
  [
    'C24',
    'approval with any date',
    'request.resource.data.approvedAt == request.time\n              && request',
    'request',
  ],
  [
    'C25',
    'approval in the name of somebody else',
    '\n              && request.resource.data.approvedBy == request.auth.uid',
    '',
  ],
  [
    'C26',
    'an approval may be re-dated later',
    "unchanged([\n              'listingApproved', 'approvedAt', 'approvedBy', 'reviewedProfileAt',\n              'reviewedSettingsAt'\n            ])",
    "unchanged(['listingApproved', 'reviewedProfileAt', 'reviewedSettingsAt'])",
  ],
  [
    'C27',
    'owner approves its own listing',
    '\n              && request.resource.data.listingApproved == false\n              && hasRole',
    '\n              && hasRole',
  ],
  [
    'C28',
    'any staff sends the listing back to review',
    "&& request.resource.data.listingApproved == false\n              && hasRole(d, ['owner'])",
    '&& request.resource.data.listingApproved == false\n              && isStaff(d)',
  ],
  [
    'C29',
    'any account sends a listing back to review',
    "&& request.resource.data.listingApproved == false\n              && hasRole(d, ['owner'])",
    '&& request.resource.data.listingApproved == false\n              && signedIn()',
  ],
  [
    'C30',
    'owner writes the review note',
    "'reviewedSettingsAt', 'correctedAt', 'distributorName', 'slug', 'updatedAt'\n              ])",
    "'reviewedSettingsAt', 'correctedAt', 'distributorName', 'slug', 'reviewNote',\n                'updatedAt'\n              ])",
  ],
  [
    'C31',
    'owner changes the status with the return to review',
    "'reviewedSettingsAt', 'correctedAt', 'distributorName', 'slug', 'updatedAt'\n              ])",
    "'reviewedSettingsAt', 'correctedAt', 'distributorName', 'slug', 'status',\n                'updatedAt'\n              ])",
  ],
  [
    'P01',
    'settings readable by a co-owner',
    '(resource.data.ownerUid == request.auth.uid || isPlatformAdmin());',
    "(resource.data.ownerUid == request.auth.uid || hasRole(d, ['owner']) || isPlatformAdmin());",
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
    '\n          && stampedNow(request.resource.data)\n          && foundedNow(d);\n\n        // The verification data',
    '\n          && stampedNow(request.resource.data);\n\n        // The verification data',
  ],
  [
    'P06',
    'settings edited while read-only',
    'return isWritableData(control)\n            && (',
    'return (',
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
    "'ownerName', 'ownerPhone', 'taxId', 'legalName', 'hydrocarbonsRegistry', 'updatedAt'\n          ])",
    "'ownerName', 'ownerPhone', 'taxId', 'legalName', 'hydrocarbonsRegistry', 'plan', 'ownerEmail', 'updatedAt'\n          ])",
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
    '\n          && request.resource.data.updatedAt == request.time\n          && settingsEditAllowed',
    '\n          && settingsEditAllowed',
  ],
  [
    'P11',
    'settings terms editable',
    "'ownerName', 'ownerPhone', 'taxId', 'legalName', 'hydrocarbonsRegistry', 'updatedAt'\n          ])",
    "'ownerName', 'ownerPhone', 'taxId', 'legalName', 'hydrocarbonsRegistry', 'terms', 'authorityDeclaredAt', 'updatedAt'\n          ])",
  ],
  [
    'P12',
    'verification data edited after the approval',
    "unchanged(['taxId', 'legalName', 'hydrocarbonsRegistry'])\n              || control.get('listingApproved', false) == false",
    'true',
  ],
  [
    'P13',
    'settings readable by any signed-in account',
    '(resource.data.ownerUid == request.auth.uid || isPlatformAdmin());',
    '(signedIn() || isPlatformAdmin());',
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
  [
    'G04',
    'platform lists without limit',
    'allow list: if request.query.limit <= 50\n        && (\n          resource.data.listingApproved',
    'allow list: if (\n          resource.data.listingApproved',
  ],
  [
    'G05',
    'control documents listed without one of the filters',
    "resource.data.listingApproved == false\n          || resource.data.listingApproved == true\n          || resource.data.status == 'suspended'",
    'true',
  ],
  [
    'G06',
    'platform lists for any account',
    "\n          || resource.data.status == 'suspended'\n        )\n        && isPlatformAdmin();",
    "\n          || resource.data.status == 'suspended'\n        )\n        && signedIn();",
  ],
  [
    'G07',
    'distributors listed by any status',
    "|| resource.data.status == 'suspended'",
    '|| resource.data.status is string',
  ],
  [
    'X01',
    'rename that leaves the old name in the control document',
    "\n          && (\n            unchanged(['name'])\n            || control.get('distributorName', null) == request.resource.data.name\n          );",
    ';',
  ],
  [
    'X02',
    'founding with a made-up copy of the name',
    '\n          && request.resource.data.distributorName == getAfter(distributorPath(d)).data.name',
    '',
  ],
  [
    'X03',
    'founding with a made-up copy of the link',
    '\n          && request.resource.data.slug == getAfter(distributorPath(d)).data.slug',
    '',
  ],
  [
    'X04',
    'copy of the name written freely',
    "\n          && copyHolds('distributorName', getAfter(distributorPath(d)).data.name)",
    '',
  ],
  [
    'X05',
    'copy of the link written freely',
    "\n          && copyHolds('slug', getAfter(distributorPath(d)).data.slug);",
    ';',
  ],
  [
    'X06',
    'a copy of the public profile can be removed',
    '            : !(field in resource.data);',
    '            : true;',
  ],
  [
    'X07',
    'approved listing that keeps a correction mark',
    "\n        && !('reviewNote' in data)\n        && !('correctedAt' in data);",
    "\n        && !('reviewNote' in data);",
  ],
  [
    'X08',
    'correction mark without a note beside it',
    "('reviewNote' in data && data.correctedAt is timestamp)",
    'data.correctedAt is timestamp',
  ],
  [
    'X09',
    'correction mark of any type',
    "('reviewNote' in data && data.correctedAt is timestamp)",
    "'reviewNote' in data",
  ],
  [
    'X10',
    'admin writes or keeps a correction mark at will',
    '\n              && leavesCorrectionMarkAlone()',
    '',
  ],
  [
    'X11',
    'admin changes the note and keeps the mark',
    "unchanged(['correctedAt', 'reviewNote'])",
    "unchanged(['correctedAt'])",
  ],
  [
    'X12',
    'admin re-dates the correction mark',
    "unchanged(['correctedAt', 'reviewNote'])",
    "unchanged(['reviewNote'])",
  ],
  [
    'X13',
    'owner writes or removes the correction mark at will',
    "\n              && (unchanged(['correctedAt']) || marksCorrection())",
    '',
  ],
  [
    'X14',
    'correction mark with a made-up date',
    'return request.resource.data.correctedAt == request.time\n            && isWritableData',
    'return isWritableData',
  ],
  [
    'X15',
    'correction mark without a correction',
    "\n            && (\n              corrects(distributorPath(d), ['acceptingOrders', 'updatedAt'])\n              || corrects(settingsPath(d), ['updatedAt'])\n            );",
    ';',
  ],
  [
    'X16',
    'an edit of the public profile does not count as a correction',
    "corrects(distributorPath(d), ['acceptingOrders', 'updatedAt'])\n              || corrects(settingsPath",
    'corrects(settingsPath',
  ],
  [
    'X17',
    'an edit of the private settings does not count as a correction',
    "\n              || corrects(settingsPath(d), ['updatedAt'])",
    '',
  ],
  [
    'X18',
    'a write of the public profile that only moves its date counts as a correction',
    "corrects(distributorPath(d), ['acceptingOrders', 'updatedAt'])",
    "corrects(distributorPath(d), ['acceptingOrders'])",
  ],
  [
    'X19',
    'a flip of the public flag counts as a correction',
    "corrects(distributorPath(d), ['acceptingOrders', 'updatedAt'])",
    "corrects(distributorPath(d), ['updatedAt'])",
  ],
  [
    'X20',
    'a write of the private settings that only moves its date counts as a correction',
    "corrects(settingsPath(d), ['updatedAt'])",
    'corrects(settingsPath(d), [])',
  ],
  [
    'X21',
    'correction marked on a distributor that cannot be written',
    '\n            && isWritableData(resource.data)\n            && (\n              corrects',
    '\n            && (\n              corrects',
  ],
  [
    'X22',
    'a document that was written counts as corrected, whatever it changed',
    '!getAfter(path).data.diff(get(path).data).affectedKeys().hasOnly(hollow)',
    'getAfter(path).data.updatedAt == request.time',
  ],
  [
    'R01',
    'approval for a version nobody checks',
    '\n              && approvesWhatWasReviewed()',
    '',
  ],
  [
    'R02',
    'approval of a public profile edited after the review',
    'return request.resource.data.reviewedProfileAt == get(distributorPath(d)).data.updatedAt\n            && request',
    'return request',
  ],
  [
    'R03',
    'approval of private settings edited after the review',
    '\n            && request.resource.data.reviewedSettingsAt == get(settingsPath(d)).data.updatedAt',
    '',
  ],
  [
    'R04',
    'reviewed version of the profile compared with what the approval itself writes',
    'reviewedProfileAt == get(distributorPath(d)).data.updatedAt',
    'reviewedProfileAt == getAfter(distributorPath(d)).data.updatedAt',
  ],
  [
    'R05',
    'the versions of an approval may be rewritten later',
    "'listingApproved', 'approvedAt', 'approvedBy', 'reviewedProfileAt',\n              'reviewedSettingsAt'\n            ])",
    "'listingApproved', 'approvedAt', 'approvedBy'\n            ])",
  ],
  [
    'R06',
    'pending listing that names a reviewed profile',
    "\n        && !('reviewedProfileAt' in data)",
    '',
  ],
  [
    'R07',
    'pending listing that names reviewed settings',
    "\n        && !('reviewedSettingsAt' in data)",
    '',
  ],
  [
    'R08',
    'reviewed version of the settings read from the public profile',
    'reviewedSettingsAt == get(settingsPath(d)).data.updatedAt',
    'reviewedSettingsAt == get(distributorPath(d)).data.updatedAt',
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
// An acceptance is two writes that vouch for each other: the field of the profile demands its
// history entry stamped now (logsAcceptance) and the entry demands that field stamped now
// (profileAccepts). A check written on both sides survives while the other side stands.
const ENTRY_NEEDS_PROFILE =
  'profileAccepts() needs the profile of that account to take the acceptance in this same request';
const EQUIVALENT = {
  U22: 'a profile needs its two history entries in the same request (logsAcceptance), and creating an entry requires a verified e-mail (pair of A07)',
  A01: 'the entry it needs is stamped now, so this request creates it, and creating it requires the profile to hold the acceptance stamped with request.time (profileAccepts, pair of A12)',
  A06: `${ENTRY_NEEDS_PROFILE}, and only the account itself writes its profile`,
  A07: `${ENTRY_NEEDS_PROFILE}, and writing the profile requires a verified e-mail (pair of U22)`,
  A09: 'the profile that takes the acceptance demands, through logsAcceptance(), that this very entry (same id: A08) be stamped with request.time',
  A11: 'the version of an entry must be an allowed one of its text, and each list holds a single version today: the one the profile takes. NOT equivalent once a list has two versions: add then a rules test with an entry of the other version',
  A14: 'the id must be document-version (A08) and profileAccepts() reads the profile field named by the document, which exists only for terms and privacy and only with an allowed version',
  H07: 'a control document stamped with request.time was created by this request, and creating it already requires the caller as ownerUid (pair of C02)',
  H09: WHOLE_STRING,
  H12: WHOLE_STRING,
  H21: WHOLE_STRING,
  H22: WHOLE_STRING,
  H32: WHOLE_STRING,
  H33: WHOLE_STRING,
  H44: 'the next line branches on the field with a ternary, which fails to evaluate (and so denies) for anything that is not a boolean',
  H45: 'the validator reads the field right after: a control document without it fails to evaluate, which denies',
  H47: 'a control document only becomes approved through approvalIsSigned(), which demands approvedAt == request.time: it is always a timestamp',
  H48: 'a control document only becomes approved through approvalIsSigned(), which demands approvedBy == request.auth.uid: it is always a string',
  H24: 'creating the settings requires plan == "trial" and no update may change it: the list in the validator is a second lock',
  U12: 'the id is then passed to foundedNow(), which only holds for a distributor created in this request, whose id is checked there and in the slug',
  S03: 'the slug id must equal the slug field of the new distributor, which is checked with isSlug() when it is created (pair of D04)',
  S04: VERIFIED_BY_CONTROL,
  D04: 'the slug document it names must exist after the request, and creating that one checks isSlug() on its id (pair of S03)',
  D10: VERIFIED_BY_CONTROL,
  C02: 'every other piece needs foundedNow(d), which requires the caller as ownerUid of the control document (pair of H07)',
  C15: 'the distributor, created in the same request, requires a verified e-mail',
  P09: 'the control document requires the settings to carry the caller as ownerUid',
  M04: 'the control document requires the member of the caller to have role owner',
  M08: VERIFIED_BY_CONTROL,
  G03: 'without a session request.auth is null, so comparing resource.data.uid with request.auth.uid fails',
  X07: 'an approval removes the note (H49), and leavesCorrectionMarkAlone() lets a mark survive only while the note is untouched: the shape is a second lock',
  X09: 'only an owner writes the mark, through marksCorrection(), which demands correctedAt == request.time: it is always a timestamp',
  X21: 'the mark needs a change of content in the public profile or in the private settings, and both rules already demand a writable distributor for it (writable(d) in the owner edit, settingsEditAllowed()): a second lock that costs no read, because the control document is the one being written',
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
