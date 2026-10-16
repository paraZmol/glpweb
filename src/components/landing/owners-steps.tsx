const STEPS = [
  'Te registras con tus datos y los de tu negocio.',
  'Revisamos tu ficha.',
  'Apareces en el buscador.',
];

/** "Cómo empiezas": the three steps of the sign-up, as they work today. */
export function OwnersSteps() {
  return (
    <section aria-labelledby="como-empiezas">
      <h2 id="como-empiezas" className="text-[2.125rem] font-extrabold lg:text-[3.25rem]">
        Cómo empiezas
      </h2>
      <ol className="mt-6 grid gap-3 lg:grid-cols-3 lg:gap-6">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-4 rounded-xl bg-muted p-4 lg:p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft font-heading text-xl font-extrabold text-primary-text tabular-nums">
              {index + 1}
            </span>
            <span className="text-lg font-semibold">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
