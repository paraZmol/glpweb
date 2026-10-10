const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Keeps the `.dark` class in sync with the device setting. */
export function followSystemTheme(): void {
  const media = window.matchMedia(DARK_QUERY);
  const apply = () => document.documentElement.classList.toggle('dark', media.matches);
  apply();
  media.addEventListener('change', apply);
}
