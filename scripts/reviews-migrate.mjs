/**
 * Create the Directus reviews collection and publish one editorial review for
 * every Cure studio album.
 *
 * Usage:
 *   DIRECTUS_TOKEN=... node scripts/reviews-migrate.mjs
 */

import https from 'node:https';

const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'https://dash.cureation.net').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

if (!DIRECTUS_TOKEN) throw new Error('DIRECTUS_TOKEN is required');

const PUBLIC_POLICY_ID = 'abf8a154-5b1c-4a46-ac9c-7300570f4f17';
const PUBLISHED_DATE = '2026-08-15';
const AUTHOR_NAME = 'Bernard McWeeney';

async function api(path, init = {}) {
  const url = new URL(path, DIRECTUS_URL);
  const response = await new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: init.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    }, (incoming) => {
      let body = '';
      incoming.setEncoding('utf8');
      incoming.on('data', (chunk) => { body += chunk; });
      incoming.on('end', () => resolve({
        ok: incoming.statusCode >= 200 && incoming.statusCode < 300,
        status: incoming.statusCode,
        statusText: incoming.statusMessage,
        text: body,
      }));
    });
    request.on('error', reject);
    if (init.body) request.write(init.body);
    request.end();
  });

  const text = response.text;
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = json?.errors?.map((error) => error.message).join('; ') || text || response.statusText;
    const error = new Error(`${init.method || 'GET'} ${path} failed (${response.status}): ${detail}`);
    error.status = response.status;
    throw error;
  }
  return json?.data ?? null;
}

async function exists(path) {
  try {
    await api(path);
    return true;
  } catch (error) {
    // Directus returns 403 rather than 404 for some missing schema objects.
    if (error.status === 403 || error.status === 404) return false;
    throw error;
  }
}

async function ensureCollection() {
  if (!(await exists('/collections/reviews'))) {
    await api('/collections', {
      method: 'POST',
      body: JSON.stringify({
        collection: 'reviews',
        schema: {},
        meta: {
          icon: 'rate_review',
          note: 'Long-form editorial reviews linked to discography releases.',
          display_template: '{{title}}',
          hidden: false,
          singleton: false,
          accountability: 'all',
          collapse: 'open',
        },
      }),
    });
  }
}

const fields = [
  {
    field: 'status', type: 'string',
    schema: { is_nullable: false, default_value: 'draft', max_length: 32 },
    meta: {
      interface: 'select-dropdown', required: true, sort: 2, width: 'half',
      options: { choices: [
        { text: 'Draft', value: 'draft', color: '#A2B5CD' },
        { text: 'In review', value: 'in_review', color: '#F2C94C' },
        { text: 'Published', value: 'published', color: '#2ECDA7' },
        { text: 'Archived', value: 'archived', color: '#F2994A' },
      ] },
    },
  },
  {
    field: 'sort', type: 'integer', schema: { is_nullable: true },
    meta: { interface: 'input', hidden: true, sort: 3, width: 'half' },
  },
  {
    field: 'user_created', type: 'string',
    schema: { is_nullable: true, max_length: 36 },
    meta: { interface: 'select-dropdown-m2o', special: ['user-created'], readonly: true, hidden: true, sort: 4 },
  },
  {
    field: 'date_created', type: 'timestamp', schema: { is_nullable: true },
    meta: { interface: 'datetime', special: ['date-created', 'cast-timestamp'], readonly: true, hidden: true, sort: 5 },
  },
  {
    field: 'user_updated', type: 'string',
    schema: { is_nullable: true, max_length: 36 },
    meta: { interface: 'select-dropdown-m2o', special: ['user-updated'], readonly: true, hidden: true, sort: 6 },
  },
  {
    field: 'date_updated', type: 'timestamp', schema: { is_nullable: true },
    meta: { interface: 'datetime', special: ['date-updated', 'cast-timestamp'], readonly: true, hidden: true, sort: 7 },
  },
  {
    field: 'album', type: 'integer',
    schema: { is_nullable: false, is_unique: true },
    meta: {
      interface: 'select-dropdown-m2o', special: ['m2o'], required: true,
      note: 'The studio album reviewed by this article.', sort: 8, width: 'half',
      display: 'related-values', display_options: { template: '{{title}}' },
    },
  },
  {
    field: 'title', type: 'string',
    schema: { is_nullable: false, max_length: 255 },
    meta: { interface: 'input', required: true, sort: 9, width: 'full' },
  },
  {
    field: 'slug', type: 'string',
    schema: { is_nullable: false, is_unique: true, max_length: 255 },
    meta: { interface: 'input', special: ['slug'], required: true, sort: 10, width: 'half' },
  },
  {
    field: 'score', type: 'float', schema: { is_nullable: true },
    meta: { interface: 'input', sort: 11, width: 'half', options: { min: 0, max: 10, step: 0.1 } },
  },
  {
    field: 'standfirst', type: 'text', schema: { is_nullable: true },
    meta: { interface: 'input-multiline', note: 'Short introduction used on cards and social previews.', sort: 12, width: 'full' },
  },
  {
    field: 'body', type: 'text', schema: { is_nullable: false },
    meta: { interface: 'input-rich-text-html', required: true, sort: 13, width: 'full' },
  },
  {
    field: 'verdict', type: 'text', schema: { is_nullable: true },
    meta: { interface: 'input-multiline', sort: 14, width: 'full' },
  },
  {
    field: 'standout_tracks', type: 'json', schema: { is_nullable: true },
    meta: { interface: 'tags', sort: 15, width: 'full' },
  },
  {
    field: 'author_name', type: 'string',
    schema: { is_nullable: false, default_value: AUTHOR_NAME, max_length: 255 },
    meta: { interface: 'input', required: true, sort: 16, width: 'half' },
  },
  {
    field: 'published_date', type: 'date', schema: { is_nullable: true },
    meta: { interface: 'datetime', sort: 17, width: 'half' },
  },
  {
    field: 'reading_time', type: 'integer', schema: { is_nullable: true },
    meta: { interface: 'input', note: 'Estimated reading time in minutes.', sort: 18, width: 'half' },
  },
  {
    field: 'featured', type: 'boolean', schema: { is_nullable: false, default_value: false },
    meta: { interface: 'boolean', special: ['cast-boolean'], sort: 19, width: 'half' },
  },
  {
    field: 'seo_title', type: 'string', schema: { is_nullable: true, max_length: 255 },
    meta: { interface: 'input', sort: 20, width: 'full' },
  },
  {
    field: 'seo_description', type: 'text', schema: { is_nullable: true },
    meta: { interface: 'input-multiline', sort: 21, width: 'full' },
  },
  {
    field: 'editorial_notes', type: 'text', schema: { is_nullable: true },
    meta: { interface: 'input-multiline', note: 'Internal notes; excluded from public API access.', sort: 22, width: 'full' },
  },
];

