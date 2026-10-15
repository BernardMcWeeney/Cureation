import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';

document.addEventListener('astro:before-swap', (event) => {
  // A mobile viewport resize can cancel the visual snapshot while navigation succeeds.
  // Handle that optional animation promise; Astro still handles DOM-update failures.
  void (event as TransitionBeforeSwapEvent).viewTransition?.ready.catch(() => {});
});
