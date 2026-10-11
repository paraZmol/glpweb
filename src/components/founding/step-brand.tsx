import { BrandColorField } from './brand-color-field';
import { BrandPreview } from './brand-preview';
import type { StepProps } from './step-business';

/** Step 3 (PLAN 2.2): the colour of the brand, with a live sample in both themes. */
export function StepBrand({ form, errors, set }: StepProps) {
  return (
    <>
      <BrandColorField
        color={form.brandColor}
        error={errors.brandColor}
        onChange={(color) => set('brandColor', color)}
      />
      <BrandPreview color={form.brandColor} name={form.name} className="lg:hidden" />
    </>
  );
}
