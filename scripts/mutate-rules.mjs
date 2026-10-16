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
  ['H01', 'hasRole ignores active', 'held.active == true && ', ''],
  ['H02', 'hasRole ignores the role', 'held.role in roles', 'true'],
  [
    'H03',
    'platform admin from a token claim',
    'exists(/databases/$(database)/documents/platformAdmins/$(request.auth.uid))',
    'request.auth.token.platformAdmin == true',
  ],
  [
    'H04',
    'signedInWithGoogle ignores the e-mail',
    'request.auth.token.email_verified == true',
    'true',
  ],
  // PLAN 2.1: sign-in is with Google only, and since 2026-10-14 (PLAN §11) every read and write
  // of the data of an account or of a distributor demands a session of Google.
  [
    'I01',
    'signedInWithGoogle ignores how the session came in',
    " && request.auth.token.firebase.sign_in_provider == 'google.com'",
    '',
  ],
  [
    'I05',
    'the own data of an account with any session',
    'return signedInWithGoogle() && request.auth.uid == uid;',
    'return signedIn() && request.auth.uid == uid;',
  ],
  [
    'I06',
    'a role of a distributor with any session',
    'return signedInWithGoogle() && holdsRole(member(d), roles);',
    'return signedIn() && holdsRole(member(d), roles);',
  ],
  [
    'I07',
    'platform admin with any session',
    'return signedInWithGoogle()\n        && exists(/databases/$(database)/documents/platformAdmins',
    'return signedIn()\n        && exists(/databases/$(database)/documents/platformAdmins',
  ],
  [
    'I08',
    'control document read by its founder with any session',
    'allow get: if signedInWithGoogle()\n          && (resource.data.ownerUid == request.auth.uid || isStaff(d)',
    'allow get: if signedIn()\n          && (resource.data.ownerUid == request.auth.uid || isStaff(d)',
  ],
  [
    'I09',
    'private settings read by the founder with any session',
    'allow get: if signedInWithGoogle()\n          && (resource.data.ownerUid == request.auth.uid || isPlatformAdmin());',
    'allow get: if signedIn()\n          && (resource.data.ownerUid == request.auth.uid || isPlatformAdmin());',
  ],
  [
    'I10',
    'private settings edited by the founder with any session',
    'allow update: if signedInWithGoogle()\n          && resource.data.ownerUid == request.auth.uid',
    'allow update: if signedIn()\n          && resource.data.ownerUid == request.auth.uid',
  ],
  [
    'I11',
    'member document updated with any session',
    'allow update: if signedInWithGoogle()\n          && isValidMember',
    'allow update: if signedIn()\n          && isValidMember',
  ],
  [
    'I12',
    'private settings created with any session',
    'allow create: if signedInWithGoogle()\n          && isValidPrivateSettings',
    'allow create: if signedIn()\n          && isValidPrivateSettings',
  ],
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
  ['H15', 'text may end in white space', "|.*[\\\\s\\\\x0b\\\\pZ\\\\x{feff}]$')", "')"],
  ['H16', 'text may start with white space', "'(?s)^[\\\\s\\\\x0b\\\\pZ\\\\x{feff}].*|", "'(?s)"],
  [
    'H17',
    'schedule days may repeat',
    '\n        && schedule.days.toSet().size() == schedule.days.size()',
    '',
  ],
  ['H18', 'eighth brand unchecked', ' && isBrandAt(brands, 7)', ''],
  ['H19', 'no cap on owned distributors', ' && data.ownedDistributorIds.size() <= 3', ''],
  [
    'H20',
    'text has no upper bound',
    ' && value.size() <= max\n        && !value.matches(',
    '\n        && !value.matches(',
  ],
  ['H21', 'time of day without end anchor', "[0-5][0-9]$'", "[0-5][0-9]'"],
  [
    'H22',
    'brand colour without end anchor',
    "'^#[0-9a-f]{6}$')\n        && data.acceptingOrders",
    "'^#[0-9a-f]{6}')\n        && data.acceptingOrders",
  ],
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
    '[^\\\\p{Cc}\\\\p{Cf}]*)?[\\\\pL\\\\pN](?:',
    '[^\\\\p{Cc}\\\\p{Cf}]*)?[^\\\\p{Cc}\\\\p{Cf}](?:',
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
    "function isDistributorId(value) {\n      return value is string && value.matches('^[A-Za-z0-9]{20}$');",
    "function isDistributorId(value) {\n      return value is string && value.matches('^[A-Za-z0-9]+$');",
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
    'approval that keeps the mark of a note for the owner',
    "\n        && !('reviewNoteAt' in data)\n        && !('correctedAt' in data);",
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
    'mark of a review note of any type',
    "(!('reviewNoteAt' in data) || data.reviewNoteAt is timestamp)",
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
    "&& unchanged(['createdAt'])\n        && request.resource.data.updatedAt == request.time\n        // The name is",
    '&& request.resource.data.updatedAt == request.time\n        // The name is',
  ],
  [
    'U08',
    'profile updatedAt free',
    "&& unchanged(['createdAt'])\n        && request.resource.data.updatedAt == request.time\n        // The name is",
    "&& unchanged(['createdAt'])\n        // The name is",
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
    'allow create: if isSelf(uid)\n          && isAcceptanceEntry',
    'allow create: if signedInWithGoogle()\n          && isAcceptanceEntry',
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
    'slug by a session that is not Google with a verified e-mail',
    'allow create: if signedInWithGoogle()\n        && isSlug(slug)',
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
    'allow create: if signedInWithGoogle()\n        && isDistributorId(d)',
    'allow create: if signedInWithGoogle()\n        && isDocId(d)',
  ],
  [
    'D10',
    'distributor by a session that is not Google with a verified e-mail',
    'allow create: if signedInWithGoogle()\n        && isDistributorId(d)',
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
    "unchanged(['slug', 'currency', 'createdAt'])\n            && hasRole(d, ['owner'])",
    "unchanged(['currency', 'createdAt'])\n            && hasRole(d, ['owner'])",
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
    "unchanged(['slug', 'currency', 'createdAt'])\n            && hasRole(d, ['owner'])",
    "unchanged(['slug', 'currency'])\n            && hasRole(d, ['owner'])",
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
    "'distributorName', 'slug', 'updatedAt'\n              ])\n              && approvalIsSigned()",
    "'distributorName', 'slug', 'trialEndsAt', 'updatedAt'\n              ])\n              && approvalIsSigned()",
  ],
  [
    'C11',
    'admin changes the founder',
    "'distributorName', 'slug', 'updatedAt'\n              ])\n              && approvalIsSigned()",
    "'distributorName', 'slug', 'ownerUid', 'updatedAt'\n              ])\n              && approvalIsSigned()",
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
    'control by a session that is not Google with a verified e-mail',
    'allow create: if signedInWithGoogle()\n          && isValidControl',
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
    "\n          && request.resource.data.listingApproved == false\n          && !('reviewNoteAt' in request.resource.data)",
    "\n          && !('reviewNoteAt' in request.resource.data)",
  ],
  [
    'C20',
    'control founded with the mark of a note',
    "\n          && !('reviewNoteAt' in request.resource.data)",
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
    'function settingsEditAllowed(control) {\n          return isWritableData(control)\n            && (',
    'function settingsEditAllowed(control) {\n          return (',
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
    "              request.resource.data.role == 'owner'\n              && !('inviteId' in request.resource.data)",
    "              !('inviteId' in request.resource.data)",
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
    '              && foundedNow(d)\n            )\n            || joinsByInvitation()',
    '            )\n            || joinsByInvitation()',
  ],
  [
    'M07',
    'founding member with any distributor name',
    '&& request.resource.data.active == true\n          && carriesPublicName()',
    '&& request.resource.data.active == true',
  ],
  ['M09', 'owner changes itself', 'memberUid != request.auth.uid\n              && ', ''],
  [
    'M10',
    'staff managed while read-only, founder included',
    "&& hasRole(d, ['owner'])\n              && managesMember(memberUid)",
    "&& hasRole(d, ['owner'])",
  ],
  [
    'M11',
    'founder can be changed',
    'return isWritableData(control)\n            && control.ownerUid != uid\n',
    'return isWritableData(control)\n',
  ],
  [
    'M12',
    'staff managed while read-only',
    'return isWritableData(control)\n            && control.ownerUid != uid\n',
    'return control.ownerUid != uid\n',
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
    "&& hasRole(d, ['owner'])\n              && managesMember(memberUid)",
    '&& isStaff(d)\n              && managesMember(memberUid)',
  ],
  [
    'M18',
    'founding member for another account',
    'allow create: if isSelf(memberUid)\n          && isValidMember',
    'allow create: if signedInWithGoogle()\n          && isValidMember',
  ],
  [
    'M19',
    'name copy branch allows the role',
    "onlyChanges(['distributorName', 'updatedAt'])\n              && carriesPublicName()",
    "onlyChanges(['distributorName', 'role', 'active', 'updatedAt'])\n              && carriesPublicName()",
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
    '&& isVisibleText(request.resource.data.displayName, 1, 80)\n          && stampedNow(request.resource.data)',
    '&& isVisibleText(request.resource.data.displayName, 1, 80)',
  ],
  ['G01', 'memberships without limit', '\n        && request.query.limit <= 20', ''],
  ['G02', 'memberships of anyone', '\n        && resource.data.uid == request.auth.uid', ''],
  [
    'G03',
    'memberships for any session, or none',
    'allow list: if signedInWithGoogle()\n        && request.query.limit <= 20',
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
    "\n        && !('reviewNoteAt' in data)\n        && !('correctedAt' in data);",
    "\n        && !('reviewNoteAt' in data);",
  ],
  [
    'X08',
    'correction mark without a note beside it',
    "('reviewNoteAt' in data && data.correctedAt is timestamp)",
    'data.correctedAt is timestamp',
  ],
  [
    'X09',
    'correction mark of any type',
    "('reviewNoteAt' in data && data.correctedAt is timestamp)",
    "'reviewNoteAt' in data",
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
    "unchanged(['correctedAt', 'reviewNoteAt'])",
    "unchanged(['correctedAt'])",
  ],
  [
    'X12',
    'admin re-dates the correction mark',
    "unchanged(['correctedAt', 'reviewNoteAt'])",
    "unchanged(['reviewNoteAt'])",
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
  // PLAN 3.1: the catalogue, /distributors/{d}/products/{slot}.
  [
    'K01',
    'catalogue public while the distributor takes no orders',
    '\n            && get(distributorPath(d)).data.acceptingOrders == true;',
    ';',
  ],
  [
    'K02',
    'withdrawn products public',
    'return resource.data.active == true\n            && get(distributorPath(d))',
    'return true\n            && get(distributorPath(d))',
  ],
  [
    'K03',
    'catalogue listed without a limit',
    'allow list: if request.query.limit <= 30 && (isOnSale() || isStaff(d));',
    'allow list: if (isOnSale() || isStaff(d));',
  ],
  [
    'K04',
    'catalogue listed with a larger limit',
    'request.query.limit <= 30 && (isOnSale()',
    'request.query.limit <= 31 && (isOnSale()',
  ],
  [
    'K05',
    'whole catalogue read by any account',
    'allow get: if isOnSale() || isStaff(d);',
    'allow get: if isOnSale() || signedInWithGoogle();',
  ],
  [
    'K06',
    'product added by any staff',
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && writable(d)\n          && request.resource.data.currency",
    '&& isStaff(d)\n          && writable(d)\n          && request.resource.data.currency',
  ],
  [
    'K07',
    'price changed by any staff',
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && writable(d);\n\n        // No delete: orders",
    '&& isStaff(d)\n          && writable(d);\n\n        // No delete: orders',
  ],
  [
    'K08',
    'product added to a read-only distributor',
    '\n          && writable(d)\n          && request.resource.data.currency',
    '\n          && request.resource.data.currency',
  ],
  [
    'K09',
    'price changed in a read-only distributor',
    '\n          && writable(d);\n\n        // No delete: orders',
    ';\n\n        // No delete: orders',
  ],
  [
    'K10',
    'product in any currency',
    '\n          && request.resource.data.currency == get(distributorPath(d)).data.currency;',
    ';',
  ],
  [
    'K11',
    'product currency fixed to soles instead of the one of the distributor',
    'request.resource.data.currency == get(distributorPath(d)).data.currency;',
    "request.resource.data.currency == 'PEN';",
  ],
  ['K12', 'product under any id', '\n          && isProductSlot(productId)', ''],
  ['K13', 'more product slots', "'^p[0-2][0-9]$'", "'^p[0-9][0-9]$'"],
  [
    'K14',
    'product created with dates of the client',
    "\n          && stampedNow(request.resource.data)\n          && hasRole(d, ['owner', 'dispatcher'])\n          && writable(d)\n          && request.resource.data.currency",
    "\n          && hasRole(d, ['owner', 'dispatcher'])\n          && writable(d)\n          && request.resource.data.currency",
  ],
  [
    'K15',
    'weight of a product changed',
    "unchanged(['weightKg', 'currency', 'createdAt'])",
    "unchanged(['currency', 'createdAt'])",
  ],
  [
    'K16',
    'currency of a product changed',
    "unchanged(['weightKg', 'currency', 'createdAt'])",
    "unchanged(['weightKg', 'createdAt'])",
  ],
  [
    'K17',
    'creation date of a product changed',
    "unchanged(['weightKg', 'currency', 'createdAt'])",
    "unchanged(['weightKg', 'currency'])",
  ],
  [
    'K18',
    'product edited without moving its update date',
    "unchanged(['weightKg', 'currency', 'createdAt'])\n          && request.resource.data.updatedAt == request.time\n",
    "unchanged(['weightKg', 'currency', 'createdAt'])\n",
  ],
  [
    'K19',
    'full cylinder at or below the refill price',
    ' && data.fullPriceCents > data.refillPriceCents',
    '',
  ],
  [
    'K20',
    'price that is not whole cents',
    'return value is int && value >= 1 && value <= 99900;',
    'return value is number && value >= 1 && value <= 99900;',
  ],
  ['K21', 'price of zero', 'value is int && value >= 1 &&', 'value is int && value >= 0 &&'],
  ['K22', 'price above the sanity cap', 'value <= 99900;', 'value <= 999900;'],
  [
    'K23',
    'full price not validated',
    '(isPriceCents(data.fullPriceCents) && data.fullPriceCents',
    '(data.fullPriceCents',
  ],
  ['K24', 'weight of zero', 'data.weightKg >= 1', 'data.weightKg >= 0'],
  ['K25', 'weight above the cap', 'data.weightKg <= 100', 'data.weightKg <= 1000'],
  ['K26', 'weight with decimals', 'data.weightKg is int', 'data.weightKg is number'],
  [
    'K27',
    'brand colour of any shape',
    "(data.brandColor is string && data.brandColor.matches('^#[0-9a-f]{6}$'))",
    '(data.brandColor is string)',
  ],
  ['K28', 'negative position', 'data.sortOrder >= 0 && ', ''],
  ['K29', 'position above the cap', 'data.sortOrder <= 999', 'data.sortOrder <= 9999'],
  [
    'K30',
    'one-letter product name',
    'isVisibleText(data.name, 2, 60)',
    'isVisibleText(data.name, 1, 60)',
  ],
  [
    'K31',
    'product without a brand',
    'isVisibleText(data.brand, 1, 30)',
    'isVisibleText(data.brand, 0, 30)',
  ],
  [
    'K32',
    'product with fields of its own',
    "&& data.keys().hasOnly([\n          'brand',",
    "&& data.keys().hasAll([\n          'brand',",
  ],
  // PLAN 3.5 (§11, 2026-10-16): promotions and the price lock of a product.
  [
    'F01',
    'promotions public while the distributor takes no orders',
    'return get(distributorPath(d)).data.acceptingOrders == true\n            && resource.data.active == true;',
    'return resource.data.active == true;',
  ],
  [
    'F02',
    'unpublished promotions public',
    '&& resource.data.active == true;\n        }\n\n        function isOver',
    ';\n        }\n\n        function isOver',
  ],
  [
    'F03',
    'promotions listed without a limit',
    'allow list: if request.query.limit <= 20 && (isPublished()',
    'allow list: if (isPublished()',
  ],
  [
    'F04',
    'promotions read by any account',
    'allow get: if isPublished() || isStaff(d);',
    'allow get: if isPublished() || signedInWithGoogle();',
  ],
  [
    'F05',
    'promotion added by any staff',
    "&& isNewPromotion(request.resource.data)\n          && hasRole(d, ['owner', 'dispatcher'])",
    '&& isNewPromotion(request.resource.data)\n          && isStaff(d)',
  ],
  [
    'F06',
    'promotion changed by any staff',
    "allow update: if isValidPromotion(request.resource.data)\n          && hasRole(d, ['owner', 'dispatcher'])",
    'allow update: if isValidPromotion(request.resource.data)\n          && isStaff(d)',
  ],
  [
    'F07',
    'promotion added while read-only',
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && writable(d);\n\n        // A slot whose",
    "&& hasRole(d, ['owner', 'dispatcher']);\n\n        // A slot whose",
  ],
  [
    'F08',
    'promotion changed while read-only',
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && writable(d)\n          && (\n            (isOver()",
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && (\n            (isOver()",
  ],
  ['F09', 'promotion under any id', "promotionId.matches('^o[0-1][0-9]$')\n          && ", ''],
  ['F10', 'more promotion slots', "'^o[0-1][0-9]$'", "'^o[0-2][0-9]$'"],
  [
    'F11',
    'live promotion overwritten',
    'return resource.data.active == false || resource.data.endsAt <= request.time;',
    'return true;',
  ],
  [
    'F12',
    'promotion created with dates of the client',
    'return isValidPromotion(data)\n            && stampedNow(data)',
    'return isValidPromotion(data)',
  ],
  ['F13', 'promotion in the name of another', '&& data.createdBy == request.auth.uid\n', '\n'],
  ['F14', 'promotion born with units sold', '&& data.soldUnits == 0\n', '\n'],
  [
    'F15',
    'promotion born switched off',
    '&& data.switchedOffBy == null\n            && data.switchedOffAt == null\n',
    '\n',
  ],
  ['F16', 'promotion starting in the past', '&& data.startsAt >= request.time\n', '\n'],
  [
    'F17',
    'promotion scheduled too far ahead',
    "&& data.startsAt <= request.time + duration.value(30, 'd')",
    '',
  ],
  ['F18', 'promotion ending before it starts', '&& data.endsAt > data.startsAt\n', '\n'],
  [
    'F19',
    'promotion longer than 30 days',
    "&& data.endsAt <= data.startsAt + duration.value(30, 'd');",
    ';',
  ],
  ['F20', 'promotion shortened', '&& request.resource.data.endsAt >= resource.data.endsAt', ''],
  [
    'F21',
    'promotion extended beyond 30 days',
    "&& request.resource.data.endsAt <= resource.data.startsAt + duration.value(30, 'd');",
    ';',
  ],
  [
    'F22',
    'ended or switched-off promotion edited',
    '&& resource.data.switchedOffAt == null\n              && resource.data.endsAt > request.time\n',
    '\n',
  ],
  [
    'F23',
    'edit without moving its date',
    'request.resource.data.updatedAt == request.time\n              && resource.data.switchedOffAt',
    'resource.data.switchedOffAt',
  ],
  [
    'F24',
    'switch-off without its author',
    '&& request.resource.data.switchedOffBy == request.auth.uid\n',
    '\n',
  ],
  [
    'F25',
    'switch-off with any time',
    '&& request.resource.data.switchedOffAt == request.time;',
    ';',
  ],
  [
    'F26',
    'more changed while renaming',
    "onlyChanges(['title', 'endsAt', 'updatedAt'])",
    "onlyChanges(['title', 'endsAt', 'updatedAt', 'priceCents', 'productIds'])",
  ],
  [
    'F27',
    'unpublished silently',
    "onlyChanges(['active', 'updatedAt'])\n            && resource.data.active == false\n            && request.resource.data.active == true",
    "onlyChanges(['active', 'updatedAt'])",
  ],
  [
    'F28',
    'promotion without a visible title',
    'isVisibleText(data.title, 1, 40)',
    'data.title is string',
  ],
  [
    'F29',
    'promotion on a product twice',
    '&& data.productIds.toSet().size() == data.productIds.size()',
    '',
  ],
  [
    'F30',
    'promotion on any product id',
    "&& data.productIds.hasOnly([\n          'p00'",
    "&& data.productIds.hasAny([\n          'p00'",
  ],
  ['F31', 'promotion with no product', '&& data.productIds.size() >= 1\n', '\n'],
  ['F32', 'any way of selling', "&& data.saleMode in ['refill', 'full']", ''],
  [
    'F33',
    'more units per order',
    'data.maxUnitsPerOrder >= 1 && data.maxUnitsPerOrder <= 20',
    'data.maxUnitsPerOrder >= 0 && data.maxUnitsPerOrder <= 21',
  ],
  [
    'F34',
    'any total cap',
    '(data.totalUnits is int && data.totalUnits >= 1 && data.totalUnits <= 9999)',
    '(data.totalUnits is number)',
  ],
  ['F35', 'conditions with blocked phrases', '&& !value.lower()', '&& value.lower()'],
  ['F36', 'blocked phrases without accents folded', ".replace('[úùûüÚÙÛÜ]', 'u')", ''],
  [
    'F37',
    'fields of another kind',
    "hasExactly(data, promotionKeys(['percent']))",
    "data.keys().hasAll(promotionKeys(['percent']))",
  ],
  ['F38', 'special price on many products', '&& data.productIds.size() == 1\n', '\n'],
  [
    'F39',
    'special price not validated',
    "(data.priceSource == 'own' && isPriceCents(data.priceCents))",
    "(data.priceSource == 'own')",
  ],
  [
    'F40',
    'price of gas on a refill',
    "&& data.saleMode == 'full'\n              && data.maxUnitsPerOrder == 1",
    '&& data.maxUnitsPerOrder == 1',
  ],
  [
    'F41',
    'price of gas more than once per order',
    "&& data.saleMode == 'full'\n              && data.maxUnitsPerOrder == 1",
    "&& data.saleMode == 'full'",
  ],
  [
    'F42',
    'price of gas without a total cap',
    '&& data.maxUnitsPerOrder == 1\n              && data.totalUnits != null',
    '&& data.maxUnitsPerOrder == 1',
  ],
  [
    'F43',
    'percentage above 30',
    'data.percent >= 1 && data.percent <= 30',
    'data.percent >= 0 && data.percent <= 100',
  ],
  ['F44', 'amount not validated', '&& isPriceCents(data.amountCents)', ''],
  [
    'F45',
    'any buy-pay pair',
    '(data.buyUnits == 2 && data.payUnits == 1)\n            || (data.buyUnits == 3 && data.payUnits == 2)',
    'data.buyUnits is int',
  ],
  [
    'F46',
    '2x1 without a total cap',
    '&& data.totalUnits != null\n          && data.maxUnitsPerOrder % data.buyUnits == 0',
    '&& data.maxUnitsPerOrder % data.buyUnits == 0',
  ],
  ['F47', '2x1 with a cap not a multiple', '&& data.maxUnitsPerOrder % data.buyUnits == 0', ''],
  ['F48', 'price raised while locked', '&& after.refillPriceCents <= before.refillPriceCents', ''],
  [
    'F49',
    'full price raised while locked',
    '|| (after.fullPriceCents != null && after.fullPriceCents <= before.fullPriceCents)',
    '|| true',
  ],
  [
    'F50',
    'lock moved earlier',
    "after.get('promotedUntil', request.time) >= before.promotedUntil\n              && ",
    '',
  ],
  ['F51', 'lock ignored', '&& keepsPromotionLock(resource.data, request.resource.data)', ''],
  [
    'F52',
    'lock too far ahead',
    "&& data.promotedUntil <= request.time + duration.value(60, 'd')",
    '',
  ],
  ['F53', 'lock of any type', 'data.promotedUntil is timestamp\n', 'true\n'],
  [
    'K33',
    '"on sale" that is not a boolean',
    '\n        && data.active is bool\n        && data.sortOrder',
    '\n        && data.sortOrder',
  ],
  ['K34', 'position with decimals', 'data.sortOrder is int', 'data.sortOrder is number'],
  // Attacks on the catalogue and on its copy in the public profile (attack-catalog).
  [
    'K35',
    'on sale read as "not withdrawn"',
    'return resource.data.active == true\n            && get(distributorPath(d))',
    'return resource.data.active != false\n            && get(distributorPath(d))',
  ],
  [
    'K36',
    '"from" price of zero in the public profile',
    'data.priceFromCents is int && data.priceFromCents >= 1',
    'data.priceFromCents is int && data.priceFromCents >= 0',
  ],
  [
    'K37',
    '"from" price above the cap in the public profile',
    'data.priceFromCents <= 99900))',
    'data.priceFromCents <= 999900))',
  ],
  [
    'K38',
    '"from" price with decimals in the public profile',
    '(data.priceFromCents is int &&',
    '(data.priceFromCents is number &&',
  ],
  ['K39', 'more brands than are checked', 'brands.size() <= 8', 'brands.size() <= 9'],
  // PLAN §11, 2026-10-15: the dispatcher edits the catalogue and its copy in the profile.
  [
    'K40',
    'catalogue copy rewritten by the dispatcher as it stands',
    "\n            && !unchanged(['brands', 'priceFromCents', 'priceFromWeightKg'])",
    '',
  ],
  [
    'K41',
    'catalogue copy written by any staff',
    "&& !unchanged(['brands', 'priceFromCents', 'priceFromWeightKg'])\n            && hasRole(d, ['dispatcher'])",
    "&& !unchanged(['brands', 'priceFromCents', 'priceFromWeightKg'])\n            && isStaff(d)",
  ],
  [
    'K42',
    'catalogue copy written by the dispatcher while read-only',
    "&& hasRole(d, ['dispatcher'])\n            && writable(d)\n          )",
    "&& hasRole(d, ['dispatcher'])\n          )",
  ],
  [
    'K44',
    'product added by the owner only (the dispatcher refused)',
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && writable(d)\n          && request.resource.data.currency",
    "&& hasRole(d, ['owner'])\n          && writable(d)\n          && request.resource.data.currency",
  ],
  [
    'K45',
    'price changed by the owner only (the dispatcher refused)',
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && writable(d);\n\n        // No delete: orders",
    "&& hasRole(d, ['owner'])\n          && writable(d);\n\n        // No delete: orders",
  ],
  [
    'K43',
    'dispatcher edits more of the profile with the copy',
    "onlyChanges(['brands', 'priceFromCents', 'priceFromWeightKg', 'updatedAt'])",
    "onlyChanges(['brands', 'priceFromCents', 'priceFromWeightKg', 'coverageRadiusKm', 'acceptingOrders', 'updatedAt'])",
  ],
  // PLAN §11, 2026-10-15 (corrections after the reviews of phase 3): names the staff reads are
  // visible text when written (Q01–Q06), the copies an invitation carries (Q07–Q11), the weight
  // of the "desde" price (Q12–Q16, Q24, Q25), the link to the complaints book (Q17–Q23) and the owner whitelist (Q26).
  [
    'Q01',
    'profile created with an invisible name',
    '\n        && isVisibleText(request.resource.data.displayName, 1, 80)\n        && request.resource.data.ownedDistributorIds.size() == 0',
    '\n        && request.resource.data.ownedDistributorIds.size() == 0',
  ],
  [
    'Q02',
    'profile renamed to an invisible name',
    "&& (unchanged(['displayName']) || isVisibleText(request.resource.data.displayName, 1, 80))\n        // A text",
    '// A text',
  ],
  [
    'Q03',
    'a profile stored with an invisible name can no longer be edited',
    "&& (unchanged(['displayName']) || isVisibleText(request.resource.data.displayName, 1, 80))\n        // A text",
    '&& isVisibleText(request.resource.data.displayName, 1, 80)\n        // A text',
  ],
  [
    'Q04',
    'member created with an invisible name',
    '\n          && isVisibleText(request.resource.data.displayName, 1, 80)\n          && stampedNow(request.resource.data)\n          && request.resource.data.active == true',
    '\n          && stampedNow(request.resource.data)\n          && request.resource.data.active == true',
  ],
  [
    'Q05',
    'member renamed to an invisible name',
    "\n              && (unchanged(['displayName'])\n                || isVisibleText(request.resource.data.displayName, 1, 80))",
    '',
  ],
  [
    'Q06',
    'a member stored with an invisible name can no longer be switched off',
    "\n              && (unchanged(['displayName'])\n                || isVisibleText(request.resource.data.displayName, 1, 80))",
    '\n              && isVisibleText(request.resource.data.displayName, 1, 80)',
  ],
  ['Q07', 'invitation with any brand colour', 'invite.brandColor == profile.brandColor', 'true'],
  [
    'Q08',
    'invitation in the name of anyone',
    'invite.invitedByName == member(d).displayName',
    'true',
  ],
  [
    'Q09',
    'invitation in an invisible name',
    '\n                && isVisibleText(invite.invitedByName, 1, 80)',
    '',
  ],
  [
    'Q10',
    'copies of an invitation not checked',
    '\n          && copiesHold(request.resource.data, get(distributorPath(d)).data)',
    '',
  ],
  [
    'Q11',
    'invitation with extra fields',
    "'role', 'email', 'distributorName', 'invitedByName', 'brandColor', 'status',",
    "'role', 'email', 'distributorName', 'invitedByName', 'brandColor', 'status', 'invitedByPhone',",
  ],
  [
    'Q12',
    'weight above the cap',
    'value is int && value <= 100 &&',
    'value is int && value <= 1000 &&',
  ],
  ['Q13', 'weight of zero', 'value <= 100 && value >= 1;', 'value <= 100 && value >= 0;'],
  ['Q14', 'weight with decimals', 'return value is int && value <= 100', 'return value <= 100'],
  ['Q15', 'weight not validated', '|| isWeightKg(data.priceFromWeightKg))', '|| true)'],
  [
    'Q16',
    'founding with a weight',
    "\n        && request.resource.data.get('priceFromWeightKg', null) == null",
    '',
  ],
  [
    'Q17',
    'complaints book not validated',
    '|| isComplaintsBookUrl(data.complaintsBookUrl))',
    '|| true)',
  ],
  ['Q18', 'complaints book ten times longer', 'value.size() <= 300', 'value.size() <= 3000'],
  [
    'Q19',
    'complaints book over plain http',
    "value.matches('https://[a-z0-9]",
    "value.matches('https?://[a-z0-9]",
  ],
  [
    'Q20',
    'complaints book with any character after the host',
    "(/[A-Za-z0-9._~%!$&()*+,;=:@/?#-]*)?')",
    "(/.*)?')",
  ],
  [
    'Q21',
    'complaints book with a host in capitals',
    "'https://[a-z0-9]([a-z0-9-]*[a-z0-9])?",
    "'https://[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?",
  ],
  [
    'Q22',
    'complaints book on a host without a dot',
    '([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)+(/',
    '([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)*(/',
  ],
  // PLAN §11, 2026-10-16: no punycode label in the host of the complaints book.
  [
    'Q27',
    'complaints book on a host in punycode',
    "\n        && !value.matches('https://([a-z0-9-]+[.])*xn--.*')",
    '',
  ],
  [
    'Q28',
    'complaints book with punycode past the first label',
    "!value.matches('https://([a-z0-9-]+[.])*xn--.*')",
    "!value.matches('https://xn--.*')",
  ],
  [
    'Q23',
    'complaints book written by the dispatcher',
    "onlyChanges(['brands', 'priceFromCents', 'priceFromWeightKg', 'updatedAt'])",
    "onlyChanges(['brands', 'priceFromCents', 'priceFromWeightKg', 'complaintsBookUrl', 'updatedAt'])",
  ],
  [
    'Q24',
    'dispatcher cannot write the weight',
    "onlyChanges(['brands', 'priceFromCents', 'priceFromWeightKg', 'updatedAt'])",
    "onlyChanges(['brands', 'priceFromCents', 'updatedAt'])",
  ],
  [
    'Q25',
    'dispatcher cannot write the weight alone',
    "&& !unchanged(['brands', 'priceFromCents', 'priceFromWeightKg'])",
    "&& !unchanged(['brands', 'priceFromCents'])",
  ],
  [
    'Q26',
    'owner changes the currency',
    "unchanged(['slug', 'currency', 'createdAt'])\n            && hasRole(d, ['owner'])",
    "unchanged(['slug', 'createdAt'])\n            && hasRole(d, ['owner'])",
  ],
  // PLAN 3.2: visible text (V0x), the text of the review note (V1x), invitations (N), joining
  // with one (J), managing the staff (M3x) and helpers (W).
  [
    'V01',
    'visible text with invisible characters before its letter',
    "'^(?:[^\\\\pZ\\\\p{Cc}\\\\p{Cf}][^\\\\p{Cc}\\\\p{Cf}]*)?",
    "'^(?:.*)?",
  ],
  [
    'V02',
    'visible text with invisible characters after its letter',
    "(?:[^\\\\p{Cc}\\\\p{Cf}]*[^\\\\pZ\\\\p{Cc}\\\\p{Cf}])?$'",
    "(?:.*)?$'",
  ],
  [
    'V03',
    'brand of the public profile only trimmed',
    'brands.size() <= index || isVisibleText(brands[index], 1, 30)',
    'brands.size() <= index || isText(brands[index], 1, 30)',
  ],
  [
    'V04',
    'product brand only trimmed',
    'isVisibleText(data.brand, 1, 30)',
    'isText(data.brand, 1, 30)',
  ],
  [
    'V05',
    'product name only trimmed',
    'isVisibleText(data.name, 2, 60)',
    'isText(data.name, 2, 60)',
  ],
  [
    'V06',
    'distributor name only trimmed',
    'return isVisibleText(value, 2, 60);',
    'return isText(value, 2, 60);',
  ],
  [
    'V07',
    'helper name only trimmed',
    'isVisibleText(data.name, 1, 60)',
    'isText(data.name, 1, 60)',
  ],
  [
    'V08',
    'visible text without an upper bound',
    "value is string && value.size() >= min && value.size() <= max\n        && value.matches('^(?:",
    "value is string && value.size() >= min\n        && value.matches('^(?:",
  ],
  [
    'V10',
    'any staff reads the note',
    'get(controlPath(d)).data.ownerUid == request.auth.uid || isPlatformAdmin()',
    'isStaff(d) || isPlatformAdmin()',
  ],
  [
    'V11',
    'anyone writes the note',
    "allow create, update: if isPlatformAdmin()\n          && hasExactly(request.resource.data, ['note', 'writtenAt'])",
    "allow create, update: if signedInWithGoogle()\n          && hasExactly(request.resource.data, ['note', 'writtenAt'])",
  ],
  [
    'V12',
    'note of any size',
    'isText(request.resource.data.note, 1, 300)',
    'request.resource.data.note is string',
  ],
  [
    'V13',
    'note dated by the client',
    '\n          && request.resource.data.writtenAt == request.time\n          && getAfter(controlPath(d))',
    '\n          && getAfter(controlPath(d))',
  ],
  [
    'V14',
    'note written without its mark',
    "\n          && getAfter(controlPath(d)).data.get('reviewNoteAt', null) == request.time;",
    ';',
  ],
  [
    'V15',
    'note deleted while its mark stays',
    "allow delete: if isPlatformAdmin()\n          && !('reviewNoteAt' in getAfter(controlPath(d)).data);",
    'allow delete: if isPlatformAdmin();',
  ],
  [
    'V16',
    'anyone deletes the note',
    "allow delete: if isPlatformAdmin()\n          && !('reviewNoteAt'",
    "allow delete: if signedInWithGoogle()\n          && !('reviewNoteAt'",
  ],
  [
    'V17',
    'mark of a note without its text',
    '\n              && getAfter(reviewPath(d)).data.writtenAt == request.time',
    '',
  ],
  [
    'V18',
    'mark of a note of any date',
    'request.resource.data.reviewNoteAt == request.time\n              && getAfter(reviewPath(d))',
    'true\n              && getAfter(reviewPath(d))',
  ],
  [
    'V19',
    'admin decision that skips the text of the note',
    '\n              && writesNoteWithItsText()',
    '',
  ],
  [
    'V20',
    'note with extra fields',
    "hasExactly(request.resource.data, ['note', 'writtenAt'])",
    'true',
  ],
  [
    'N01',
    'invitation read under any id',
    'allow get: if signedInWithGoogle()\n          && isInviteCode(code)\n',
    'allow get: if signedInWithGoogle()\n',
  ],
  [
    'N02',
    'invitation read without a session of Google',
    'allow get: if signedInWithGoogle()\n          && isInviteCode(code)\n',
    'allow get: if isInviteCode(code)\n',
  ],
  [
    'N03',
    'any staff lists the invitations',
    "allow list: if request.query.limit <= 50 && hasRole(d, ['owner']);",
    'allow list: if request.query.limit <= 50 && isStaff(d);',
  ],
  [
    'N04',
    'invitations listed past the cap',
    "allow list: if request.query.limit <= 50 && hasRole(d, ['owner']);",
    "allow list: if request.query.limit <= 500 && hasRole(d, ['owner']);",
  ],
  [
    'N05',
    'invitation created under any id',
    'allow create: if isInviteCode(code)\n          && isNewInvite',
    'allow create: if isNewInvite',
  ],
  [
    'N06',
    'invitation for any role',
    "\n        && data.role in ['owner', 'dispatcher', 'driver']\n        && (data.email == null",
    '\n        && data.role is string\n        && (data.email == null',
  ],
  [
    'N07',
    'invitation address unchecked',
    '(data.email == null || isInviteEmail(data.email))',
    'true',
  ],
  ['N08', 'invitation address in capitals', '\n        && value == value.lower();', ';'],
  [
    'N09',
    'invitation address of any shape',
    "value.matches('^[^@\\\\s]+@[^@\\\\s]+[.][^@\\\\s]+$')",
    'true',
  ],
  [
    'N10',
    'invitation address of any length',
    'value is string && value.size() <= 254',
    'value is string',
  ],
  [
    'N11',
    'invitation created as already used',
    "\n        && data.status == 'pending'\n        && data.createdBy",
    '\n        && data.createdBy',
  ],
  [
    'N12',
    'invitation in the name of another owner',
    '\n        && data.createdBy == request.auth.uid;',
    ';',
  ],
  [
    'N13',
    'invitation dated by the client',
    '&& isNewInvite(request.resource.data)\n          && stampedNow(request.resource.data)',
    '&& isNewInvite(request.resource.data)',
  ],
  [
    'N14',
    'any staff invites',
    "&& stampedNow(request.resource.data)\n          && hasRole(d, ['owner'])\n          && request.resource.data.distributorName",
    '&& stampedNow(request.resource.data)\n          && isStaff(d)\n          && request.resource.data.distributorName',
  ],
  [
    'N15',
    'invitation with another distributor name',
    '\n          && request.resource.data.distributorName == get(distributorPath(d)).data.name',
    '',
  ],
  [
    'N16',
    'invitation while read-only',
    "return isWritableData(control)\n            && (\n              request.resource.data.role != 'owner'",
    "return (\n              request.resource.data.role != 'owner'",
  ],
  [
    'N17',
    'a co-owner invites an owner',
    'control.ownerUid == request.auth.uid && request.resource.data.email != null',
    'request.resource.data.email != null',
  ],
  [
    'N18',
    'owner invitation for any account',
    'control.ownerUid == request.auth.uid && request.resource.data.email != null',
    'control.ownerUid == request.auth.uid',
  ],
  [
    'N19',
    'used or revoked invitation changed again',
    "allow update: if resource.data.status == 'pending'",
    'allow update: if true',
  ],
  [
    'N20',
    'invitation changed without moving its date',
    "allow update: if resource.data.status == 'pending'\n          && request.resource.data.updatedAt == request.time",
    "allow update: if resource.data.status == 'pending'",
  ],
  [
    'N21',
    'invitation used in the name of another account',
    '\n              && request.resource.data.acceptedBy == request.auth.uid\n',
    '\n',
  ],
  [
    'N22',
    'invitation used with a date of the client',
    '\n              && request.resource.data.acceptedAt == request.time\n',
    '\n',
  ],
  [
    'N23',
    'invitation used without creating the member',
    '\n              && getAfter(/databases/$(database)/documents/distributors/$(d)/members/$(request.auth.uid)).data.inviteId == code',
    '',
  ],
  [
    'N24',
    'invitation used and changed on the way',
    "onlyChanges(['status', 'acceptedBy', 'acceptedAt', 'email', 'updatedAt'])",
    "onlyChanges(['status', 'acceptedBy', 'acceptedAt', 'email', 'role', 'createdAt', 'updatedAt'])",
  ],
  [
    'N25',
    'invitation "used" into any status',
    "\n              && request.resource.data.status == 'accepted'\n",
    '\n',
  ],
  [
    'N26',
    'any staff revokes',
    "&& request.resource.data.revokedAt == request.time\n              && hasRole(d, ['owner'])",
    '&& request.resource.data.revokedAt == request.time\n              && isStaff(d)',
  ],
  [
    'N27',
    'revoked in the name of another owner',
    '\n              && request.resource.data.revokedBy == request.auth.uid\n',
    '\n',
  ],
  [
    'N28',
    'revocation that changes more',
    "onlyChanges(['status', 'revokedBy', 'revokedAt', 'updatedAt'])",
    "onlyChanges(['status', 'revokedBy', 'revokedAt', 'role', 'createdAt', 'updatedAt'])",
  ],
  [
    'N29',
    'copy of the name rewritten to any name',
    '\n              && request.resource.data.distributorName == getAfter(distributorPath(d)).data.name\n',
    '\n',
  ],
  [
    'N30',
    'any staff rewrites the copy of the name',
    "&& request.resource.data.distributorName == getAfter(distributorPath(d)).data.name\n              && hasRole(d, ['owner'])",
    '&& request.resource.data.distributorName == getAfter(distributorPath(d)).data.name\n              && isStaff(d)',
  ],
  [
    'N31',
    'rewrite of the copy that changes more',
    "onlyChanges(['distributorName', 'updatedAt'])\n              && request.resource.data.distributorName",
    "onlyChanges(['distributorName', 'status', 'role', 'createdAt', 'updatedAt'])\n              && request.resource.data.distributorName",
  ],
  [
    'N32',
    'revoked into any status',
    "\n              && request.resource.data.status == 'revoked'\n",
    '\n',
  ],
  [
    'J01',
    'member joins naming a code of any shape',
    'return isInviteCode(code)\n            && usesInvitation',
    'return usesInvitation',
  ],
  [
    'J02',
    'member joins a read-only distributor',
    '\n            && writable(d)\n            && stillVouchedFor',
    '\n            && stillVouchedFor',
  ],
  [
    'J03',
    'member joins with a name that is not its profile',
    '\n            && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.displayName\n              == request.resource.data.displayName',
    '',
  ],
  [
    'J04',
    'invitation never expires',
    "\n            && before.createdAt + duration.value(7, 'd') > request.time",
    '',
  ],
  ['J05', 'invitation lasts ten times longer', "duration.value(7, 'd')", "duration.value(70, 'd')"],
  [
    'J06',
    'member joins with another role than the invitation',
    '\n            && before.role == request.resource.data.role',
    '',
  ],
  [
    'J07',
    'invitation tied to an address works for any account',
    '\n            && (before.email == null || before.email == request.auth.token.email.lower())',
    '',
  ],
  [
    'J08',
    'used or revoked invitation still lets in',
    "return before.status == 'pending'\n",
    'return true\n',
  ],
  [
    'J09',
    'member joins without using the invitation up',
    "\n            && after.status == 'accepted'\n            && after.acceptedBy == request.auth.uid;",
    ';',
  ],
  [
    'J10',
    'invitation used up by another account',
    '\n            && after.acceptedBy == request.auth.uid;',
    ';',
  ],
  [
    'J11',
    'founder member that names an invitation',
    "\n              && !('inviteId' in request.resource.data)",
    '',
  ],
  [
    'J12',
    'address compared as typed',
    'before.email == request.auth.token.email.lower()',
    'before.email == request.auth.token.email',
  ],
  // PLAN §11 (2026-10-16): an invitation works only while who created it is an active owner.
  [
    'J13',
    'invitation keeps working after its author stops being an owner',
    '\n            && stillVouchedFor(get(invite).data)',
    '',
  ],
  [
    'J14',
    'invitation of an owner switched off still lets in',
    "return holdsRole(\n              get(/databases/$(database)/documents/distributors/$(d)/members/$(invite.createdBy)).data,\n              ['owner']\n            )",
    "return get(/databases/$(database)/documents/distributors/$(d)/members/$(invite.createdBy)).data.role == 'owner'",
  ],
  [
    'J15',
    'invitation of an owner demoted still lets in',
    "return holdsRole(\n              get(/databases/$(database)/documents/distributors/$(d)/members/$(invite.createdBy)).data,\n              ['owner']\n            )",
    'return get(/databases/$(database)/documents/distributors/$(d)/members/$(invite.createdBy)).data.active == true',
  ],
  [
    'J16',
    'invitation of an account that is no longer staff still lets in',
    "return holdsRole(\n              get(/databases/$(database)/documents/distributors/$(d)/members/$(invite.createdBy)).data,\n              ['owner']\n            )",
    'return true',
  ],
  [
    'J17',
    'invitation to an owner from a co-owner lets in',
    "\n            && (invite.role != 'owner' || invite.createdBy == get(controlPath(d)).data.ownerUid);",
    ';',
  ],
  // PLAN §11, 2026-10-16: the address of an invitation is read only by its account and an
  // owner, and using the invitation clears it.
  [
    'J18',
    'invitation tied to an address read by anyone with the link',
    "resource.data.email == null\n            || resource.data.email == request.auth.token.email.lower()\n            || hasRole(d, ['owner'])",
    'true',
  ],
  [
    'J19',
    'invitation tied to an address read by any staff',
    "|| resource.data.email == request.auth.token.email.lower()\n            || hasRole(d, ['owner'])",
    '|| resource.data.email == request.auth.token.email.lower()\n            || isStaff(d)',
  ],
  [
    'J20',
    'address of the reader compared as typed',
    'resource.data.email == request.auth.token.email.lower()',
    'resource.data.email == request.auth.token.email',
  ],
  [
    'J21',
    'invitation used keeping the address',
    '\n              && request.resource.data.email == null\n',
    '\n',
  ],
  [
    'J22',
    'invitation used rewriting the address',
    '\n              && request.resource.data.email == null\n',
    "\n              && request.resource.data.email != 'x'\n",
  ],
  [
    'M30',
    'a co-owner manages owners',
    "|| (resource.data.role != 'owner' && request.resource.data.role != 'owner')",
    '|| true',
  ],
  ['M31', 'a co-owner makes owners', " && request.resource.data.role != 'owner')", ')'],
  [
    'M32',
    'a co-owner demotes or switches off owners',
    "|| (resource.data.role != 'owner' && ",
    '|| (',
  ],
  [
    'M33',
    'the founder cannot manage owners',
    'control.ownerUid == request.auth.uid\n              || (resource.data.role',
    'false\n              || (resource.data.role',
  ],
  ['W01', 'helper in any slot', "helperId.matches('^h[0-2][0-9]$')", 'helperId is string'],
  [
    'W02',
    'anyone reads the helpers',
    'allow get: if isStaff(d);\n        allow list: if request.query.limit <= 30 && isStaff(d);',
    'allow get: if signedInWithGoogle();\n        allow list: if request.query.limit <= 30 && signedInWithGoogle();',
  ],
  [
    'W03',
    'helpers listed past the cap',
    'allow list: if request.query.limit <= 30 && isStaff(d);',
    'allow list: if request.query.limit <= 300 && isStaff(d);',
  ],
  [
    'W04',
    'helper created with dates of the client',
    '&& isValidHelper(request.resource.data)\n          && stampedNow(request.resource.data)',
    '&& isValidHelper(request.resource.data)',
  ],
  [
    'W05',
    'any staff adds helpers',
    "&& stampedNow(request.resource.data)\n          && hasRole(d, ['owner'])\n          && writable(d);\n\n        // Reads added by rules: 2 (get member, get control).\n        allow update: if isValidHelper",
    '&& stampedNow(request.resource.data)\n          && isStaff(d)\n          && writable(d);\n\n        // Reads added by rules: 2 (get member, get control).\n        allow update: if isValidHelper',
  ],
  [
    'W06',
    'helper added while read-only',
    "&& hasRole(d, ['owner'])\n          && writable(d);\n\n        // Reads added by rules: 2 (get member, get control).\n        allow update: if isValidHelper",
    "&& hasRole(d, ['owner']);\n\n        // Reads added by rules: 2 (get member, get control).\n        allow update: if isValidHelper",
  ],
  [
    'W07',
    'helper edited without keeping its creation date',
    "allow update: if isValidHelper(request.resource.data)\n          && unchanged(['createdAt'])",
    'allow update: if isValidHelper(request.resource.data)',
  ],
  [
    'W08',
    'helper edited without moving its date',
    "&& unchanged(['createdAt'])\n          && request.resource.data.updatedAt == request.time\n          && hasRole(d, ['owner'])",
    "&& unchanged(['createdAt'])\n          && hasRole(d, ['owner'])",
  ],
  [
    'W09',
    'any staff edits helpers',
    "&& request.resource.data.updatedAt == request.time\n          && hasRole(d, ['owner'])\n          && writable(d);\n\n        // No delete: a shift",
    '&& request.resource.data.updatedAt == request.time\n          && isStaff(d)\n          && writable(d);\n\n        // No delete: a shift',
  ],
  [
    'W10',
    'helper edited while read-only',
    "&& hasRole(d, ['owner'])\n          && writable(d);\n\n        // No delete: a shift",
    "&& hasRole(d, ['owner']);\n\n        // No delete: a shift",
  ],
  [
    'W11',
    'helper flag of any type',
    'isVisibleText(data.name, 1, 60)\n        && data.active is bool',
    'isVisibleText(data.name, 1, 60)',
  ],
  [
    'W12',
    'helper with extra fields',
    "hasExactly(data, ['name', 'active', 'createdAt', 'updatedAt'])",
    'true',
  ],
  [
    'W13',
    'helper name ten times longer',
    'isVisibleText(data.name, 1, 60)',
    'isVisibleText(data.name, 1, 600)',
  ],
  // PLAN 3.3: vehicles (Y). PLAN 3.4: the plant stock and its movements (Z).
  ['Y01', 'vehicle in any slot', "vehicleId.matches('^v[0-2][0-9]$')", 'vehicleId is string'],
  [
    'Y02',
    'anyone reads the vehicles',
    'allow get: if isStaff(d);\n        allow list: if request.query.limit <= 30\n          && isStaff(d);',
    'allow get: if signedInWithGoogle();\n        allow list: if request.query.limit <= 30\n          && signedInWithGoogle();',
  ],
  [
    'Y03',
    'vehicles listed past the cap',
    'allow list: if request.query.limit <= 30\n          && isStaff(d);',
    'allow list: if request.query.limit <= 300\n          && isStaff(d);',
  ],
  [
    'Y04',
    'vehicle created with dates of the client',
    '&& isValidVehicle(request.resource.data)\n          && stampedNow(request.resource.data)',
    '&& isValidVehicle(request.resource.data)',
  ],
  [
    'Y05',
    'the driver adds vehicles',
    "&& stampedNow(request.resource.data)\n          && hasRole(d, ['owner', 'dispatcher'])\n          && writable(d);\n\n        // Everything but the creation date",
    '&& stampedNow(request.resource.data)\n          && isStaff(d)\n          && writable(d);\n\n        // Everything but the creation date',
  ],
  [
    'Y06',
    'vehicle added while read-only',
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && writable(d);\n\n        // Everything but the creation date",
    "&& hasRole(d, ['owner', 'dispatcher']);\n\n        // Everything but the creation date",
  ],
  [
    'Y07',
    'vehicle edited without keeping its creation date',
    "allow update: if isValidVehicle(request.resource.data)\n          && unchanged(['createdAt'])",
    'allow update: if isValidVehicle(request.resource.data)',
  ],
  [
    'Y08',
    'vehicle edited without moving its date',
    "&& unchanged(['createdAt'])\n          && request.resource.data.updatedAt == request.time\n          && hasRole(d, ['owner', 'dispatcher'])",
    "&& unchanged(['createdAt'])\n          && hasRole(d, ['owner', 'dispatcher'])",
  ],
  [
    'Y09',
    'the driver edits vehicles',
    "&& request.resource.data.updatedAt == request.time\n          && hasRole(d, ['owner', 'dispatcher'])\n          && writable(d);\n\n        // No delete: a shift (phase 5) names its vehicle",
    '&& request.resource.data.updatedAt == request.time\n          && isStaff(d)\n          && writable(d);\n\n        // No delete: a shift (phase 5) names its vehicle',
  ],
  [
    'Y10',
    'vehicle edited while read-only',
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && writable(d);\n\n        // No delete: a shift (phase 5) names its vehicle",
    "&& hasRole(d, ['owner', 'dispatcher']);\n\n        // No delete: a shift (phase 5) names its vehicle",
  ],
  [
    'Y11',
    'vehicle edited into any shape',
    'allow update: if isValidVehicle(request.resource.data)',
    'allow update: if true',
  ],
  [
    'Y12',
    'vehicle of any kind',
    "data.kind in ['motorcycle', 'tricycle', 'truck']",
    'data.kind is string',
  ],
  [
    'Y13',
    'vehicle name fifteen times longer',
    'isVisibleText(data.name, 1, 40)',
    'isVisibleText(data.name, 1, 600)',
  ],
  [
    'Y14',
    'plate of any characters',
    "\n          && value.matches('^[A-Z0-9]+(-[A-Z0-9]+)?$')",
    '',
  ],
  ['Y15', 'plate of any length', 'value.size() >= 3 && value.size() <= 10', 'true'],
  [
    'Y16',
    'a vehicle must have a plate',
    'return value == null\n        || (value is string && value.size() >= 3',
    'return (value is string && value.size() >= 3',
  ],
  [
    'Y17',
    'vehicle that carries nothing',
    'data.capacityCylinders >= 1 && data.capacityCylinders <= 999',
    'data.capacityCylinders >= 0 && data.capacityCylinders <= 999',
  ],
  [
    'Y18',
    'vehicle capacity ten times the cap',
    'data.capacityCylinders >= 1 && data.capacityCylinders <= 999',
    'data.capacityCylinders >= 1 && data.capacityCylinders <= 9990',
  ],
  ['Y19', 'vehicle capacity of any number', '&& data.capacityCylinders is int\n', ''],
  [
    'Y20',
    'vehicle flag of any type',
    'data.capacityCylinders <= 999\n        && data.active is bool',
    'data.capacityCylinders <= 999',
  ],
  [
    'Y21',
    'vehicle with extra fields',
    "hasExactly(data, [\n          'kind', 'name', 'plate', 'capacityCylinders', 'active', 'createdAt', 'updatedAt'\n        ])",
    'true',
  ],
  [
    'Z01',
    'the driver reads the plant stock',
    "allow get: if hasRole(d, ['owner', 'dispatcher']);\n        allow list: if request.query.limit <= 30 && hasRole(d, ['owner', 'dispatcher']);",
    'allow get: if isStaff(d);\n        allow list: if request.query.limit <= 30 && isStaff(d);',
  ],
  [
    'Z02',
    'plant stock listed past the cap',
    "allow list: if request.query.limit <= 30 && hasRole(d, ['owner', 'dispatcher']);",
    "allow list: if request.query.limit <= 300 && hasRole(d, ['owner', 'dispatcher']);",
  ],
  [
    'Z03',
    'the driver reads a movement',
    "allow get: if hasRole(d, ['owner', 'dispatcher']);\n        allow list: if request.query.limit <= 50",
    'allow get: if isStaff(d);\n        allow list: if request.query.limit <= 50',
  ],
  [
    'Z04',
    'the driver lists the movements',
    "allow list: if request.query.limit <= 50 && hasRole(d, ['owner', 'dispatcher']);",
    'allow list: if request.query.limit <= 50 && isStaff(d);',
  ],
  [
    'Z05',
    'movements listed past the cap',
    "allow list: if request.query.limit <= 50 && hasRole(d, ['owner', 'dispatcher']);",
    "allow list: if request.query.limit <= 500 && hasRole(d, ['owner', 'dispatcher']);",
  ],
  ['Z06', 'first stock without its movement', '&& movesStockFrom(0, 0)\n', ''],
  [
    'Z07',
    'stock changed without its movement',
    '&& movesStockFrom(resource.data.full, resource.data.empty)\n',
    '',
  ],
  [
    'Z08',
    'stock changed as if it started from zero',
    'movesStockFrom(resource.data.full, resource.data.empty)',
    'movesStockFrom(0, 0)',
  ],
  [
    'Z09',
    'full cylinders move by anything',
    'after.full == fullBefore + movement.fullDelta',
    'true',
  ],
  [
    'Z10',
    'empty cylinders move by anything',
    'after.empty == emptyBefore + movement.emptyDelta',
    'true',
  ],
  [
    'Z11',
    'the movement lies about the full cylinders left',
    '&& movement.fullAfter == after.full\n',
    '\n',
  ],
  [
    'Z12',
    'the movement lies about the empty cylinders left',
    '&& movement.emptyAfter == after.empty;',
    ';',
  ],
  ['Z13', 'one movement for another product', '&& movement.productId == productId\n', '\n'],
  [
    'Z14',
    'stock that names an old movement',
    'return movement.createdAt == request.time\n            && ',
    'return ',
  ],
  [
    'Z15',
    'the driver changes the stock',
    "&& movesStockFrom(resource.data.full, resource.data.empty)\n          && hasRole(d, ['owner', 'dispatcher'])",
    '&& movesStockFrom(resource.data.full, resource.data.empty)\n          && isStaff(d)',
  ],
  [
    'Z16',
    'the driver starts a stock',
    "&& movesStockFrom(0, 0)\n          && hasRole(d, ['owner', 'dispatcher'])",
    '&& movesStockFrom(0, 0)\n          && isStaff(d)',
  ],
  [
    'Z17',
    'stock changed while read-only',
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && writable(d);\n\n        // No delete: the stock",
    "&& hasRole(d, ['owner', 'dispatcher']);\n\n        // No delete: the stock",
  ],
  [
    'Z18',
    'stock started while read-only',
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && writable(d)\n          && exists(",
    "&& hasRole(d, ['owner', 'dispatcher'])\n          && exists(",
  ],
  [
    'Z19',
    'stock of a product that does not exist',
    '\n          && exists(/databases/$(database)/documents/distributors/$(d)/products/$(productId));',
    ';',
  ],
  [
    'Z20',
    'stock of any shape',
    'allow update: if isValidPlantStock(request.resource.data)\n          && ',
    'allow update: if ',
  ],
  [
    'Z21',
    'negative stock',
    'value is int && value >= 0 && value <= 99999',
    'value is int && value <= 99999',
  ],
  [
    'Z22',
    'stock ten times the cap',
    'value is int && value >= 0 && value <= 99999',
    'value is int && value >= 0 && value <= 999990',
  ],
  [
    'Z23',
    'stock with extra fields',
    "hasExactly(data, ['full', 'empty', 'lastMovementId', 'updatedAt'])",
    'true',
  ],
  [
    'Z24',
    'stock with an old date',
    '&& isAutoId(data.lastMovementId)\n        && data.updatedAt == request.time;',
    '&& isAutoId(data.lastMovementId)\n        && data.updatedAt is timestamp;',
  ],
  ['Z25', 'stock names a movement of any id', '&& isAutoId(data.lastMovementId)\n', '\n'],
  [
    'Z26',
    'movement without the change of the stock',
    '\n          && getAfter(\n            /databases/$(database)/documents/distributors/$(d)/plantStock/$(request.resource.data.productId)\n          ).data.lastMovementId == movementId;',
    ';',
  ],
  [
    'Z27',
    'movement written by the driver',
    "holdsRole(held, ['owner', 'dispatcher']) && ",
    "holdsRole(held, ['owner', 'dispatcher', 'driver']) && ",
  ],
  ['Z28', 'movement under any name', ' && data.authorName == held.displayName', ''],
  ['Z29', 'movement by another author', '&& data.authorUid == request.auth.uid\n', '\n'],
  [
    'Z30',
    'movement written while read-only',
    '&& writtenByAdjuster(member(d), request.resource.data)\n          && writable(d)',
    '&& writtenByAdjuster(member(d), request.resource.data)',
  ],
  [
    'Z31',
    'movement with any id',
    'allow create: if isAutoId(movementId)\n',
    'allow create: if true\n',
  ],
  [
    'Z32',
    'movement of any shape',
    'allow create: if isAutoId(movementId)\n          && isValidAdjustment(request.resource.data)',
    'allow create: if isAutoId(movementId)',
  ],
  ['Z33', 'movement of a shift already', "data.kind == 'adjustment'", 'data.kind is string'],
  [
    'Z34',
    'movement of any product slot',
    'isProductSlot(data.productId)',
    'data.productId is string',
  ],
  [
    'Z35',
    'movement of any reason',
    "data.reason in ['count', 'supplier', 'damaged', 'other']",
    'data.reason is string',
  ],
  [
    'Z36',
    '"other" without a note',
    "data.note == null ? data.reason != 'other' : ",
    'data.note == null ? true : ',
  ],
  ['Z37', 'note of anything', 'isVisibleText(data.note, 1, 200)', 'data.note is string'],
  [
    'Z38',
    'note ten times longer',
    'isVisibleText(data.note, 1, 200)',
    'isVisibleText(data.note, 1, 2000)',
  ],
  [
    'Z39',
    'change ten times the cap',
    'value >= -9999 && value <= 9999',
    'value >= -99999 && value <= 99999',
  ],
  ['Z40', 'change of any number', 'return value is int && value >= -9999', 'return value >= -9999'],
  [
    'Z41',
    'movement that changes nothing',
    '\n        && (data.fullDelta != 0 || data.emptyDelta != 0)',
    '',
  ],
  [
    'Z42',
    'movement with extra fields',
    "hasExactly(data, [\n          'kind', 'productId', 'reason', 'note', 'fullDelta', 'emptyDelta', 'fullAfter',\n          'emptyAfter', 'authorUid', 'authorName', 'createdAt'\n        ])",
    'true',
  ],
  [
    'Z43',
    'movement with a date of the client',
    '&& data.authorUid == request.auth.uid\n        && data.createdAt == request.time;',
    '&& data.authorUid == request.auth.uid\n        && data.createdAt is timestamp;',
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
  'the piece needs foundedNow(d), so the control document is created in the same request, and that requires a session of Google with a verified e-mail';
// An acceptance is two writes that vouch for each other: the field of the profile demands its
// history entry stamped now (logsAcceptance) and the entry demands that field stamped now
// (profileAccepts). A check written on both sides survives while the other side stands.
const ENTRY_NEEDS_PROFILE =
  'profileAccepts() needs the profile of that account to take the acceptance in this same request';
// The invitation is used only by the request that creates the member naming it, and that member
// is created only with the invitation marked used by the caller: each side checks the author.
const INVITE_PAIR =
  'the member that names the invitation is created only in this request, and its rule demands after.acceptedBy == request.auth.uid; the invitation rule demands the same author: one lock is enough while the other stands';
// The stock and its movement vouch for each other: the stock changes only by a movement created in
// the same request, and the movement is created only if the stock names it. A check written on
// both sides survives while the other side stands.
const STOCK_PAIR =
  'the stock and its movement must be written in the same request, and the other side holds the same check';
const EQUIVALENT = {
  A01: 'the entry it needs is stamped now, so this request creates it, and creating it requires the profile to hold the acceptance stamped with request.time (profileAccepts, pair of A12)',
  A06: `${ENTRY_NEEDS_PROFILE}, and only the account itself writes its profile`,
  A09: 'the profile that takes the acceptance demands, through logsAcceptance(), that this very entry (same id: A08) be stamped with request.time',
  A11: 'the version of an entry must be an allowed one of its text, and each list holds a single version today: the one the profile takes. NOT equivalent once a list has two versions: add then a rules test with an entry of the other version',
  A14: 'the id must be document-version (A08) and profileAccepts() reads the profile field named by the document, which exists only for terms and privacy and only with an allowed version',
  H07: 'a control document stamped with request.time was created by this request, and creating it already requires the caller as ownerUid (pair of C02)',
  H09: WHOLE_STRING,
  H11: 'both ids it checks are then passed to foundedNow(), which only holds for a distributor created in this request, whose id is checked with isDistributorId(); anything that is not a string cannot build the path and denies (same reason as U12)',
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
  U11: 'a shorter or equal list has no entry at the position of the new id, which fails to evaluate; a longer one makes ownsNoReadOnlyDistributor() read with get() the control document of the distributor being founded, which does not exist yet, or passes the cap of 3',
  U12: 'the id is then passed to foundedNow(), which only holds for a distributor created in this request, whose id is checked there and in the slug',
  S03: 'the slug id must equal the slug field of the new distributor, which is checked with isSlug() when it is created (pair of D04)',
  S04: VERIFIED_BY_CONTROL,
  D04: 'the slug document it names must exist after the request, and creating that one checks isSlug() on its id (pair of S03)',
  D08: 'the slug it names must point to it once the request is applied; a slug is created only for a distributor founded in the same request and is never deleted, so the slug of a distributor that does not exist yet is created by this request, which needs foundedNow(d) (the slug rule holds the same lock)',
  D10: VERIFIED_BY_CONTROL,
  C02: 'every other piece needs foundedNow(d), which requires the caller as ownerUid of the control document (pair of H07)',
  C15: 'the distributor, created in the same request, requires a session of Google with a verified e-mail',
  I11: 'both branches of the update need isSelf() or hasRole(), and both already demand a session of Google with a verified e-mail',
  I12: VERIFIED_BY_CONTROL,
  P09: 'the control document requires the settings to carry the caller as ownerUid',
  M04: 'the control document requires the member of the caller to have role owner',
  X07: 'an approval removes the note (H49), and leavesCorrectionMarkAlone() lets a mark survive only while the note is untouched: the shape is a second lock',
  X09: 'only an owner writes the mark, through marksCorrection(), which demands correctedAt == request.time: it is always a timestamp',
  // PLAN 3.2: using an invitation is two writes that vouch for each other, like an acceptance.
  M11: 'the founder is an owner, and only the founder manages another owner, never itself (memberUid != request.auth.uid): the founder check is a second lock (PLAN 3.2)',
  K31: 'a visible text has a letter or digit, so it is never empty: the lower bound is a second lock',
  H52: 'nobody writes the mark except a platform admin through writesNoteWithItsText(), which demands reviewNoteAt == request.time: it is always a timestamp',
  V11: 'the text needs the mark of the control document stamped now, and only a platform admin writes that mark',
  V13: 'a new mark in the control document demands getAfter(review).writtenAt == request.time (writesNoteWithItsText), and the text is only written together with a new mark',
  V18: 'the text written with the mark demands getAfter(control).reviewNoteAt == request.time: the same date from the other side',
  N21: INVITE_PAIR,
  J10: INVITE_PAIR,
  N25: 'the member that the same request must create checks after.status == "accepted" (usesInvitation), and the invitation can only change to that status in this branch',
  J08: 'the invitation can only be marked used while it waits: its update rule demands resource.data.status == "pending", and the member rule demands it marked used in the same request',
  // PLAN 3.4: the plant stock and its movement are two writes that vouch for each other.
  Z15: `${STOCK_PAIR}: only the owner or the dispatcher creates the movement (writtenByAdjuster)`,
  Z16: `${STOCK_PAIR}: only the owner or the dispatcher creates the movement (writtenByAdjuster)`,
  Z17: `${STOCK_PAIR}: the movement needs a writable distributor`,
  Z18: `${STOCK_PAIR}: the movement needs a writable distributor`,
  Z27: `${STOCK_PAIR}: only the owner or the dispatcher changes the stock`,
  Z30: `${STOCK_PAIR}: the stock needs a writable distributor`,
  Z43: `${STOCK_PAIR}: the stock demands movement.createdAt == request.time`,
  Z31: `${STOCK_PAIR}: the stock names the movement in lastMovementId, which must be an automatic id`,
  Z25: 'the stock reads the movement it names with getAfter, and a name that is not an automatic id cannot be the id of a movement, whose rule demands isAutoId(movementId)',
  Z34: `${STOCK_PAIR}: the stock of that product must name the movement and demands movement.productId == its own id, and a stock is only created for a product that exists (slots p00 … p29)`,
  Z40: 'a change that is not an integer leaves a count that is not one, and the stock demands integers (isStockCount)',
  F53: 'the next line compares the lock with a timestamp (`<= request.time + duration`), which fails to evaluate, and so denies, for anything that is not one',
  Q26: "isValidDistributor() pins currency == 'PEN', so no update can change it while there is a single currency: the whitelist is a second lock. NOT equivalent the day a second currency is allowed: the test 'blocks the owner from changing its currency' then kills it",
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
