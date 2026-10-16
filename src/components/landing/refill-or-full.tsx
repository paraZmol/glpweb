import { GasCylinder } from '@/components/brand/gas-cylinder';

const CYLINDER_PX = 72;

const KINDS = [
  { title: 'Recarga', text: 'Entregas tu balón vacío y pagas solo el gas.' },
  {
    title: 'Balón completo',
    text: 'Gas más el envase. Para quien no tiene un balón vacío para cambiar.',
  },
];

/** Recarga or balón completo: so nobody pays for a cylinder without meaning to. */
export function RefillOrFull() {
  return (
    <section aria-labelledby="recarga-o-completo">
      <h2 id="recarga-o-completo" className="text-[1.75rem] font-extrabold lg:text-4xl">
        ¿Recarga o balón completo?
      </h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:gap-6">
        {KINDS.map((kind, index) => (
          <li
            key={kind.title}
            className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-card"
          >
            <GasCylinder weightKg={10} tone={index === 0 ? 'mono' : 'color'} height={CYLINDER_PX} />
            <div>
              <h3 className="text-xl font-bold">{kind.title}</h3>
              <p className="mt-1 text-muted-foreground">{kind.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
