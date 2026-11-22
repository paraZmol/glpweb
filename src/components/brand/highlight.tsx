import type { CSSProperties, ReactNode } from 'react';

type HighlightProps = {
  children: ReactNode;
  /**
   * Draws the band once on load, left to right (docs/marketing/movimiento-portada.md): only in
   * the hero headline of the home, and only for plain text. Pure CSS, so it runs before the app
   * hydrates and never holds the text back; with reduced motion it is already drawn.
   */
  draw?: boolean;
};

/** One span per word, so each piece of the band can grow with `transform` only. */
function DrawnWords({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <span className="isolate">
      {words.map((word, index) => (
        <span
          key={index}
          className="highlight-draw"
          style={{ '--word-index': index, '--word-count': words.length } as CSSProperties}
        >
          {index < words.length - 1 ? `${word} ` : word}
        </span>
      ))}
    </span>
  );
}

/**
 * Marker-pen band under the key phrase of a headline (ui-system §9.3). Once per screen, in the
 * `h1` or on the key figure. The words keep the text colour: the primary never colours them.
 */
export function Highlight({ children, draw = false }: HighlightProps) {
  if (draw && typeof children === 'string') return <DrawnWords text={children} />;
  return <span className="highlight-mark">{children}</span>;
}
