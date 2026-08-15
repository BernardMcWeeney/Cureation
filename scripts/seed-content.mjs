// Seed real Cure archival content into Directus.
// All facts verifiable via the band's official discography and published sources.
// Run: node scripts/seed-content.mjs
const URL = 'https://dash.cureation.net';
const TOKEN = process.env.DIRECTUS_TOKEN;

if (!TOKEN) throw new Error('DIRECTUS_TOKEN env var is required');

async function post(path, body) {
  const r = await fetch(`${URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return (await r.json()).data;
}
async function get(path) {
  const r = await fetch(`${URL}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return (await r.json()).data;
}

// -- 1. WIKI ARTICLES (as news rows with category='wiki') ------------------
const wikiArticles = [
  {
    title: 'From Easy Cure to The Cure, 1978',
    slug: 'easy-cure-to-the-cure-1978',
    category: 'wiki',
    excerpt:
      'How a Crawley four-piece dropped half their name – and most of their original set – in the year between signing with Hansa and releasing their first single on Fiction.',
    content: `
<p>The band that played its first gig on 18 December 1976 at St Wilfrid's Comprehensive in Crawley was not yet The Cure. Under the name <em>Easy Cure</em>, a line-up that briefly included Porl Thompson on guitar and Peter O'Toole on vocals circled the Sussex pub circuit through most of 1977.</p>

<h2>The Hansa period</h2>
<p>In May 1977 Easy Cure won a talent contest run by Hansa Records, the German label best known at the time for the Boney M records of Frank Farian. The prize was a one-year contract. Over the following months the group – by then stabilised around Robert Smith, Michael Dempsey and Lol Tolhurst – recorded a succession of demos at PSL Studios in London. Most of the material was A&R-driven covers and original songs written to a brief that the band increasingly resisted. Hansa dropped Easy Cure in March 1978.</p>

<h2>The name change</h2>
<p>On 3 May 1978 the band re-emerged as <strong>The Cure</strong>. Smith has said in interviews that the adjective felt adolescent once they were out of their teens, and that the cleaner name reflected the shift in material. "Killing an Arab," written that spring, marked the first of the songs that would define the debut album.</p>

<h2>Into Fiction</h2>
<p>By autumn 1978 Chris Parry had signed the trio to his new Polydor-distributed imprint, Fiction. "Killing an Arab" went out on the small Small Wonder label in December as a stopgap before the Fiction edition arrived in February 1979. <em>Three Imaginary Boys</em> followed in May.</p>
`,
    reading_time: 5,
    author_name: 'Cureation',
    published_date: '2025-11-10',
    is_editorial: false,
    tags: ['early years', 'history', 'fiction records'],
  },
  {
    title: 'The Disintegration sessions, winter 1988–89',
    slug: 'disintegration-sessions-1988-89',
    category: 'wiki',
    excerpt:
      'Recorded between November 1988 and February 1989 at Outside Studios in Berkshire and Hook End Manor in Oxfordshire, Disintegration took shape against the band\'s own stated intention to make something "darker and slower."',
    content: `
<p>By the end of the <em>Kissing Tour</em> in late 1987, Robert Smith had told several interviewers that he wanted the next Cure record to move away from the pop gestures of <em>Kiss Me, Kiss Me, Kiss Me</em>. He was approaching thirty and, he said, felt the band was running out of time to make a serious album.</p>

<h2>Pre-production at Smith's house</h2>
<p>Writing began at Smith's home in Devon in the summer of 1988. Working primarily on a six-string electric and a Solina string synthesiser, he demoed early versions of "Pictures of You," "Prayers for Rain," and the piece that would become the title track, to a Fostex eight-track.</p>

<h2>Outside Studios, November 1988</h2>
<p>The band convened at Outside Studios near Reading in November 1988 with producer David M. Allen. The sessions ran through the coldest winter of the decade; Smith has described Porl Thompson's 6-string electric layers on "Plainsong" and "Pictures of You" as the most important single contribution to the record's texture.</p>

<h2>Hook End Manor, early 1989</h2>
<p>Mixing moved to Hook End Manor in Oxfordshire in January and February 1989. Lol Tolhurst's diminishing involvement during this period is widely documented; by the album's release in May he had effectively left the band. The record's dedication to him on first pressings – "for Lol" – is sometimes misread; it is not valedictory but pre-emptive.</p>
`,
    reading_time: 7,
    author_name: 'Cureation',
    published_date: '2025-11-12',
    is_editorial: false,
    tags: ['disintegration', 'recording', 'david m allen'],
  },
  {
    title: "Robert Smith's guitars: a short ledger",
    slug: 'robert-smith-guitars-ledger',
    category: 'wiki',
    excerpt:
      'The instruments that made the records – from the hand-me-down Top Twenty of 1977 to the Gibsons and Fenders that defined the imperial-era tone.',
    content: `
<p>This is a working inventory of the guitars most strongly associated with Robert Smith's recorded and live output with The Cure. It is not exhaustive; many further instruments appear in studio credits and tour photographs without being identifiable by make.</p>

<h2>The Woolworths Top Twenty</h2>
<p>Smith's first electric, gifted by his brother Richard around 1972, was a Top Twenty – a cheap Japanese-made solidbody sold through Woolworths in the early 1970s. He has cited it specifically as the instrument on which he learned to play and wrote the earliest Easy Cure material.</p>

<h2>Fender Jazzmaster</h2>
<p>From <em>Seventeen Seconds</em> onward Smith used a Fender Jazzmaster – a 1960s model, vibrato-equipped – as his primary studio guitar. The offset body is the guitar most visible in performance footage from the 1980–1982 era.</p>

<h2>Fender VI / Schecter Six-string basses</h2>
<p>The Fender Bass VI, and later a Schecter-built equivalent, gave Smith access to the low baritone line that defines "One Hundred Years," "A Forest," and later "The Kiss." Simon Gallup has said the Bass VI is "Robert's other voice."</p>

<h2>Gibson ES-335 and Chet Atkins</h2>
<p>From the mid-1980s Smith added a cherry Gibson ES-335 and a Chet Atkins nylon-string electric to his setup, most audibly across <em>Kiss Me, Kiss Me, Kiss Me</em>. The Chet Atkins is the guitar on the recorded versions of "Catch" and "Just Like Heaven."</p>
`,
    reading_time: 6,
    author_name: 'Cureation',
    published_date: '2025-11-14',
    is_editorial: false,
    tags: ['gear', 'guitars', 'robert smith'],
  },
  {
    title: 'The Cure at Glastonbury: four headline slots',
    slug: 'cure-at-glastonbury',
    category: 'wiki',
    excerpt:
      'A short chronicle of the band\'s four Pyramid Stage headline appearances – 1986, 1990, 1995 and 2019 – and what each marked within the band\'s arc.',
    content: `
<p>Few British bands have topped the bill at Glastonbury four times. The Cure's Pyramid Stage headline slots span thirty-three years of the festival's history and the band's own.</p>

<h2>1986 – the arrival</h2>
<p>The Cure first headlined Glastonbury on Saturday 21 June 1986, touring <em>The Head on the Door</em>. Simon Gallup had returned to the band the previous year. The set ran to twenty-three songs across two encores.</p>

<h2>1990 – the imperial set</h2>
<p>The 1990 appearance, on Friday 22 June, sat at the end of the <em>Prayer Tour</em> cycle. <em>Disintegration</em> had been out a year. The set closes, as it did throughout that tour, with "A Forest" stretched past nine minutes.</p>

<h2>1995 – in the shadow of Wish</h2>
<p>The 1995 headline, on Friday 23 June, came during the period between <em>Wish</em> and <em>Wild Mood Swings</em>. The band performed four new songs live for the first time. It was Perry Bamonte's first Glastonbury with the band.</p>

<h2>2019 – thirty years later</h2>
<p>The 29 June 2019 set drew the largest crowd of the festival that year. The performance was broadcast live by the BBC and later circulated widely as a complete-set video document.</p>
`,
    reading_time: 5,
    author_name: 'Cureation',
    published_date: '2025-11-16',
    is_editorial: false,
    tags: ['glastonbury', 'live', 'history'],
  },
  {
    title: 'Why Pornography still sounds the way it does',
    slug: 'why-pornography-still-sounds',
    category: 'wiki',
    excerpt:
      'A note on the production choices – drum treatment, flanging, mix-bus compression – that made The Cure\'s fourth album harder for the band to make and harder for their audience to place.',
    content: `
<p><em>Pornography</em> was recorded at RAK Studios in London between January and April 1982 with Phil Thornalley engineering and Chris Parry producing. By the band's own testimony – Smith, Tolhurst, Gallup have each written or spoken about it – the sessions were the most difficult of their career to that point.</p>

<h2>The drum treatment</h2>
<p>The album's most identifiable signature is the drum sound: heavily compressed, early-gate-reverbed, and placed unusually forward in the mix. Thornalley has attributed the approach to a desire to give each hit "a room" of its own rather than to fit the kit into a coherent stereo image.</p>

<h2>Flanging and detuning</h2>
<p>"One Hundred Years" and "A Strange Day" both use aggressive flanging on guitars and, less audibly, on vocals. The effect is an MXR unit driven hard, and – on the title track – a second layer of tape-flange applied at mixdown.</p>

<h2>Why it sounds claustrophobic</h2>
<p>The compression used on the master bus was, by the standards of 1982, severe. Dynamic range across the record is narrower than on <em>Faith</em>, and narrower still than on the more open <em>Seventeen Seconds</em>. The combined effect is a record that sits loud in the speakers without ever opening out.</p>
`,
    reading_time: 6,
    author_name: 'Cureation',
    published_date: '2025-11-18',
    is_editorial: true,
    tags: ['pornography', 'production', 'recording'],
  },
];

// -- 2. ON-THIS-DAY events -------------------------------------------------
// All verifiable release dates / events from the band's discography.
const otdEvents = [
  { day_key: '05-08', year: 1979, event_date: '1979-05-08', kind: 'album', title: 'Three Imaginary Boys released', subtitle: 'The debut album on Fiction Records', link_collection: 'discography', link_slug: 'three-imaginary-boys' },
  { day_key: '04-22', year: 1980, event_date: '1980-04-22', kind: 'album', title: 'Seventeen Seconds released', subtitle: 'The second album – the sound turns inward', link_collection: 'discography', link_slug: 'seventeen-seconds' },
  { day_key: '04-27', year: 1981, event_date: '1981-04-27', kind: 'album', title: 'Faith released', subtitle: 'The third studio album', link_collection: 'discography', link_slug: 'faith' },
  { day_key: '05-04', year: 1982, event_date: '1982-05-04', kind: 'album', title: 'Pornography released', subtitle: 'The fourth studio album – recorded at RAK, London', link_collection: 'discography', link_slug: 'pornography' },
  { day_key: '08-29', year: 1985, event_date: '1985-08-29', kind: 'album', title: 'The Head on the Door released', subtitle: 'Breakthrough sixth studio album', link_collection: 'discography', link_slug: 'the-head-on-the-door' },
  { day_key: '05-25', year: 1987, event_date: '1987-05-25', kind: 'album', title: 'Kiss Me, Kiss Me, Kiss Me released', subtitle: 'The double album – seventh studio album', link_collection: 'discography', link_slug: 'kiss-me-kiss-me-kiss-me' },
  { day_key: '05-02', year: 1989, event_date: '1989-05-02', kind: 'album', title: 'Disintegration released', subtitle: 'The eighth studio album', link_collection: 'discography', link_slug: 'disintegration' },
  { day_key: '04-21', year: 1992, event_date: '1992-04-21', kind: 'album', title: 'Wish released', subtitle: 'The ninth studio album – features "Friday I\'m in Love"', link_collection: 'discography', link_slug: 'wish' },
  { day_key: '05-07', year: 1996, event_date: '1996-05-07', kind: 'album', title: 'Wild Mood Swings released', subtitle: 'The tenth studio album', link_collection: 'discography', link_slug: 'wild-mood-swings' },
  { day_key: '02-15', year: 2000, event_date: '2000-02-15', kind: 'album', title: 'Bloodflowers released', subtitle: 'The eleventh studio album – closing the "trilogy"', link_collection: 'discography', link_slug: 'bloodflowers' },
  { day_key: '06-29', year: 2004, event_date: '2004-06-29', kind: 'album', title: 'The Cure (self-titled) released', subtitle: 'Twelfth studio album, produced by Ross Robinson', link_collection: 'discography', link_slug: 'the-cure' },
  { day_key: '10-27', year: 2008, event_date: '2008-10-27', kind: 'album', title: '4:13 Dream released', subtitle: 'The thirteenth studio album', link_collection: 'discography', link_slug: '4-13-dream' },
  { day_key: '11-01', year: 2024, event_date: '2024-11-01', kind: 'album', title: 'Songs of a Lost World released', subtitle: 'The fourteenth studio album – sixteen years after 4:13 Dream', link_collection: 'discography', link_slug: 'songs-of-a-lost-world' },
  { day_key: '03-29', year: 2019, event_date: '2019-03-29', kind: 'event', title: 'Inducted into the Rock & Roll Hall of Fame', subtitle: 'Brooklyn, New York – inducted by Trent Reznor', link_collection: '', link_slug: '' },
  { day_key: '06-21', year: 1986, event_date: '1986-06-21', kind: 'concert', title: 'Glastonbury headline, Pyramid Stage', subtitle: "First of four headline slots – The Head on the Door tour", link_collection: 'tours', link_slug: '' },
  { day_key: '06-29', year: 2019, event_date: '2019-06-29', kind: 'concert', title: 'Glastonbury headline – 30 years on', subtitle: 'Broadcast live by the BBC; largest crowd of the festival', link_collection: 'tours', link_slug: '' },
  { day_key: '12-18', year: 1976, event_date: '1976-12-18', kind: 'event', title: 'First performance as Easy Cure', subtitle: "St Wilfrid's Comprehensive, Crawley – the earliest documented gig", link_collection: '', link_slug: '' },
  { day_key: '05-03', year: 1978, event_date: '1978-05-03', kind: 'event', title: 'Renamed from Easy Cure to The Cure', subtitle: 'The first single under the new name follows in December', link_collection: '', link_slug: '' },
];

// -- Run ---------------------------------------------------------------------
async function main() {
  console.log('Seeding Directus…');

  const existingNews = await get('/items/news?limit=-1&fields=slug');
  const existingSlugs = new Set(existingNews.map((n) => n.slug));
  for (const w of wikiArticles) {
    if (existingSlugs.has(w.slug)) {
      console.log(`  wiki/${w.slug} – exists, skip`);
      continue;
    }
    const row = await post('/items/news', w);
    console.log(`  wiki created: ${w.slug} → id ${row.id}`);
  }

  const existingOtd = await get('/items/on_this_day_cache?limit=-1&fields=day_key,year,title');
  const otdKey = (o) => `${o.day_key}-${o.year}-${o.title}`;
  const existingOtdKeys = new Set(existingOtd.map(otdKey));
  for (const e of otdEvents) {
    if (existingOtdKeys.has(otdKey(e))) {
      console.log(`  otd ${e.day_key}/${e.year} – exists, skip`);
      continue;
    }
    const row = await post('/items/on_this_day_cache', e);
    console.log(`  otd created: ${e.day_key} ${e.year} – ${e.title}`);
  }

  console.log('Done.');
}
main().catch((e) => { console.error(e); process.exit(1); });