async function ensureFields() {
  for (const field of fields) {
    if (await exists(`/fields/reviews/${field.field}`)) continue;
    await api('/fields/reviews', { method: 'POST', body: JSON.stringify(field) });
  }

  if (!(await exists('/fields/discography/reviews'))) {
    await api('/fields/discography', {
      method: 'POST',
      body: JSON.stringify({
        field: 'reviews', type: 'alias', schema: null,
        meta: {
          interface: 'list-o2m', special: ['o2m'], sort: 35, width: 'full',
          note: 'Published and draft editorial reviews of this release.',
          display: 'related-values',
          options: { template: '{{title}} · {{score}}/10', enableCreate: true, enableSelect: true },
        },
      }),
    });
  }
}

async function ensureRelation(field, relatedCollection, options = {}) {
  const relationPath = `/relations/reviews/${field}`;
  const relationExists = await exists(relationPath);
  const payload = {
    collection: 'reviews',
    field,
    related_collection: relatedCollection,
    meta: {
      many_collection: 'reviews',
      many_field: field,
      one_collection: relatedCollection,
      one_field: options.oneField || null,
      one_deselect_action: 'nullify',
    },
    schema: {
      on_update: 'NO ACTION',
      on_delete: options.onDelete || 'SET NULL',
    },
  };
  await api(relationExists ? relationPath : '/relations', {
    method: relationExists ? 'PATCH' : 'POST',
    body: JSON.stringify(payload),
  });
}

async function ensureRelations() {
  await ensureRelation('album', 'discography', { oneField: 'reviews', onDelete: 'NO ACTION' });
  await ensureRelation('user_created', 'directus_users');
  await ensureRelation('user_updated', 'directus_users');
}

async function configureCollection() {
  await api('/collections/reviews', {
    method: 'PATCH',
    body: JSON.stringify({
      meta: {
        icon: 'rate_review',
        note: 'Long-form editorial reviews linked to discography releases.',
        display_template: '{{title}}',
        archive_field: 'status',
        archive_value: 'archived',
        unarchive_value: 'draft',
        archive_app_filter: true,
        sort_field: 'sort',
        accountability: 'all',
      },
    }),
  });
}

