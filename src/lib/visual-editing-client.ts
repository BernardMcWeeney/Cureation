let library: Promise<typeof import('@directus/visual-editing')> | undefined;
let pending = Promise.resolve();

function enqueue(task: () => Promise<void>) {
  pending = pending.then(task).catch((error) => console.error('[visual-editor]', error));
}

async function connect() {
  if (window.self === window.top) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('visual-editing') !== 'true') {
    url.searchParams.set('visual-editing', 'true');
    window.location.replace(url);
    return;
  }
  library ??= import('@directus/visual-editing');
  const { apply, remove } = await library;
  await remove();
  await apply({
    directusUrl: import.meta.env.PUBLIC_DIRECTUS_URL || 'https://dash.cureation.net',
    onSaved: () => window.location.reload(),
  });
}

document.addEventListener('astro:page-load', () => enqueue(connect));
document.addEventListener('astro:before-preparation', (event) => {
  if (window.self === window.top) return;
  const navigation = event as Event & { to: URL };
  navigation.to.searchParams.set('visual-editing', 'true');
  enqueue(async () => { if (library) await (await library).remove(); });
});
