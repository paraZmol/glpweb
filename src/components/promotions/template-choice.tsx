import {
  BadgePercent,
  CircleDollarSign,
  Layers,
  type LucideIcon,
  Package,
  Tag,
  Tags,
} from 'lucide-react';
import { TextLink } from '@/components/common/text-link';
import { type Product, productTitle } from '@/domain/catalog/product';
import { formatMoney } from '@/domain/money/format';
import { parseMoneyCents } from '@/domain/money/parse';
import {
  eligibleProducts,
  PROMOTION_TEMPLATES,
  type PromotionTemplate,
  suggestedPrice,
} from '@/features/promotions/promotion-templates';
import { ICON_STROKE } from '@/lib/icons';
import { ROUTES } from '@/lib/routes';

const NAMES: Record<PromotionTemplate, { title: string; icon: LucideIcon }> = {
  specialPrice: { title: 'Precio especial', icon: Tag },
  amountOff: { title: 'S/ menos', icon: CircleDollarSign },
  percentOff: { title: 'Porcentaje', icon: BadgePercent },
  fullAtRefill: { title: 'Balón completo al precio del gas', icon: Package },
  fullDiscount: { title: 'Balón completo con rebaja', icon: Tags },
  buyXPayY: { title: 'Lleva más, paga menos', icon: Layers },
};

/** "Tu recarga de Balón 10 kg · Marca Uno a S/ 48.00 en vez de S/ 52.00." with its own prices. */
function exampleOf(template: PromotionTemplate, catalog: readonly Product[]): string {
  const isFull = template === 'fullDiscount';
  const product = eligibleProducts(catalog, isFull ? 'full' : 'refill')[0];
  const priced = (what: string) => {
    if (!product) return '';
    const list = isFull ? (product.fullPriceCents ?? 0) : product.refillPriceCents;
    const price = parseMoneyCents(suggestedPrice(template, product)) ?? list;
    return `Tu ${what} de ${productTitle(product)} a ${formatMoney(price, product.currency)} en vez de ${formatMoney(list, product.currency)}.`;
  };
  switch (template) {
    case 'specialPrice':
      return priced('recarga');
    case 'amountOff':
      return 'S/ 5 menos en cada recarga.';
    case 'percentOff':
      return '10 % menos en lo que elijas.';
    case 'fullAtRefill':
      return 'Quien compra se lleva el envase y paga solo el gas.';
    case 'fullDiscount':
      return priced('balón completo');
    case 'buyXPayY':
      return 'Lleva 3 recargas, paga 2.';
  }
}

type TemplateChoiceProps = {
  catalog: readonly Product[];
  onChoose: (template: PromotionTemplate) => void;
};

/**
 * Step 1 of "Añadir promoción" (marketing §4): big cards, each with an example worked out with
 * the distributor's own prices. The two of the full cylinder are off while no product sells it.
 */
export function TemplateChoice({ catalog, onChoose }: TemplateChoiceProps) {
  const sellsFull = eligibleProducts(catalog, 'full').length > 0;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-extrabold">¿Qué quieres ofrecer?</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PROMOTION_TEMPLATES.map((template) => {
          const { title, icon: Icon } = NAMES[template];
          const isOff = template.startsWith('full') && !sellsFull;
          return (
            <li key={template}>
              <button
                type="button"
                disabled={isOff}
                onClick={() => onChoose(template)}
                className="press grid h-full w-full grid-cols-[auto_minmax(0,1fr)] content-start gap-x-3 gap-y-1 rounded-lg bg-card p-4 text-left sm:flex sm:flex-col sm:items-start sm:gap-2 inset-ring-[1.5px] inset-ring-border motion-instant hover:inset-ring-input disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className="row-span-2 grid size-10 place-items-center rounded-md bg-primary-soft text-primary-text"
                >
                  <Icon className="size-5" strokeWidth={ICON_STROKE} />
                </span>
                <span className="self-center font-heading text-lg leading-tight font-bold sm:self-auto">
                  {title}
                </span>
                <span className="text-[0.9375rem] text-muted-foreground">
                  {isOff
                    ? 'Primero pon precio de balón completo a un producto.'
                    : exampleOf(template, catalog)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!sellsFull && (
        <p className="text-[0.9375rem]">
          El precio del balón completo se pone en el{' '}
          <TextLink to={ROUTES.officeCatalog}>catálogo</TextLink>.
        </p>
      )}
    </div>
  );
}
