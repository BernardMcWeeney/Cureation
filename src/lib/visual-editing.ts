import { copyRevisions } from './copy-revisions';
import { editingContext } from './editing-context';

const origin = Symbol.for('cureation.directus-origin');
type Source = { collection: string; item: string | number; fields: string[] };
const relations: Record<string, string> = {
  album: 'discography', song: 'songs', setlist: 'setlists', songs: 'songs', singles: 'singles', era: 'eras',
  venue: 'venues', tour: 'tours', member: 'members', stints: 'member_stints',
  photos: 'photos', options: 'poll_options',
};

/** Carry original collection/field identity through array operations and object spreads. */
export function identify<T>(data: T, collection: string): T {
  if (Array.isArray(data)) { data.forEach((row) => identify(row, collection)); return data; }
  if (!data || typeof data !== 'object') return data;
  const row = data as Record<string | symbol, any>;
  if (row.id != null) row[origin] = { collection, item: row.id, fields: Object.keys(row).filter((field) => collection !== 'songs' || !['times_played_live', 'first_played_live', 'last_played_live'].includes(field)) };
  for (const [field, target] of Object.entries(relations)) {
    if (row[field] && typeof row[field] === 'object') identify(row[field], target);
  }
  return data;
}

export function editable(row: unknown, fields?: string | string[]): string | undefined {
  if (!editingContext.getStore()?.preview || !row || typeof row !== 'object') return;
  const copyFields = (row as Record<symbol, Record<string, string>>)[Symbol.for('cureation.copy-origin')];
  if (copyFields) {
    const requested = typeof fields === 'string' ? [fields] : fields || Object.keys(copyFields);
    const key = requested.map((field) => copyFields[field]).find(Boolean);
    return key ? copyAttr(key) : undefined;
  }
  const source: Source | undefined = (row as Record<symbol, Source>)[origin];
  if (!source) return;
  const requested = typeof fields === 'string' ? [fields] : fields;
  const selected = requested?.filter((field) => source.fields.includes(field));
  if (requested && !selected?.length) return;
  return `collection:${source.collection};item:${source.item}${selected?.length ? `;fields:${selected.join(',')}` : ''};mode:drawer`;
}

export function copyText(key: string, fallback: string): string {
  const saved = editingContext.getStore()?.copy[key];
  const revision = copyRevisions[key];
  // Retire old default wording while preserving custom CMS edits.
  return revision && saved === revision.previous ? revision.text : saved ?? fallback;
}

export function copyAttr(key: string): string | undefined {
  if (!editingContext.getStore()?.preview) return;
  return `collection:site_copy;item:${key};fields:text;mode:popover`;
}

const copyOrigin = Symbol.for('cureation.copy-origin');
export function copySource(fields: Record<string, string>) {
  return { [copyOrigin]: fields };
}

export function copyTuple<T extends unknown[]>(row: [...T], fields: Record<string, string>) {
  return Object.assign(row, copySource(fields));
}

export function copyTupleSource(row: unknown, names: string[]) {
  const keys = row && typeof row === 'object'
    ? (row as Record<symbol, Record<string, string>>)[copyOrigin]
    : undefined;
  return copySource(Object.fromEntries(names.flatMap((name, index) => keys?.[index] ? [[name, keys[index]]] : [])));
}