async function ensurePublicPermission() {
  const params = new URLSearchParams({
    limit: '-1',
    'filter[policy][_eq]': PUBLIC_POLICY_ID,
    'filter[collection][_eq]': 'reviews',
    'filter[action][_eq]': 'read',
    fields: 'id',
  });
  const existing = await api(`/permissions?${params}`);
  const payload = {
    policy: PUBLIC_POLICY_ID,
    collection: 'reviews',
    action: 'read',
    permissions: { status: { _eq: 'published' } },
    validation: null,
    presets: null,
    fields: [
      'id', 'status', 'album', 'title', 'slug', 'standfirst', 'body', 'score',
      'verdict', 'standout_tracks', 'author_name', 'published_date', 'reading_time',
      'featured', 'seo_title', 'seo_description', 'date_created', 'date_updated',
    ],
  };

  await api(existing.length ? `/permissions/${existing[0].id}` : '/permissions', {
    method: existing.length ? 'PATCH' : 'POST',
    body: JSON.stringify(payload),
  });
}

const drafts = [
  {
    album: 8,
    slug: 'three-imaginary-boys',
    title: 'Three Imaginary Boys: The sound of a band becoming itself',
    score: 7.4,
    standfirst: 'Restless, sharp and not entirely under its creators’ control, The Cure’s debut is most compelling when the future briefly comes into focus.',
    verdict: 'An uneven but fascinating debut whose best moments already contain the tension, space and melodic instinct that would define The Cure.',
    standout_tracks: ['10:15 Saturday Night', 'Fire in Cairo', 'Three Imaginary Boys'],
    paragraphs: [
      'Three Imaginary Boys sounds like a first album in the truest sense: a document of a young band moving faster than its identity can settle. Its clipped guitars, lean rhythm section and dry, watchful vocals belong to the late-1970s post-punk moment, yet Robert Smith’s writing is already tugging away from the expected shapes. “10:15 Saturday Night” turns an ordinary domestic image into something hypnotic and faintly threatening; “Fire in Cairo” is all nervous momentum; the title track discovers the suspended, inward atmosphere The Cure would soon make its own.',
      'The record’s unevenness is part of its history and part of its appeal. Producer Chris Parry’s influence and the label-led track selection leave the album feeling less like a finished manifesto than a set of competing possibilities. The throwaway cover of “Foxy Lady” interrupts the mood, while several short, angular songs sketch ideas the band would later explore with far greater patience. Even so, the playing has a wiry confidence. Michael Dempsey’s melodic bass often carries as much narrative weight as the guitar, and Lol Tolhurst’s drumming keeps the songs urgent and spare.',
      'What survives the compromises is a distinctive emotional temperature: detached without being cold, playful without sounding carefree. Smith had not yet built the huge emotional architecture of the records to come, but he had found the unease at its foundation. Heard now, Three Imaginary Boys works best not as a definitive Cure album but as an unusually vivid beginning–the sound of a band testing doors, rejecting some and quietly leaving the most important ones open.'
    ],
  },
  {
    album: 9,
    slug: 'seventeen-seconds',
    title: 'Seventeen Seconds: Empty space, perfect tension',
    score: 8.8,
    standfirst: 'With one decisive turn toward silence, repetition and atmosphere, The Cure found a language that still feels entirely their own.',
    verdict: 'A concise atmospheric breakthrough, haunted by what it leaves unsaid and crowned by one of The Cure’s defining songs.',
    standout_tracks: ['A Forest', 'Play for Today', 'At Night'],
    paragraphs: [
      'The leap from Three Imaginary Boys to Seventeen Seconds is less a progression than a change in climate. Everything suddenly feels colder, wider and more deliberate. Guitars arrive as pale streaks rather than riffs; keyboards hover at the edge of perception; Simon Gallup’s bass gives the music both pulse and gravity. The Cure stop trying to fill every space and discover how much tension can live inside an empty one.',
      'That discipline makes the album’s short running time feel complete. “A Reflection” opens the door without explaining what lies beyond it, while “Play for Today” and “In Your House” turn repetition into emotional pressure. Even the fragments–“Three”, “The Final Sound”–matter as changes in light. Then “A Forest” gathers every lesson into a single, inexorable movement: the bass line advances, the guitars flicker, and Smith’s pursuit of something absent becomes the band’s first truly monumental recording.',
      'Mike Hedges and The Cure give the record a soft-focus surface, but the writing underneath is exact. Nothing is ornamental. Each part appears because the mood would collapse without it. Later albums would be heavier, grander and more openly romantic; Seventeen Seconds remains special because it achieves so much with restraint. It is the moment The Cure learned that atmosphere was not decoration around a song. Atmosphere could be the song.'
    ],
  },
  {
    album: 10,
    slug: 'faith',
    title: 'Faith: The long grey afternoon',
    score: 8.7,
    standfirst: 'Slow, severe and quietly beautiful, Faith turns doubt and grief into an album of remarkable physical presence.',
    verdict: 'A demanding, deeply coherent record whose austere surfaces conceal some of The Cure’s most moving early work.',
    standout_tracks: ['The Funeral Party', 'All Cats Are Grey', 'Faith'],
    paragraphs: [
      'Faith does not invite the listener in so much as surround them. The tempo slows, the colours drain away and every instrument seems to carry the weight of a difficult thought. Where Seventeen Seconds used minimalism to create suspense, Faith uses it to create permanence: these songs do not feel like passing moods but rooms the band has been living in for too long.',
      'The record’s power lies in variation within that narrow emotional range. “Primary” moves with a rare flash of urgency, its twin bass attack pushing against the album’s stillness. “All Cats Are Grey” is almost weightless, a voice drifting through keyboards and restrained percussion. “The Funeral Party” is stately and devastating, while “The Drowning Man” converts literary inspiration into something immediate and bodily. Smith sings plainly, often from a distance, and that refusal to overstate the emotion makes it land harder.',
      'There are no easy releases here. Even the title track stretches toward belief while sounding certain it will not arrive. Yet Faith is not monotonous, and it is not merely bleak. Its careful production, patient pacing and sense of shared space give the album a grave beauty. This is The Cure learning how to sustain a world across an entire record–an achievement that demands attention but rewards it with an intimacy unlike anything else in their catalogue.'
    ],
  },
  {
    album: 11,
    slug: 'pornography',
    title: 'Pornography: No exit, no wasted motion',
    score: 9.3,
    standfirst: 'The Cure’s darkest record remains overwhelming because its chaos is shaped with absolute purpose.',
    verdict: 'A brutal, meticulously constructed landmark that turns personal collapse into an album of enduring force.',
    standout_tracks: ['One Hundred Years', 'The Figurehead', 'A Strange Day'],
    paragraphs: [
      'Pornography begins with a sentence of total despair and spends the next forty minutes proving it is not an empty provocation. The drums thunder as if recorded in a sealed room, guitars smear into sheets of corrosion, and the bass moves with funereal certainty. This is often described as The Cure at their bleakest, but darkness alone does not explain the record’s durability. Its real achievement is control: every overwhelming sound has a place, every repetition tightens the frame.',
      '“One Hundred Years” is an astonishing opening assault, its forward motion made more frightening by the absence of escape. “The Hanging Garden” turns percussion into ritual; “Siamese Twins” slows the album to a sickened crawl; “The Figurehead” builds a private vocabulary of shame and exhaustion. Amid the density, “A Strange Day” offers the clearest horizon, a sweeping melody that suggests transcendence without pretending the surrounding crisis has disappeared.',
      'The circumstances around the album–substance use, internal conflict, physical and emotional exhaustion–could have produced an incoherent document. Instead, Robert Smith, Simon Gallup and Lol Tolhurst created one of post-punk’s most unified statements. Pornography is not a comfortable record and should not become one through familiarity. Its greatness lies in how fiercely it preserves the sensation of reaching a limit, then finding form at the very edge of it.'
    ],
  },
  {
    album: 12,
    slug: 'the-top',
    title: 'The Top: Fever dreams and loose ends',
    score: 7.5,
    standfirst: 'Messy by design and fascinating in practice, The Top catches Robert Smith rebuilding The Cure in public.',
    verdict: 'An unruly transitional album whose psychedelic excesses are inseparable from its strange, singular charm.',
    standout_tracks: ['Shake Dog Shake', 'The Caterpillar', 'Piggy in the Mirror'],
    paragraphs: [
      'The Top is the sound of The Cure after the apparent ending, with Robert Smith pulling the project back together while refusing to settle on a single direction. The oppressive architecture of Pornography has broken apart. In its place come psychedelic colour, distorted funk, nursery-rhyme unease and flashes of pop clarity. The result is unstable, sometimes exhausting and never anonymous.',
      '“Shake Dog Shake” opens with scorched theatricality, announcing that restraint will not be the governing principle. “Bird Mad Girl” and “Dressing Up” drift through stranger, softer spaces, while “Give Me It” pushes agitation close to caricature. At the album’s centre, “The Caterpillar” finds a delicate balance: playful percussion, an instantly recognisable melody and lyrics that make infatuation feel magical and absurd. “Piggy in the Mirror” turns that humour inward, pairing self-disgust with one of the record’s most elastic grooves.',
      'The Top lacks the coherence of the albums on either side of it, but coherence may be the wrong demand. This is a workshop with the doors open, capturing Smith as he tests which parts of The Cure can survive and which new versions might emerge. Not every experiment lands. Enough of them do, and the failures are rarely dull. Its place in the catalogue is not as a neglected masterpiece, but as the necessary, colourful confusion from which the next era could begin.'
    ],
  },
  {
    album: 13,
    slug: 'the-head-on-the-door',
    title: 'The Head on the Door: Ten songs, a whole world',
    score: 9.0,
    standfirst: 'Compact, varied and endlessly replayable, The Head on the Door turns The Cure’s contradictions into pop perfection.',
    verdict: 'The definitive gateway album: adventurous enough for devotees, immediate enough to make a new listener stay.',
    standout_tracks: ['In Between Days', 'Push', 'Sinking'],
    paragraphs: [
      'The Head on the Door solves a problem The Cure had never quite posed so directly: how can one album hold bright pop, nocturnal dread, romantic drama and surreal play without sounding scattered? The answer is economy. Ten songs, none overstaying its welcome, each opening a distinct space and then handing the listener cleanly to the next.',
      '“In Between Days” is breathless and bittersweet, a rush of acoustic guitar carrying one of Robert Smith’s most direct melodies. “Kyoto Song” and “The Blood” twist the atmosphere toward dream and heat; “Six Different Ways” makes eccentricity feel effortless. The album’s secret centre may be “Push”, where a long instrumental ascent turns anticipation into release. “Close to Me” reduces the band to nervous rhythm and breath, while “A Night Like This” expands into widescreen longing. Finally, “Sinking” lowers the lights with extraordinary grace.',
      'The restored five-piece lineup matters. Simon Gallup’s bass has returned, Boris Williams brings precision without stiffness, and Porl Thompson and Lol Tolhurst help create a palette broad enough for Smith’s songs. David M. Allen’s production keeps every detail legible. The Head on the Door became a commercial breakthrough because it was accessible, but it endures because accessibility never simplified the band. It presents The Cure not as one mood, but as a complete and convincing world.'
    ],
  },
  {
    album: 14,
    slug: 'kiss-me-kiss-me-kiss-me',
    title: 'Kiss Me, Kiss Me, Kiss Me: Desire in every direction',
    score: 9.0,
    standfirst: 'The Cure’s great double album is excessive, romantic, abrasive and alive–the catalogue at its most gloriously plural.',
    verdict: 'A sprawling triumph whose abundance is the argument: every version of The Cure seems to turn up, and most are irresistible.',
    standout_tracks: ['Just Like Heaven', 'The Kiss', 'If Only Tonight We Could Sleep', 'Like Cockatoos'],
    paragraphs: [
      'Kiss Me, Kiss Me, Kiss Me does not ask to be streamlined. Its eighteen tracks are the point: a catalogue of appetites, tempers and textures that refuses the idea that The Cure must choose between pop band and dark institution. The opening title track is all scorched guitar and barely contained fury; within minutes “Catch” is offering one of the lightest melodies Robert Smith ever wrote. The distance between them defines the album’s freedom.',
      'That range keeps producing unlikely peaks. “If Only Tonight We Could Sleep” moves with dreamlike ritual, while “The Snakepit” sinks into a long psychedelic coil. “Why Can’t I Be You?” and “Hot Hot Hot!!!” are shameless kinetic pop. Then comes “Just Like Heaven”, three and a half minutes in which arrangement, melody and emotional perspective align so perfectly that familiarity has done little to diminish it. Deeper in the sequence, “Like Cockatoos” and “A Thousand Hours” prove the album’s shadows are as carefully drawn as its singles.',
      'There are moments when the scale blurs the impact, and a shorter record would be easier to defend track by track. It would also be less truthful. Desire here is excessive by nature–romantic, physical, jealous, euphoric–and the double-album form lets those states contradict one another. This is The Cure at full stretch, confident that identity can come from a sensibility rather than a consistent sound.'
    ],
  },
  {
    album: 7,
    slug: 'disintegration',
    title: 'Disintegration: The masterpiece that keeps moving',
    score: 10,
    standfirst: 'Immense yet intimate, Disintegration turns time, memory and romantic fear into The Cure’s most complete album.',
    verdict: 'The Cure’s defining work: emotionally exact, sonically vast and sequenced with the inevitability of a dream.',
    standout_tracks: ['Plainsong', 'Pictures of You', 'Lovesong', 'The Same Deep Water as You'],
    featured: true,
    paragraphs: [
      'The first seconds of “Plainsong” feel less like an introduction than a weather system arriving. Chimes flare, synthesizers widen the horizon and the band enters with immense patience. Disintegration sustains that scale for more than an hour without losing intimacy. Its songs are about memory, devotion, ageing, jealousy and the fear that every perfect moment already contains its ending; the production makes those thoughts feel architectural.',
      'The sequence is almost impossibly strong. “Pictures of You” lets remembrance expand until it becomes a place of its own. “Closedown” is compressed anxiety, “Lovesong” radical in its simplicity, and “Lullaby” turns childhood menace into strange theatrical pop. The second half travels deeper: “Prayers for Rain” makes repetition punishing, “The Same Deep Water as You” drifts at the edge of consciousness, and the title track converts self-accusation into an overwhelming communal release. “Untitled” closes not with resolution but with the ache of being unable to return.',
      'What prevents the album from collapsing beneath its seriousness is the band’s melodic intelligence. Simon Gallup’s bass is constantly memorable, Boris Williams gives even the slowest songs motion, and layers of guitar and keyboard reveal new internal lines with each listen. David M. Allen and Robert Smith achieve density without mud. Disintegration is regularly called The Cure’s masterpiece because the word is convenient. It remains one because the record still feels alive inside that reputation–still moving, still opening, still capable of making familiar emotions seem enormous and newly discovered.'
    ],
  },
  {
    album: 6,
    slug: 'wish',
    title: 'Wish: Bright light, deep water',
    score: 9.2,
    standfirst: 'At their commercial peak, The Cure made a record that holds euphoria and collapse in the same wide-open sound.',
    verdict: 'A generous, muscular album that balances perfect pop with some of The Cure’s most expansive and emotionally charged performances.',
    standout_tracks: ['From the Edge of the Deep Green Sea', 'Friday I’m in Love', 'To Wish Impossible Things'],
    paragraphs: [
      'Wish opens with feedback and closes with the word “end”, but between those points it contains some of The Cure’s most life-affirming music. The popular memory centres on “Friday I’m in Love”, understandably: it is a near-perfect pop song, light on its feet and built to survive endless repetition. Yet the album surrounding it is bigger, stranger and more emotionally volatile than that single suggests.',
      'The guitars are the defining texture. “Open” arrives in a dense, circling roar; “High” makes that shimmer buoyant; “From the Edge of the Deep Green Sea” turns it into a vast dramatic landscape. The band sounds unusually physical, with Boris Williams’s drumming and Simon Gallup’s bass driving songs that might otherwise dissolve into atmosphere. Even the softer moments carry tension. “Apart” and “Trust” are direct without being plain, while “To Wish Impossible Things” pares everything back to a quiet devastation.',
      'Not every choice is equally strong, and the album’s sequencing deliberately swings between emotional extremes. That instability suits it. Wish is about wanting the moment to remain while knowing it cannot, whether the moment is ecstatic, romantic or destructive. Following Disintegration was an impossible task; The Cure succeeded by refusing to reproduce it. They made a brighter record with its own depths, and one whose scale captures a band at the height of its confidence.'
    ],
  },
  {
    album: 15,
    slug: 'wild-mood-swings',
    title: 'Wild Mood Swings: The argument for inconsistency',
    score: 7.1,
    standfirst: 'The Cure’s most disputed album is overstuffed and tonally unstable, but its risks deserve more than a dismissive verdict.',
    verdict: 'A flawed, adventurous record with enough beauty and nerve to reward listeners willing to accept its abrupt changes of weather.',
    standout_tracks: ['Want', 'Jupiter Crash', 'Treasure', 'Bare'],
    paragraphs: [
      'Wild Mood Swings announces its method in the title. This is an album of abrupt pivots: brass and Latin rhythm beside slow grief, bright singles beside songs that seem to distrust brightness itself. After the cohesion of Wish, the lack of a stable centre can feel disorienting. It can also feel honest–a band in transition refusing to disguise uncertainty as unity.',
      'The strongest material is formidable. “Want” begins with gathering pressure and opens into one of Robert Smith’s great statements of insatiability. “Jupiter Crash” is delicate, observational and beautifully paced. “Treasure” and “Bare” give the closing stretch emotional weight, the latter allowing its sadness the time it needs. Elsewhere, “The 13th” and “Gone!” embrace arrangements rarely associated with The Cure. Whether those experiments charm or repel may determine a listener’s response to the album as a whole.',
      'The problem is not variety itself–Kiss Me, Kiss Me, Kiss Me thrives on it–but the transitions and occasional sense that performance is outrunning song. Still, the long-standing reputation of Wild Mood Swings as a failure obscures its craft and its willingness to risk embarrassment. A more cautious Cure album would have been neater and less interesting. This one misses in public, recovers, and sometimes finds beauty precisely because it has wandered so far from safety.'
    ],
  },
  {
    album: 16,
    slug: 'bloodflowers',
    title: 'Bloodflowers: The beauty of the long goodbye',
    score: 8.5,
    standfirst: 'Patient and autumnal, Bloodflowers finds The Cure returning to long-form melancholy without pretending the past can be repeated.',
    verdict: 'A mature, immersive record that gains power from patience and stands among The Cure’s strongest late-period work.',
    standout_tracks: ['Out of This World', 'The Last Day of Summer', 'Bloodflowers'],
    paragraphs: [
      'Bloodflowers is often introduced through lineage: Robert Smith connected it to Pornography and Disintegration, making it the final part of a dark trilogy. The comparison sets a difficult standard and can obscure what is distinctive here. This is not the crisis music of 1982 or the romantic vastness of 1989. It is an album about looking back from a distance, aware that endings become visible long before they arrive.',
      'The songs take their time. “Out of This World” opens with a farewell already in progress, its guitars glowing rather than cutting. “Watching Me Fall” stretches beyond ten minutes, accumulating scale through repetition. “Where the Birds Always Sing” asks large questions without forcing an answer, while “The Last Day of Summer” gives the record its clearest, most affecting image of impermanence. The production by Smith and Paul Corkett favours depth and continuity; tracks seem to emerge from the same dusk.',
      'A few passages blur together, and listeners looking for the sharp contrasts of the band’s pop records may find the pace forbidding. Bloodflowers depends on surrender to duration. Once that happens, its emotional shape becomes clear. The title track brings the themes together not as final closure but as acceptance that beauty and loss share a root. The album does not recreate an earlier Cure. It lets an older band speak in a familiar language with a newly measured voice.'
    ],
  },
  {
    album: 17,
    slug: 'the-cure',
    title: 'The Cure: Raw edges, mixed results',
    score: 6.9,
    standfirst: 'The self-titled album pushes The Cure toward a harsher, more immediate sound, gaining force while sacrificing some of their mystery.',
    verdict: 'A committed and often powerful experiment whose compressed aggression suits some songs far better than others.',
    standout_tracks: ['Lost', 'Before Three', 'The End of the World'],
    paragraphs: [
      'Calling an album The Cure after twenty-five years suggests a statement of essence. The music complicates that expectation immediately. Working with Ross Robinson, the band adopts a raw, pressurised sound associated more with his heavy-rock productions than with The Cure’s carefully layered atmosphere. Performances are pushed to the foreground; drums hit hard, vocals strain, guitars crowd the frame.',
      'At its best, the approach creates genuine urgency. “Lost” begins in confusion and swells into anger, Robert Smith’s repeated final line gaining force through discomfort. “Before Three” finds melody inside the abrasive mix, and “The End of the World” is a strong pop song wearing rougher clothes. “Anniversary” slows the record into a more recognisably haunted space. Elsewhere, particularly when the writing leans on volume as its main argument, the compression can flatten the emotional distinctions that usually make a Cure album breathe.',
      'The self-titled record is easier to admire than to love consistently. It is not a band coasting; the performances are too exposed and the stylistic choice too risky for that. But Robinson’s insistence on immediacy sometimes removes the distance in which Smith’s songs become uncanny. The Cure remains a valuable detour, with several excellent songs and a clear refusal to curate a comfortable legacy. Its frustrations are the frustrations of an experiment pursued seriously.'
    ],
  },
  {
    album: 18,
    slug: '4-13-dream',
    title: '4:13 Dream: Colour after the storm',
    score: 7.3,
    standfirst: 'Bright guitars and direct melodies give The Cure’s thirteenth album an appealing lift, even when the larger design feels unfinished.',
    verdict: 'An energetic, underrated set whose best songs sparkle, though the shadow of its abandoned double-album form remains.',
    standout_tracks: ['Underneath the Stars', 'The Hungry Ghost', 'This. Here and Now. With You.'],
    paragraphs: [
      '“Underneath the Stars” opens 4:13 Dream on a scale that promises an epic: guitars spiral, the rhythm section surges and Robert Smith sounds fully at home inside the weather. Much of what follows is leaner and brighter. After the forceful self-titled album, The Cure rediscover air in the mix and an almost youthful appetite for sharp, colourful guitar pop.',
      'The directness works well on “The Reasons Why” and “The Hungry Ghost”, songs that pair familiar concerns with uncluttered hooks. “This. Here and Now. With You.” is especially affecting, its awkward title resolving into an intimate insistence on presence. “Sleep When I’m Dead” carries the snap of an older idea revived with enthusiasm. The weaker moments feel less like bad songs than pieces detached from a larger intended picture; the album was conceived from sessions once planned as a double release, and its final sequence occasionally suggests missing connective tissue.',
      'Even so, 4:13 Dream deserves better than its status as the record before the long silence. It captures a functioning band enjoying the physical sound of playing together. The production can turn bright guitars brittle at high volume, and the emotional arc never fully settles, but there is pleasure in its movement. It is a good Cure album rather than a central one–open-hearted, imperfect and more rewarding than the shorthand around it implies.'
    ],
  },
  {
    album: 19,
    slug: 'songs-of-a-lost-world',
    title: 'Songs of a Lost World: An ending that opens outward',
    score: 9.5,
    standfirst: 'After sixteen years, The Cure returned with an album of grief and mortality that feels monumental because it never mistakes scale for spectacle.',
    verdict: 'A profound late-career achievement: focused, beautifully played and emotionally unsparing without surrendering hope or wonder.',
    standout_tracks: ['Alone', 'And Nothing Is Forever', 'I Can Never Say Goodbye', 'Endsong'],
    featured: true,
    paragraphs: [
      '“This is the end of every song that we sing.” After a sixteen-year gap, Robert Smith begins Songs of a Lost World by looking directly at finitude. The line could sound theatrical; instead, arriving through the slow planetary build of “Alone”, it feels calm, lucid and earned. The Cure have written about loss for decades, but age changes the tense. Mortality here is not an imagined horizon. It is present in the room.',
      'The album’s eight-song focus is crucial. “And Nothing Is Forever” makes a promise while acknowledging that time will defeat it. “A Fragile Thing” gives emotional conflict a compact melodic frame; “Warsong” and “Drone:Nodrone” bring abrasion and momentum, preventing the record from becoming a single stately mood. The most personal moment, “I Can Never Say Goodbye”, approaches family grief with devastating restraint. Smith’s voice carries visible years yet remains unmistakable, while the band surrounds it with patience and immense dynamic control.',
      'Everything leads to “Endsong”, where instrumental space occupies nearly half the track before the vocal arrives. The scale recalls Disintegration, but the perspective is different: less consumed by the fear of things falling apart than by the knowledge that they already have, and that life continues inside the absence. Songs of a Lost World does not trade on nostalgia or attempt to summarise the catalogue. It earns its place beside The Cure’s best work by speaking from the present, in a language the band built and can still make feel newly necessary.'
    ],
  },
];

