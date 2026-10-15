/** Keep keyboard focus in the active modal; hidden panels never trap focus. */
export function trapDialogFocus(root: HTMLElement, event: KeyboardEvent) {
  if (root.hidden || event.key !== 'Tab') return;
  const focusable = Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')).filter((element) => element.getClientRects().length > 0);
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (!first) { event.preventDefault(); return; }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !root.contains(active))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (active === last || !root.contains(active))) { event.preventDefault(); first.focus(); }
}
