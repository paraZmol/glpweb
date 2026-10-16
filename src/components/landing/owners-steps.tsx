import { StepsTimeline } from './steps-timeline';

const STEPS = [
  { title: 'Te registras con tus datos y los de tu negocio.' },
  { title: 'Revisamos tu ficha.' },
  { title: 'Apareces en el buscador.' },
];

/** "Cómo empiezas": the three steps of the sign-up, as they work today. */
export function OwnersSteps() {
  return (
    <section aria-labelledby="como-empiezas">
      <h2 id="como-empiezas" className="text-[2.125rem] font-extrabold lg:text-[3.25rem]">
        Cómo empiezas
      </h2>
      <StepsTimeline steps={STEPS} layout="row" className="mt-6" />
    </section>
  );
}
