import { ChevronDown } from 'lucide-react';
import { ICON_STROKE } from '@/lib/icons';

export type FaqItem = { question: string; answer: string };

type FaqListProps = { id: string; title: string; items: readonly FaqItem[] };

/** Questions as native disclosure rows: work without script and with the keyboard. */
export function FaqList({ id, title, items }: FaqListProps) {
  return (
    <section aria-labelledby={id} className="lg:grid lg:grid-cols-[22rem_1fr] lg:gap-16">
      <h2 id={id} className="text-[2.125rem] font-extrabold lg:text-[3.25rem]">
        {title}
      </h2>
      <div className="mt-6 divide-y divide-border rounded-2xl bg-card shadow-card lg:mt-0">
        {items.map((item) => (
          <details key={item.question} className="group px-5">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-heading text-lg font-bold [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown
                aria-hidden="true"
                strokeWidth={ICON_STROKE}
                className="size-5 shrink-0 text-muted-foreground transition-transform motion-fast group-open:rotate-180"
              />
            </summary>
            <p className="faq-answer pb-5 text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
