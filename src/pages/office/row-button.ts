// The small buttons of the rows of /central/personal (PLAN 3.2) keep their 40 px look with a
// mouse, but on a phone or a tablet they are pressed with a finger, often in a hurry: there
// they are 44 px tall, not only 44 px of invisible touch area (ux-reviewer, 2026-11-21).
export const ROW_BUTTON = 'max-lg:h-11';

// "Activar", "Reactivar", "Añadir": the soft button, whose brand text on its tint stays just
// above 4.5:1 in dark (4.7 with the seed colour, ux-reviewer 2026-11-21). In dark they take the
// text colour instead (over 12:1); the tint still tells them apart.
export const SOFT_ROW_TEXT = 'dark:text-foreground';
