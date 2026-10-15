/** Row clicks enhance, rather than replace, the real keyboard-accessible links. */
document.addEventListener('click', (event) => {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('a, button, input, select, textarea, summary')) return;
  const row = target?.closest<HTMLElement>('[data-row-href]');
  if (row?.dataset.rowHref?.startsWith('/')) window.location.assign(row.dataset.rowHref);
});