function htmlBody(paragraphs) {
  const [opening, ...rest] = paragraphs;
  return [
    `<p class="lead-paragraph">${opening}</p>`,
    rest.length ? '<h2>Inside the record</h2>' : '',
    ...rest.map((paragraph) => `<p>${paragraph}</p>`),
  ].join('');
}

function readingTime(review) {
  const words = `${review.standfirst} ${review.paragraphs.join(' ')} ${review.verdict}`
    .trim().split(/\s+/).length;
  return Math.max(2, Math.ceil(words / 220));
}

async function publishReviews() {
  const albums = await api('/items/discography?limit=-1&filter[type][_eq]=studio&fields=id,title,slug');
  const albumIds = new Set(albums.map((album) => album.id));
  const missingAlbums = drafts.filter((review) => !albumIds.has(review.album));
  if (missingAlbums.length) throw new Error(`Missing studio albums: ${missingAlbums.map((review) => review.album).join(', ')}`);

  const existing = await api('/items/reviews?limit=-1&fields=id,album,slug');
  const existingByAlbum = new Map(existing.map((review) => [Number(review.album), review]));
  const existingBySlug = new Map(existing.map((review) => [review.slug, review]));

  for (const [index, review] of drafts.entries()) {
    const payload = {
      status: 'published',
      sort: index + 1,
      album: review.album,
      title: review.title,
      slug: review.slug,
      standfirst: review.standfirst,
      body: htmlBody(review.paragraphs),
      score: review.score,
      verdict: review.verdict,
      standout_tracks: review.standout_tracks,
      author_name: AUTHOR_NAME,
      published_date: PUBLISHED_DATE,
      reading_time: readingTime(review),
      featured: Boolean(review.featured),
      seo_title: `${review.title} · Cureation`,
      seo_description: review.standfirst,
      editorial_notes: 'First editorial draft published at the site owner’s direction. Revisit for house-style and factual review during the next editorial pass.',
    };

    const current = existingByAlbum.get(review.album) || existingBySlug.get(review.slug);
    if (current) {
      await api(`/items/reviews/${current.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    } else {
      await api('/items/reviews', { method: 'POST', body: JSON.stringify(payload) });
    }
  }
}

await ensureCollection();
await ensureFields();
await ensureRelations();
await configureCollection();
await ensurePublicPermission();
await publishReviews();

const verification = await api('/items/reviews?limit=-1&sort=sort&fields=id,status,album,title,slug,author_name,published_date,score');
console.log(JSON.stringify({ collection: 'reviews', count: verification.length, reviews: verification }, null, 2));
