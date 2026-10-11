/**
 * The ONE confirm pattern in the app. Callers pass an already-localized
 * message (from the i18n dictionary) — never build confirm strings ad hoc.
 */
export function confirmAction(message: string): boolean {
  return window.confirm(message);
}
