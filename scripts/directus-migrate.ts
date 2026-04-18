/**
 * Cureation — Directus schema migration.
 * Idempotent: only creates collections/fields/relations/presets when missing.
 *
 * Run:  DIRECTUS_URL=... DIRECTUS_TOKEN=... npx tsx scripts/directus-migrate.ts
 */

const URL_BASE = (process.env.DIRECTUS_URL || 'https://dash.cureation.net').replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_TOKEN;
if (!TOKEN) throw new Error('DIRECTUS_TOKEN env var is required');

type Json = any;

async function api(path: string, init: RequestInit = {}): Promise<Json> {
  const res = await fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

const log = (s: string) => console.log(`• ${s}`);
const warn = (s: string) => console.log(`! ${s}`);
const ok = (s: string) => console.log(`✓ ${s}`);

/* ---------- helpers ---------- */

async function collectionExists(name: string): Promise<boolean> {
  try {
    await api(`/collections/${name}`);
    return true;
  } catch {
    return false;
  }
}

async function fieldExists(collection: string, field: string): Promise<boolean> {
  try {
    await api(`/fields/${collection}/${field}`);
    return true;
  } catch {
    return false;
  }
}

async function ensureCollection(def: {
  collection: string;
  note?: string;
  icon?: string;
  sort_field?: string;
  archive_field?: string;
  archive_value?: string;
  unarchive_value?: string;
  fields: Array<{
    field: string;
    type: string;
    meta?: Json;
    schema?: Json;
  }>;
}) {
  if (await collectionExists(def.collection)) {
    log(`collection ${def.collection} already exists — checking fields`);
  } else {
    await api('/collections', {
      method: 'POST',
      body: JSON.stringify({
        collection: def.collection,
        meta: {
          collection: def.collection,
          icon: def.icon || 'folder',
          note: def.note || null,
          hidden: false,
          singleton: false,
          sort_field: def.sort_field || null,
          archive_field: def.archive_field || null,
          archive_value: def.archive_value || null,
          unarchive_value: def.unarchive_value || null,
        },
        schema: {},
        fields: [
          {
            field: 'id',
            type: 'uuid',
            meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] },
            schema: { is_primary_key: true, length: 36, has_auto_increment: false },
          },
        ],
      }),
    });
    ok(`created collection ${def.collection}`);
  }

  for (const f of def.fields) {
    if (await fieldExists(def.collection, f.field)) continue;
    await api(`/fields/${def.collection}`, {
      method: 'POST',
      body: JSON.stringify({
        field: f.field,
        type: f.type,
        meta: f.meta || {},
        schema: f.schema || {},
      }),
    });
    ok(`  field ${def.collection}.${f.field}`);
  }
}

async function ensureField(
  collection: string,
  field: string,
  type: string,
  meta: Json = {},
  schema: Json = {}
) {
  if (await fieldExists(collection, field)) return;
  await api(`/fields/${collection}`, {
    method: 'POST',
    body: JSON.stringify({ field, type, meta, schema }),
  });
  ok(`  field ${collection}.${field}`);
}

