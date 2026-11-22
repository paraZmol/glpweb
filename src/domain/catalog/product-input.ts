import { normalizeBrandColor, isValidBrandColor } from '../tenancy/contact';
import {
  type Check,
  checkInteger,
  checkVisibleText,
  collectIssues,
  type FieldIssue,
  type Validated,
} from '../tenancy/field-checks';
import {
  BRAND_NAME_MAX_LENGTH,
  MAX_PRICE_CENTS,
  MAX_WEIGHT_KG,
  MIN_PRICE_CENTS,
  MIN_WEIGHT_KG,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NAME_MIN_LENGTH,
} from './constants';
import {
  defaultProductName,
  EDITABLE_PRODUCT_FIELDS,
  type NewProduct,
  type Product,
  type ProductPatch,
} from './product';

/** The product form, as typed. Prices are already integer cents (see `parsePriceCents`). */
export interface ProductInput {
  brand: string;
  /** `#rrggbb`; empty or null for none. */
  brandColor?: string | null;
  weightKg: number;
  /** Blank takes "Balón {peso} kg". */
  name?: string;
  refillPriceCents: number;
  /** Null when the distributor does not sell the cylinder with its container. */
  fullPriceCents: number | null;
  /** New products are on sale unless the owner says otherwise. */
  active?: boolean;
}

const SPACES = /\s+/g;
const tidy = (text: string) => text.trim().replace(SPACES, ' ');

function tidyColor(color: string | null | undefined): string | null {
  const normalized = normalizeBrandColor(color ?? '');
  return normalized === '' ? null : normalized;
}

/** Integer cents within the sanity cap of S/ 999 (glp-domain §5, errors of a finger). */
export function checkPriceCents(priceCents: number): Check {
  return checkInteger(priceCents, MIN_PRICE_CENTS, MAX_PRICE_CENTS);
}

/**
 * The full cylinder is the same gas plus the container: its price must be above the refill
 * price. Equal or lower would be giving the container away, which is a promotion (PLAN 3.5),
 * not a list price. firebase/firestore.rules repeats the check.
 */
function checkFullPrice(fullPriceCents: number | null, refillPriceCents: number): Check {
  if (fullPriceCents === null) return null;
  const own = checkPriceCents(fullPriceCents);
  if (own) return own;
  return fullPriceCents > refillPriceCents ? null : 'notAbove';
}

type Checked = Omit<NewProduct, 'weightKg'> & { weightKg?: number };

function issuesOf(product: Checked): FieldIssue[] {
  return collectIssues([
    ['brand', checkVisibleText(product.brand, 1, BRAND_NAME_MAX_LENGTH)],
    [
      'brandColor',
      product.brandColor === null || isValidBrandColor(product.brandColor) ? null : 'invalid',
    ],
    [
      'weightKg',
      product.weightKg === undefined
        ? null
        : checkInteger(product.weightKg, MIN_WEIGHT_KG, MAX_WEIGHT_KG),
    ],
    ['name', checkVisibleText(product.name, PRODUCT_NAME_MIN_LENGTH, PRODUCT_NAME_MAX_LENGTH)],
    ['refillPriceCents', checkPriceCents(product.refillPriceCents)],
    ['fullPriceCents', checkFullPrice(product.fullPriceCents, product.refillPriceCents)],
  ]);
}

/** Normalises and validates a new product. */
export function prepareNewProduct(input: ProductInput): Validated<NewProduct> {
  const name = tidy(input.name ?? '');
  const value: NewProduct = {
    brand: tidy(input.brand),
    brandColor: tidyColor(input.brandColor),
    weightKg: input.weightKg,
    name: name === '' ? defaultProductName(input.weightKg) : name,
    refillPriceCents: input.refillPriceCents,
    fullPriceCents: input.fullPriceCents,
    active: input.active ?? true,
  };
  const issues = issuesOf(value);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value };
}

function normalizePatch(patch: ProductPatch): ProductPatch {
  const normalized: ProductPatch = { ...patch };
  if (patch.brand !== undefined) normalized.brand = tidy(patch.brand);
  if (patch.name !== undefined) normalized.name = tidy(patch.name);
  if (patch.brandColor !== undefined) normalized.brandColor = tidyColor(patch.brandColor);
  return normalized;
}

/** Only the fields whose value really changes. */
function changedFields(current: Product, patch: ProductPatch): ProductPatch {
  const changed: Record<string, unknown> = {};
  for (const field of EDITABLE_PRODUCT_FIELDS) {
    const value = patch[field];
    if (value !== undefined && value !== current[field]) changed[field] = value;
  }
  return changed as ProductPatch;
}

/**
 * Normalises and validates an edit of `current`, and keeps only what changes. The checks run on
 * the product as it would be stored (a new refill price must stay below the full price that is
 * already there). An empty result means nothing changes.
 */
export function prepareProductEdit(current: Product, patch: ProductPatch): Validated<ProductPatch> {
  const changes = changedFields(current, normalizePatch(patch));
  const issues = issuesOf({ ...current, ...changes, weightKg: undefined }).filter(
    (issue) => issue.field in changes || isPriceIssue(issue, changes),
  );
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: changes };
}

/** A change of either price can break the order between both: report it on the full price. */
function isPriceIssue(issue: FieldIssue, changes: ProductPatch): boolean {
  return issue.field === 'fullPriceCents' && 'refillPriceCents' in changes;
}
