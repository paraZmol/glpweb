import { Menu, X } from 'lucide-react';
import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { ICON_STROKE } from '@/lib/icons';
import { dropdownVariants, listItemVariants } from '@/lib/motion';
import { isCurrentLink, PUBLIC_NAV } from './public-nav';

const PANEL_ID = 'menu-publico';
const FOCUSABLE = 'a[href], button';
// The two icons cross: the one leaving fades and turns away while the other one arrives.
const ICON =
  'col-start-1 row-start-1 size-6 transition-[opacity,rotate] motion-fast motion-reduce:rotate-none';

/**
 * Phone menu of the public pages: a button that opens the same links as the desktop bar in a
 * panel under the header. Escape, a tap outside or a tap on a link closes it; Tab stays inside.
 */
export function PublicMenu() {
  const [open, setOpen] = useState(false);
  const { pathname, hash } = useLocation();
  const reduced = useReducedMotion() ?? false;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    toggleRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') return close();
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = [toggleRef.current, ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div onKeyDown={onKeyDown} className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setOpen((value) => !value)}
        className="press grid size-11 place-items-center rounded-full motion-instant hover:bg-muted"
      >
        <Menu
          aria-hidden="true"
          strokeWidth={ICON_STROKE}
          className={`${ICON} ${open ? 'rotate-90 opacity-0' : ''}`}
        />
        <X
          aria-hidden="true"
          strokeWidth={ICON_STROKE}
          className={`${ICON} ${open ? '' : '-rotate-90 opacity-0'}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <m.div
              aria-hidden="true"
              onClick={close}
              className="fixed inset-0 -z-10 bg-foreground/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <m.div
              ref={panelRef}
              id={PANEL_ID}
              className="absolute inset-x-0 top-full z-40 rounded-b-2xl bg-card px-4 pt-2 pb-5 shadow-raised"
              {...dropdownVariants(reduced)}
            >
              <nav aria-label="Menú principal">
                <ul className="flex flex-col">
                  {PUBLIC_NAV.map((link, index) => (
                    <m.li key={link.to} {...listItemVariants(index, reduced)}>
                      <Link
                        to={link.to}
                        onClick={() => setOpen(false)}
                        aria-current={isCurrentLink(link.to, pathname, hash) ? 'page' : undefined}
                        className="flex min-h-12 items-center rounded-xl px-3 font-heading text-lg font-bold hover:bg-muted aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-text"
                      >
                        {link.label}
                      </Link>
                    </m.li>
                  ))}
                </ul>
              </nav>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