async function ensureRelation(payload: {
  collection: string; // many side
  field: string;
  related_collection: string;
  meta?: Json;
}) {
  try {
    // Check if relation exists
    const existing = await api(
      `/relations/${payload.collection}/${payload.field}`
    );
    if (existing?.data) return;
  } catch {}
  try {
    await api('/relations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    ok(`  relation ${payload.collection}.${payload.field} → ${payload.related_collection}`);
  } catch (e: any) {
    warn(`  relation ${payload.collection}.${payload.field} — ${e.message.slice(0, 120)}`);
  }
}

/* ---------- taxonomies ---------- */

async function taxonomies() {
  const slugField = {
    field: 'slug',
    type: 'string',
    meta: { interface: 'input', required: true, note: 'URL-safe unique slug' },
    schema: { is_nullable: false, is_unique: true },
  };
  const nameField = {
    field: 'name',
    type: 'string',
    meta: { interface: 'input', required: true },
    schema: { is_nullable: false },
  };

  await ensureCollection({
    collection: 'eras',
    note: 'Cure eras (early/dark/pop/imperial/wilderness/return).',
    icon: 'schedule',
    fields: [
      slugField,
      nameField,
      { field: 'short_name', type: 'string', meta: { interface: 'input' } },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' } },
      { field: 'year_start', type: 'integer', meta: { interface: 'input' } },
      { field: 'year_end', type: 'integer', meta: { interface: 'input' } },
      { field: 'hue', type: 'integer', meta: { interface: 'input', note: 'Optional tonal hue 0-360' } },
      { field: 'sort', type: 'integer', meta: { interface: 'input', hidden: true } },
    ],
  });

  await ensureCollection({
    collection: 'genres',
    icon: 'label',
    fields: [slugField, nameField],
  });
  await ensureCollection({
    collection: 'tags',
    icon: 'label',
    fields: [slugField, nameField],
  });
  await ensureCollection({
    collection: 'categories',
    icon: 'label',
    fields: [
      slugField,
      nameField,
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' } },
    ],
  });
  await ensureCollection({
    collection: 'authors',
    icon: 'person',
    fields: [
      slugField,
      nameField,
      { field: 'bio', type: 'text', meta: { interface: 'input-multiline' } },
      { field: 'avatar', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } },
    ],
  });
  await ensureRelation({
    collection: 'authors',
    field: 'avatar',
    related_collection: 'directus_files',
  });
  await ensureCollection({
    collection: 'bands',
    note: 'Other bands (support acts, label mates).',
    icon: 'groups',
    fields: [
      slugField,
      nameField,
      { field: 'country', type: 'string', meta: { interface: 'input' } },
      { field: 'formed_year', type: 'integer', meta: { interface: 'input' } },
      { field: 'website', type: 'string', meta: { interface: 'input' } },
    ],
  });
}

async function seedEras() {
  const existing = (await api('/items/eras?limit=-1'))?.data || [];
  if (existing.length > 0) {
    log(`eras already has ${existing.length} rows, skipping seed`);
    return;
  }
  const rows = [
    { slug: 'early', name: 'The Early Years', short_name: 'Early', year_start: 1978, year_end: 1981, sort: 1, hue: 40, description: 'Punk-inflected beginnings through the first album.' },
    { slug: 'dark', name: 'The Dark Trilogy', short_name: 'Dark', year_start: 1981, year_end: 1983, sort: 2, hue: 260, description: 'Seventeen Seconds / Faith / Pornography — the descent.' },
    { slug: 'pop', name: 'Pop Pivot', short_name: 'Pop', year_start: 1983, year_end: 1985, sort: 3, hue: 300, description: 'The turn toward colour: Japanese Whispers / The Top / The Head on the Door.' },
    { slug: 'imperial', name: 'Imperial Phase', short_name: 'Imperial', year_start: 1985, year_end: 1992, sort: 4, hue: 285, description: 'Kiss Me, Kiss Me, Kiss Me / Disintegration / Wish — stadium sprawl.' },
    { slug: 'wilderness', name: 'Wilderness Years', short_name: 'Wilderness', year_start: 1996, year_end: 2008, sort: 5, hue: 220, description: 'Wild Mood Swings through 4:13 Dream — drift and reinvention.' },
    { slug: 'return', name: 'The Return', short_name: 'Return', year_start: 2024, year_end: 2099, sort: 6, hue: 270, description: 'Songs of a Lost World and the present era.' },
  ];
  await api('/items/eras', { method: 'POST', body: JSON.stringify(rows) });
  ok(`seeded ${rows.length} eras`);
}

/* ---------- discography: era_id + featured flag ---------- */

async function discographyExtras() {
  await ensureField(
    'discography',
    'era_id',
    'uuid',
    { interface: 'select-dropdown-m2o', special: ['m2o'], note: 'FK to eras' },
    { is_nullable: true }
  );
  await ensureRelation({
    collection: 'discography',
    field: 'era_id',
    related_collection: 'eras',
  });
  await ensureField(
    'discography',
    'is_featured_issue',
    'boolean',
    { interface: 'boolean', note: 'Single record shown as this-issue cover on home' },
    { default_value: false }
  );
}

/* ---------- news extras ---------- */

async function newsExtras() {
  await ensureField('news', 'is_editorial', 'boolean', { interface: 'boolean' }, { default_value: false });
  await ensureField(
    'news',
    'author_id',
    'uuid',
    { interface: 'select-dropdown-m2o', special: ['m2o'] },
    { is_nullable: true }
  );
  await ensureRelation({ collection: 'news', field: 'author_id', related_collection: 'authors' });
  await ensureField(
    'news',
    'category_id',
    'uuid',
    { interface: 'select-dropdown-m2o', special: ['m2o'] },
    { is_nullable: true }
  );
  await ensureRelation({ collection: 'news', field: 'category_id', related_collection: 'categories' });
}

/* ---------- setlist normalisation ---------- */

async function setlistNormalisation() {
  await ensureCollection({
    collection: 'recordings',
    icon: 'album',
    fields: [
      {
        field: 'setlist_id',
        type: 'uuid',
        meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true },
        schema: { is_nullable: false },
      },
      { field: 'type', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
        { text: 'Audience', value: 'audience' },
        { text: 'Soundboard', value: 'soundboard' },
        { text: 'Radio', value: 'radio' },
        { text: 'Video', value: 'video' },
      ] } } },
      { field: 'source', type: 'string', meta: { interface: 'input' } },
      { field: 'lineage', type: 'text', meta: { interface: 'input-multiline' } },
      { field: 'lossless', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: false } },
      { field: 'links', type: 'json', meta: { interface: 'input-code', options: { language: 'json' } } },
      { field: 'notes', type: 'text', meta: { interface: 'input-multiline' } },
    ],
  });
  await ensureRelation({
    collection: 'recordings',
    field: 'setlist_id',
    related_collection: 'setlists',
  });

  await ensureCollection({
    collection: 'setlist_media',
    icon: 'image',
    fields: [
      {
        field: 'setlist_id',
        type: 'uuid',
        meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true },
        schema: { is_nullable: false },
      },
      { field: 'kind', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
        { text: 'Ticket', value: 'ticket' },
        { text: 'Photo', value: 'photo' },
        { text: 'Video', value: 'video' },
        { text: 'Audio', value: 'audio' },
      ] } } },
      { field: 'asset', type: 'uuid', meta: { interface: 'file', special: ['file'] } },
      { field: 'url', type: 'string', meta: { interface: 'input' } },
      { field: 'caption', type: 'text', meta: { interface: 'input-multiline' } },
      { field: 'sort', type: 'integer', meta: { interface: 'input', hidden: true } },
    ],
  });
  await ensureRelation({ collection: 'setlist_media', field: 'setlist_id', related_collection: 'setlists' });
  await ensureRelation({ collection: 'setlist_media', field: 'asset', related_collection: 'directus_files' });

  await ensureCollection({
    collection: 'setlist_support_acts',
    icon: 'group',
    fields: [
      { field: 'setlist_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'band_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'sort', type: 'integer', meta: { hidden: true } },
    ],
  });
  await ensureRelation({ collection: 'setlist_support_acts', field: 'setlist_id', related_collection: 'setlists' });
  await ensureRelation({ collection: 'setlist_support_acts', field: 'band_id', related_collection: 'bands' });

  await ensureCollection({
    collection: 'setlist_performers',
    note: 'Guest performers on a particular setlist.',
    icon: 'person_add',
    fields: [
      { field: 'setlist_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'member_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'role', type: 'string', meta: { interface: 'input' } },
    ],
  });
  await ensureRelation({ collection: 'setlist_performers', field: 'setlist_id', related_collection: 'setlists' });
  await ensureRelation({ collection: 'setlist_performers', field: 'member_id', related_collection: 'members' });

  await ensureCollection({
    collection: 'setlist_reviews',
    icon: 'rate_review',
    fields: [
      { field: 'setlist_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'quote', type: 'text', meta: { interface: 'input-multiline' } },
      { field: 'cite', type: 'string', meta: { interface: 'input' } },
      { field: 'publication', type: 'string', meta: { interface: 'input' } },
      { field: 'date', type: 'date', meta: { interface: 'datetime' } },
      { field: 'url', type: 'string', meta: { interface: 'input' } },
    ],
  });
  await ensureRelation({ collection: 'setlist_reviews', field: 'setlist_id', related_collection: 'setlists' });
}

/* ---------- new content collections ---------- */

async function newContentCollections() {
  await ensureCollection({
    collection: 'gear',
    icon: 'music_note',
    fields: [
      { field: 'slug', type: 'string', meta: { interface: 'input', required: true }, schema: { is_unique: true, is_nullable: false } },
      { field: 'name', type: 'string', meta: { interface: 'input', required: true }, schema: { is_nullable: false } },
      { field: 'kind', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
        { text: 'Guitar', value: 'guitar' }, { text: 'Bass', value: 'bass' }, { text: 'Keyboard', value: 'keyboard' },
        { text: 'Drums', value: 'drums' }, { text: 'Effect', value: 'effect' }, { text: 'Amp', value: 'amp' },
        { text: 'Studio', value: 'studio' },
      ] } } },
      { field: 'description', type: 'text', meta: { interface: 'input-multiline' } },
      { field: 'image', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } },
      { field: 'used_by', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'era_range', type: 'string', meta: { interface: 'input' } },
    ],
  });
  await ensureRelation({ collection: 'gear', field: 'image', related_collection: 'directus_files' });
  await ensureRelation({ collection: 'gear', field: 'used_by', related_collection: 'members' });

  await ensureCollection({
    collection: 'quotes',
    icon: 'format_quote',
    fields: [
      { field: 'text', type: 'text', meta: { interface: 'input-multiline', required: true }, schema: { is_nullable: false } },
      { field: 'attribution', type: 'string', meta: { interface: 'input' } },
      { field: 'source', type: 'string', meta: { interface: 'input' } },
      { field: 'date', type: 'date', meta: { interface: 'datetime' } },
      { field: 'url', type: 'string', meta: { interface: 'input' } },
      { field: 'is_placeholder', type: 'boolean', meta: { interface: 'boolean', note: 'Flag fictional/editorial placeholders' }, schema: { default_value: false } },
    ],
  });

  await ensureCollection({
    collection: 'awards',
    icon: 'emoji_events',
    fields: [
      { field: 'name', type: 'string', meta: { interface: 'input', required: true }, schema: { is_nullable: false } },
      { field: 'category', type: 'string', meta: { interface: 'input' } },
      { field: 'year', type: 'integer', meta: { interface: 'input' } },
      { field: 'issuer', type: 'string', meta: { interface: 'input' } },
      { field: 'won', type: 'boolean', meta: { interface: 'boolean' }, schema: { default_value: true } },
      { field: 'related_album', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'related_song', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'note', type: 'text', meta: { interface: 'input-multiline' } },
    ],
  });
  await ensureRelation({ collection: 'awards', field: 'related_album', related_collection: 'discography' });
  await ensureRelation({ collection: 'awards', field: 'related_song', related_collection: 'songs' });

  await ensureCollection({
    collection: 'chart_positions',
    icon: 'trending_up',
    fields: [
      { field: 'album_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'single_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'song_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'territory', type: 'string', meta: { interface: 'input', note: 'e.g. UK, US Billboard 200' } },
      { field: 'peak', type: 'integer', meta: { interface: 'input' } },
      { field: 'weeks', type: 'integer', meta: { interface: 'input' } },
      { field: 'year', type: 'integer', meta: { interface: 'input' } },
    ],
  });
  await ensureRelation({ collection: 'chart_positions', field: 'album_id', related_collection: 'discography' });
  await ensureRelation({ collection: 'chart_positions', field: 'single_id', related_collection: 'singles' });
  await ensureRelation({ collection: 'chart_positions', field: 'song_id', related_collection: 'songs' });

  await ensureCollection({
    collection: 'lyric_annotations',
    icon: 'comment',
    fields: [
      { field: 'song_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { is_nullable: false } },
      { field: 'line_id', type: 'string', meta: { interface: 'input', note: 'Matches lyrics_structured line_id' } },
      { field: 'note', type: 'text', meta: { interface: 'input-rich-text-md' } },
      { field: 'source', type: 'string', meta: { interface: 'input' } },
      { field: 'url', type: 'string', meta: { interface: 'input' } },
    ],
  });
  await ensureRelation({ collection: 'lyric_annotations', field: 'song_id', related_collection: 'songs' });

  await ensureCollection({
    collection: 'poll_votes',
    note: 'Anonymous poll votes, IP-hashed.',
    icon: 'how_to_vote',
    fields: [
      { field: 'poll_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'option_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'ip_hash', type: 'string', meta: { interface: 'input' } },
      { field: 'user_agent', type: 'string', meta: { interface: 'input' } },
      { field: 'created_at', type: 'timestamp', meta: { interface: 'datetime', special: ['date-created'] } },
    ],
  });
  await ensureRelation({ collection: 'poll_votes', field: 'poll_id', related_collection: 'polls' });
  await ensureRelation({ collection: 'poll_votes', field: 'option_id', related_collection: 'poll_options' });

  await ensureCollection({
    collection: 'contributions',
    note: 'User-submitted edits queue.',
    icon: 'edit_note',
    fields: [
      { field: 'status', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
        { text: 'Pending', value: 'pending' }, { text: 'Approved', value: 'approved' }, { text: 'Rejected', value: 'rejected' },
      ] } }, schema: { default_value: 'pending' } },
      { field: 'target_collection', type: 'string', meta: { interface: 'input' } },
      { field: 'target_id', type: 'string', meta: { interface: 'input' } },
      { field: 'kind', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
        { text: 'Correction', value: 'correction' }, { text: 'Addition', value: 'addition' }, { text: 'Other', value: 'other' },
      ] } } },
      { field: 'submitter_name', type: 'string', meta: { interface: 'input' } },
      { field: 'submitter_email', type: 'string', meta: { interface: 'input' } },
      { field: 'message', type: 'text', meta: { interface: 'input-multiline' } },
      { field: 'payload', type: 'json', meta: { interface: 'input-code', options: { language: 'json' } } },
      { field: 'ip_hash', type: 'string', meta: { interface: 'input' } },
      { field: 'created_at', type: 'timestamp', meta: { interface: 'datetime', special: ['date-created'] } },
    ],
  });

  await ensureCollection({
    collection: 'on_this_day_cache',
    note: 'Materialised view; nightly flow populates.',
    icon: 'today',
    fields: [
      { field: 'day_key', type: 'string', meta: { interface: 'input', note: 'MM-DD' } },
      { field: 'event_date', type: 'date', meta: { interface: 'datetime' } },
      { field: 'year', type: 'integer', meta: { interface: 'input' } },
      { field: 'kind', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
        { text: 'Concert', value: 'concert' }, { text: 'Release', value: 'release' }, { text: 'Milestone', value: 'milestone' },
      ] } } },
      { field: 'title', type: 'string', meta: { interface: 'input' } },
      { field: 'subtitle', type: 'string', meta: { interface: 'input' } },
      { field: 'link_collection', type: 'string', meta: { interface: 'input' } },
      { field: 'link_slug', type: 'string', meta: { interface: 'input' } },
      { field: 'era_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'image', type: 'uuid', meta: { interface: 'file-image', special: ['file'] } },
    ],
  });
  await ensureRelation({ collection: 'on_this_day_cache', field: 'era_id', related_collection: 'eras' });
  await ensureRelation({ collection: 'on_this_day_cache', field: 'image', related_collection: 'directus_files' });

  await ensureCollection({
    collection: 'wiki_articles',
    icon: 'menu_book',
    fields: [
      { field: 'slug', type: 'string', meta: { interface: 'input', required: true }, schema: { is_unique: true, is_nullable: false } },
      { field: 'title', type: 'string', meta: { interface: 'input', required: true }, schema: { is_nullable: false } },
      { field: 'subtitle', type: 'string', meta: { interface: 'input' } },
      { field: 'status', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
        { text: 'Draft', value: 'draft' }, { text: 'Published', value: 'published' },
      ] } }, schema: { default_value: 'draft' } },
      { field: 'toc', type: 'json', meta: { interface: 'input-code', options: { language: 'json' } } },
      { field: 'body_sections', type: 'json', meta: { interface: 'input-code', options: { language: 'json' } } },
      { field: 'aside_facts', type: 'json', meta: { interface: 'input-code', options: { language: 'json' } } },
      { field: 'related', type: 'json', meta: { interface: 'input-code', options: { language: 'json' } } },
      { field: 'updated_at', type: 'timestamp', meta: { interface: 'datetime', special: ['date-updated'] } },
      { field: 'era_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
    ],
  });
  await ensureRelation({ collection: 'wiki_articles', field: 'era_id', related_collection: 'eras' });

  await ensureCollection({
    collection: 'photo_tags',
    note: 'Junction table: photos × tags.',
    icon: 'label',
    fields: [
      { field: 'photo_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
      { field: 'tag_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] } },
    ],
  });
  await ensureRelation({ collection: 'photo_tags', field: 'photo_id', related_collection: 'photos' });
  await ensureRelation({ collection: 'photo_tags', field: 'tag_id', related_collection: 'tags' });
}

/* ---------- storage presets ---------- */

async function storagePresets() {
  const settings = await api('/settings');
  const current: any[] = settings?.data?.storage_asset_presets || [];
  const wanted = [
    { key: 'card', fit: 'cover', width: 480, height: 480, quality: 75, withoutEnlargement: 'true', format: 'webp' },
    { key: 'hero', fit: 'cover', width: 1600, height: 2133, quality: 85, withoutEnlargement: 'true', format: 'webp' },
    { key: 'thumb', fit: 'cover', width: 120, height: 120, quality: 70, withoutEnlargement: 'true', format: 'webp' },
    { key: 'og', fit: 'cover', width: 1200, height: 630, quality: 80, withoutEnlargement: 'true', format: 'jpg' },
  ];
  const existingKeys = new Set(current.map((p) => p.key));
  const merged = [...current];
  let added = 0;
  for (const w of wanted) {
    if (!existingKeys.has(w.key)) {
      merged.push(w);
      added++;
    }
  }
  if (added === 0) {
    log('storage presets already present');
    return;
  }
  await api('/settings', {
    method: 'PATCH',
    body: JSON.stringify({ storage_asset_presets: merged }),
  });
  ok(`storage presets: added ${added}`);
}

/* ---------- main ---------- */

async function main() {
  console.log(`→ Directus migration @ ${URL_BASE}`);
  await taxonomies();
  await seedEras();
  await discographyExtras();
  await newsExtras();
  await setlistNormalisation();
  await newContentCollections();
  await storagePresets();
  console.log('\n✔ migration complete');
}

main().catch((e) => {
  console.error('\n✗ migration failed:', e.message);
  process.exit(1);
});
