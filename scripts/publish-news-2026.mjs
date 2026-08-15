/**
 * Publish Cureation's researched 2026 news desk to Directus.
 *
 * The migration is idempotent: rerunning it updates articles by slug rather
 * than creating duplicates. Images remain at their editorial source and are
 * paired with visible credits in Directus.
 *
 * Usage:
 *   DIRECTUS_TOKEN=... node scripts/publish-news-2026.mjs
 */

import https from 'node:https';

const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'https://dash.cureation.net').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
const AUTHOR_NAME = 'Bernard McWeeney';
let readSequence = 0;

if (!DIRECTUS_TOKEN) throw new Error('DIRECTUS_TOKEN is required');

async function api(path, init = {}) {
  const url = new URL(path, DIRECTUS_URL);
  const response = await new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: init.method || 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        'Cache-Control': 'no-cache, no-store',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    }, (incoming) => {
      let responseBody = '';
      incoming.setEncoding('utf8');
      incoming.on('data', (chunk) => { responseBody += chunk; });
      incoming.on('end', () => resolve({
        ok: incoming.statusCode >= 200 && incoming.statusCode < 300,
        status: incoming.statusCode,
        statusText: incoming.statusMessage,
        text: responseBody,
      }));
    });
    request.on('error', reject);
    if (init.body) request.write(init.body);
    request.end();
  });

  const json = response.text ? JSON.parse(response.text) : null;
  if (!response.ok) {
    const detail = json?.errors?.map((error) => error.message).join('; ') || response.text || response.statusText;
    const error = new Error(`${init.method || 'GET'} ${path} failed (${response.status}): ${detail}`);
    error.status = response.status;
    throw error;
  }
  return json?.data ?? null;
}

function freshNewsPath() {
  // The Directus dashboard is edge-cached. A changing, valid numeric filter
  // prevents a newly created item being hidden behind an older cached list.
  const idCeiling = 2_000_000_000 - (Date.now() % 1_000_000) - (++readSequence);
  const params = new URLSearchParams({
    limit: '-1',
    fields: 'id,slug',
    'filter[id][_lt]': String(idCeiling),
  });
  return `/items/news?${params}`;
}

const external = (url, label) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const sourceNote = (...links) => `<hr><p><strong>Sources and further reading:</strong> ${links.join(' · ')}</p>`;

const stories = [
  {
    title: 'The 1986 mix of “Boys Don’t Cry” finally reaches digital',
    slug: 'boys-dont-cry-86-mix-digital-2026',
    excerpt: 'Forty years after Robert Smith re-sang the vocal, the elusive “New Voice – New Mix” gets a fresh remaster and its first official digital release.',
    published_date: '2026-01-22',
    reading_time: 3,
    tags: ['The Cure', 'Boys Don’t Cry', 'Reissue', 'Robert Smith'],
    featured_image: 'https://www.thecure.com/wp-content/uploads/sites/10452/2026/01/TheCure_Social_1080x1080_BoysDontCry_012126-1.jpg',
    image_credit: 'Official “Boys Don’t Cry (86 Mix)” artwork via thecure.com',
    source_url: 'https://www.thecure.com/news/2026/01/boys-dont-cry-86-mix/',
    content: `
      <p>The Cure opened their 2026 release calendar by rescuing a familiar recording with an unexpectedly complicated history. “Boys Don’t Cry (86 Mix)” arrived on streaming services on 22 January, newly remastered and officially available in digital form for the first time.</p>
      <p>Robert Smith returned to the song in 1986, re-singing its lead vocal and remixing the recording as part of the campaign around <em>Standing on a Beach</em>. The version appeared on seven- and twelve-inch vinyl and accompanied the new promotional video, yet it was not placed on the compilation itself. It also stayed off later greatest-hits sets, leaving the alternate vocal oddly stranded outside the band’s main digital catalogue.</p>
      <h2>A small release with real archival value</h2>
      <p>The differences are not a wholesale rewrite. The arrangement remains the bright, economical rush listeners know, while the later vocal brings a little more weight and assurance to the melody. That subtlety is precisely why the release matters: it restores a missing branch of one of the band’s most recognisable songs without pretending it is a newly discovered masterpiece.</p>
      <p>The 2026 remaster is available to stream, on CD and on vinyl. For collectors it closes a long-standing gap; for everyone else it offers an unusually clear comparison between Smith as a young singer and the more confident voice he had developed by the middle of the following decade.</p>
      ${sourceNote(external('https://www.thecure.com/news/2026/01/boys-dont-cry-86-mix/', 'The Cure: official announcement'))}
    `,
  },
  {
    title: 'At last: The Cure win their first two Grammys',
    slug: 'the-cure-first-grammy-wins-2026',
    excerpt: 'Songs of a Lost World and “Alone” give the band two victories at the 68th Grammy Awards—their first wins after more than three decades of nominations.',
    published_date: '2026-02-02',
    reading_time: 3,
    tags: ['The Cure', 'Grammy Awards', 'Songs of a Lost World', 'Alone'],
    featured_image: 'https://www.thecure.com/wp-content/uploads/sites/10452/2026/02/best-albuim.jpg',
    image_credit: 'Official Grammy thank-you artwork via thecure.com',
    source_url: 'https://www.grammy.com/artists/cure/10575/',
    content: `
      <p>The Cure left the 68th Grammy Awards with two victories and a new line in their history. <em>Songs of a Lost World</em> won Best Alternative Music Album, while “Alone” took Best Alternative Music Performance.</p>
      <p>They were the band’s first Grammy wins. Earlier nominations had come for <em>Wish</em> in 1993 and <em>Bloodflowers</em> in 2001, but neither converted. The 2026 result therefore recognised both the strength of the 2024 comeback and a catalogue that had spent decades shaping alternative music without collecting this particular prize.</p>
      <p>The band were not at the ceremony. They were together at the private funeral of Perry Bamonte, their friend and bandmate, who died in December 2025 after a short illness. That made the timing inseparable from loss: a first-ever Grammy night arriving on a day reserved for saying goodbye.</p>
      <h2>A shared acknowledgement</h2>
      <p>In the band’s official message the following day, Robert Smith thanked Simon Gallup, Jason Cooper, Roger O’Donnell and Reeves Gabrels, as well as co-producer Paul Corkett, the album team, the touring crew and Cure listeners around the world. It was a characteristically collective response to awards attached to an intensely personal record.</p>
      <p>The pairing of album and performance prizes feels apt. “Alone” was the song that introduced the record’s scale and atmosphere; <em>Songs of a Lost World</em> then sustained that emotional world across a complete album. More than a lifetime-achievement gesture, the Grammys rewarded the work that placed The Cure back at the centre of the present tense.</p>
      ${sourceNote(
        external('https://www.grammy.com/artists/cure/10575/', 'Grammy.com: The Cure awards record'),
        external('https://www.thecure.com/news/2026/02/thank-you/', 'The Cure: official thank-you'),
        external('https://pitchfork.com/news/the-cure-wins-best-alternative-music-performance-for-alone-at-2026-grammys/', 'Pitchfork: ceremony report'),
      )}
    `,
  },
  {
    title: 'The Cure and Chuck Sperry turn a poster into aid for MSF',
    slug: 'cure-chuck-sperry-msf-print-2026',
    excerpt: 'A signed, numbered screenprint brings Chuck Sperry’s luminous concert-art language to The Cure, with the store’s net profits directed to Médecins Sans Frontières.',
    published_date: '2026-02-25',
    reading_time: 2,
    tags: ['The Cure', 'Chuck Sperry', 'Art', 'Médecins Sans Frontières'],
    featured_image: 'https://www.thecure.com/wp-content/uploads/sites/10452/2026/02/The-cure-chuck-sperry.jpg',
    image_credit: 'Artwork: Chuck Sperry / The Cure',
    source_url: 'https://www.thecure.com/news/2026/02/the-cure-x-chuck-sperry/',
    content: `
      <p>The Cure’s February collaboration with American graphic artist Chuck Sperry joined collectable printmaking to a direct charitable purpose. The centrepiece was a gallery-quality screenprint, signed and numbered by Sperry, with related merchandise built around the same design.</p>
      <p>Sperry’s work is rooted in the visual culture of concert posters: elaborate pattern, saturated colour and figures that seem to sit somewhere between classical iconography and psychedelia. That vocabulary is a natural fit for a band whose sleeve and poster designs have always been part of the atmosphere around the music.</p>
      <h2>The important line in the small print</h2>
      <p>The Cure confirmed that all net profits from poster sales through their store would go to Médecins Sans Frontières, also known as Doctors Without Borders. It turned the limited edition into more than another piece of tour merchandise and continued Robert Smith’s long habit of attaching special releases and ticketing decisions to practical causes.</p>
      <p>The print measures approximately 27 by 21.5 inches. As with most signed and numbered Sperry editions, scarcity is part of the object’s appeal—but the donation gives that scarcity a useful destination rather than making collectability the whole story.</p>
      ${sourceNote(
        external('https://www.thecure.com/news/2026/02/the-cure-x-chuck-sperry/', 'The Cure: collaboration announcement'),
        external('https://chucksperry.net/tag/the-cure/', 'Chuck Sperry: The Cure archive'),
      )}
    `,
  },
  {
    title: 'Robert Smith’s “Cureator” week fills the Royal Albert Hall',
    slug: 'robert-smith-teenage-cancer-trust-2026',
    excerpt: 'Seven nights chosen by Robert Smith bring Elbow, Mogwai, Manic Street Preachers, My Bloody Valentine, Garbage, Placebo and Wolf Alice together for Teenage Cancer Trust.',
    published_date: '2026-03-30',
    reading_time: 4,
    tags: ['Robert Smith', 'Teenage Cancer Trust', 'Royal Albert Hall', 'Benefit'],
    featured_image: 'https://www.teenagecancertrust.org/sites/default/files/2025-03/Robert%20Smith%20of%20The%20Cure%20CREDIT%20PHOEBE%20FOX%202024.jpg',
    image_credit: 'Robert Smith. Photo: Phoebe Fox, via Teenage Cancer Trust',
    source_url: 'https://www.teenagecancertrust.org/events/music-and-entertainment/teenage-cancer-trust-concert-royal-albert-hall',
    content: `
      <p>Robert Smith’s first full week as guest curator of the Teenage Cancer Trust concerts ended on 29 March after seven nights at London’s Royal Albert Hall. He inherited a formidable tradition from the series’ founding curator Roger Daltrey and answered it with a programme that felt unmistakably his own.</p>
      <p>Elbow opened the week, followed by a comedy bill selected by Smith. Mogwai, Manic Street Preachers and My Bloody Valentine took the middle nights; Garbage and Placebo shared Saturday, before Wolf Alice closed the run with Nilüfer Yanya. The choices connected different generations without sanding away their edges.</p>
      <h2>A milestone inside the week</h2>
      <p>The Manic Street Preachers date on 26 March became the charity’s 150th Royal Albert Hall show. By that point, the concert series had raised more than £36 million for specialist care and support for young people with cancer. The number gave Smith’s “Cureator” role a weight beyond taste-making, even if the calibre of the bill was what first caught attention.</p>
      <p>Saturday supplied the most direct salute to the curator. Garbage covered The Cure’s “Lovesong” during an emotionally charged set, while Placebo delivered a rare stripped-back performance. Smith did not need to put his own band on the bill for The Cure’s presence to be felt; it ran through the friendships, influences and loyalties holding the week together.</p>
      <p>The result was neither a disguised Cure festival nor a safe charity gala. It was a coherent week of music and comedy assembled for a cause, with artists trusted to be fully themselves.</p>
      ${sourceNote(
        external('https://www.teenagecancertrust.org/events/music-and-entertainment/teenage-cancer-trust-concert-royal-albert-hall', 'Teenage Cancer Trust: 2026 line-up'),
        external('https://www.teenagecancertrust.org/about-us/news/teenage-cancer-trust-celebrates-150-shows-royal-albert-hall', 'Teenage Cancer Trust: 150-show milestone'),
        external('https://www.nme.com/news/music/garbage-cover-the-cure-placebo-return-teenage-cancer-trust-royal-albert-hall-lonon-report-photos-video-setlsts-3937313', 'NME: Garbage and Placebo report'),
      )}
    `,
  },
  {
    title: 'Paléo and Baltic debuts widen The Cure’s 2026 summer map',
    slug: 'cure-adds-baltic-paleo-shows-2026',
    excerpt: 'A Swiss festival return and first-ever concerts in Lithuania and Estonia add three significant stops to The Cure’s expanding European summer.',
    published_date: '2026-03-23',
    reading_time: 3,
    tags: ['The Cure', 'Tour', 'Lithuania', 'Estonia', 'Paléo Festival'],
    featured_image: 'https://www.thecure.com/wp-content/uploads/sites/10452/2026/03/the-cure-baltic.jpg',
    image_credit: 'Official Baltic shows artwork via thecure.com',
    source_url: 'https://www.thecure.com/news/2026/03/3765/',
    content: `
      <p>The Cure’s 2026 Festival Summer grew in two directions during March: back to a major Swiss festival and into two countries the band had never played before.</p>
      <p>On 17 March, the group announced a return to Paléo Festival in Nyon. Six days later came the more historic addition—a pair of Baltic debuts at Kalnų Parkas in Vilnius on 7 August and Unibet Arena in Tallinn on 9 August.</p>
      <h2>New ground in a long touring history</h2>
      <p>For a band that has spent close to five decades crossing Europe, a genuine first visit carries unusual weight. Lithuania and Estonia had long sat outside The Cure’s concert map even as audiences in both countries grew around recordings, broadcasts and neighbouring tour dates. The two shows finally put that imbalance right.</p>
      <p>The announcements also clarified the scale of the 2026 campaign. This was not a conventional arena run tied to a newly announced record; it was a deliberately varied summer of festivals, open-air settings and selected stand-alone dates. That structure gave the band room to change set lists from night to night and to reach places that do not always fall on the standard tour route.</p>
      <p>By late March, the itinerary already stretched from Primavera Sound in Barcelona through Porto, Berlin, Nîmes, the Baltic states, Scandinavia, Britain and France. The exact shape would continue to evolve, but the central idea was clear: The Cure were returning to the stage at full scale.</p>
      ${sourceNote(
        external('https://www.thecure.com/news/2026/03/3765/', 'The Cure: Lithuania and Estonia announcement'),
        external('https://www.thecure.com/news/2026/03/the-cure-to-headline-paleo-festival-2026/', 'The Cure: Paléo Festival announcement'),
      )}
    `,
  },
  {
    title: 'The Cure return at Primavera with Eden Gallup and a deep-cut set',
    slug: 'cure-primavera-return-eden-gallup-2026',
    excerpt: 'Barcelona gets the first Cure show in eighteen months, an expanded live line-up and a two-and-a-half-hour set that reaches well beyond the usual festival script.',
    published_date: '2026-06-06',
    reading_time: 4,
    tags: ['The Cure', 'Primavera Sound', 'Eden Gallup', 'Live'],
    featured_image: 'https://www.thecure.com/wp-content/uploads/sites/10452/2026/06/EN_060526_PS26_AM_TheCure_Post_Fri.jpg',
    image_credit: 'Official Primavera Sound livestream artwork via thecure.com',
    source_url: 'https://www.thecure.com/news/2026/06/primavera-live-stream/',
    content: `
      <p>The Cure began their 2026 Festival Summer at Barcelona’s Primavera Sound on 5 June, ending an eighteen-month absence from the stage. It was their first concert since Perry Bamonte’s death and opened a new chapter in the live line-up, with Eden Gallup joining Robert Smith, Simon Gallup, Jason Cooper, Roger O’Donnell and Reeves Gabrels.</p>
      <p>For a headline festival set, the song choices were unusually generous to listeners who keep track of the catalogue’s quieter corners. “2 Late” returned for the first time since 2019, “alt.end” since 2018 and “Mint Car” since 2016. “Wrong Number” also came back after a seven-year gap, while “Alone” and “Endsong” carried <em>Songs of a Lost World</em> into the new touring cycle.</p>
      <h2>A festival set without a reduced horizon</h2>
      <p>The performance ran for roughly two and a half hours. Its middle moved between atmospheric album pieces and bright singles before a long encore brought the crowd-facing side of the band into focus. It was broad rather than cautious: a set designed for a festival audience that still allowed old B-sides and neglected album tracks into the frame.</p>
      <p>Amazon Music streamed the show, making the first night of the tour immediately available beyond Parc del Fòrum. The official site also launched a summer merchandise programme in which each date received its own limited artwork, beginning with Barcelona and continuing at Porto’s North Festival.</p>
      <p>Most importantly, the performance answered the practical question hanging over a long break and a changed line-up. The Cure did not return tentatively. They sounded like a band prepared to let the summer keep altering the set around them.</p>
      ${sourceNote(
        external('https://www.thecure.com/news/2026/06/primavera-live-stream/', 'The Cure: official livestream notice'),
        external('https://www.setlist.fm/setlist/the-cure/2026/parc-del-forum-estrella-damm-barcelona-spain-b4ee5fa.html', 'Setlist.fm: Barcelona set list'),
        external('https://stereogum.com/2501608/the-cure-break-out-live-rarities-at-primavera-sound-2026/news', 'Stereogum: live report'),
      )}
    `,
  },
  {
    title: 'Robert Smith and Olivia Rodrigo ask “What’s Wrong With Me”',
    slug: 'robert-smith-olivia-rodrigo-whats-wrong-with-me',
    excerpt: 'A surprise Primavera performance introduces Olivia Rodrigo’s first credited feature: a full duet with Robert Smith that bridges two generations of emotionally direct pop.',
    published_date: '2026-06-12',
    reading_time: 4,
    tags: ['Robert Smith', 'Olivia Rodrigo', 'What’s Wrong With Me', 'Collaboration'],
    featured_image: 'https://media.cdn.setlistfm.com/news/2026-06/1780931606810/oliviarodrigo_Xavi%20Torrent%3AGettyImages-2280260777.jpg',
    image_credit: 'Olivia Rodrigo and Robert Smith at Primavera Sound, 6 June 2026. Photo: Xavi Torrent/Getty Images via Setlist.fm',
    source_url: 'https://www.universalmusic.ca/2026/06/12/olivia-rodrigo-releases-third-studio-album-you-seem-pretty-sad-for-a-girl-so-in-love/',
    content: `
      <p>One night after The Cure headlined Primavera Sound, Robert Smith returned to the Barcelona stage for a less predictable appearance. Olivia Rodrigo used her surprise set on 6 June to unveil “What’s Wrong With Me”, bringing Smith out with an acoustic guitar to perform the new song beside her.</p>
      <p>The studio version followed on 12 June as part of Rodrigo’s third album, <em>you seem pretty sad for a girl so in love</em>. It is her first song to carry a featured-artist credit, and Smith is not confined to a decorative cameo: the track is structured as a true duet, with the contrast between the two voices doing much of the emotional work.</p>
      <h2>An influence becomes a collaborator</h2>
      <p>Rodrigo has spoken often about The Cure’s importance to her, and she previously shared a stage with Smith at Glastonbury in 2025. “What’s Wrong With Me” moves that relationship into original material. Its scale is intimate, its melancholy conversational rather than monumental, and Smith’s voice sounds recognisable without forcing the song to imitate a Cure record.</p>
      <p>The collaboration also makes sense from Smith’s side. The Cure’s catalogue has always moved between darkness and immaculate pop construction, while Rodrigo’s writing is at its sharpest when private uncertainty is turned into a melody a huge crowd can carry. The generations are different; the instinct is not.</p>
      <p>The song entered the UK chart dated 25 June. More telling than the number was the speed with which the live debut became one of Primavera’s defining moments: a new song, revealed without advance billing, between an artist at pop’s centre and one whose influence is still expanding.</p>
      ${sourceNote(
        external('https://www.universalmusic.ca/2026/06/12/olivia-rodrigo-releases-third-studio-album-you-seem-pretty-sad-for-a-girl-so-in-love/', 'Universal Music: album announcement'),
        external('https://www.setlist.fm/news/06-26/olivia-rodrigo-live-debuts-duet-with-robert-smith-6bd6a232', 'Setlist.fm: live debut report'),
        external('https://www.officialcharts.com/songs/olivia-rodrigorobert-smith-whats-wrong-with-me/', 'Official Charts: song record'),
      )}
    `,
  },
  {
    title: 'Robert Smith says the next Cure album is finished',
    slug: 'cure-next-album-finished-2026',
    excerpt: 'The darker follow-up to Songs of a Lost World is complete, while Smith is also shaping a separate, brighter collection—though no release date is fixed yet.',
    published_date: '2026-06-09',
    reading_time: 4,
    tags: ['The Cure', 'Robert Smith', 'New Album', 'Studio'],
    featured_image: 'https://www.nme.com/wp-content/uploads/2026/04/NMEAR_NME-AWARDS-2022-ROBERT-SMITH-THE-CURE-LIVE-JENNIFER-MCCORD-17@2000x1270.jpg',
    image_credit: 'Robert Smith at the NME Awards. Photo: Jennifer McCord/NME',
    source_url: 'https://www.nme.com/news/music/robert-smith-says-the-cures-next-album-is-done-with-a-really-poppy-and-upbeat-separate-album-also-on-the-way-3949846',
    content: `
      <p>Robert Smith has given the clearest 2026 update yet on the music waiting beyond <em>Songs of a Lost World</em>. Speaking to BBC Radio 6 Music after Primavera Sound, he said The Cure’s next album is complete and ready for the next stage of release.</p>
      <p>The record is understood to contain thirteen tracks and to continue the darker strand of the sessions that produced <em>Songs of a Lost World</em>. Smith has described it as more desolate than its predecessor, which is quite a promise after an album built around absence, mortality and the closing “Endsong”.</p>
      <h2>One finished record, another change of light</h2>
      <p>Smith also discussed a separate group of songs with a much brighter character. That project is being shaped as an upbeat, overtly pop Cure album rather than simply an appendix to the lost-world sessions. Taken together, the comments suggest that the long gap before the 2024 record did not reflect a shortage of material; the harder task has been deciding how the songs should be grouped and completed.</p>
      <p>No release date or final title has been announced, and long-term Cure listeners know the wisdom of separating “finished” from “on the schedule”. Until the band and label confirm a date, it is better to treat this as a studio-status report than a release announcement.</p>
      <p>Even with that caution, the direction is significant. The Cure are touring with a Grammy-winning album behind them, another dark record apparently complete, and a contrasting pop set in development. For the first time in years, the future looks crowded rather than hypothetical.</p>
      ${sourceNote(
        external('https://www.nme.com/news/music/robert-smith-says-the-cures-next-album-is-done-with-a-really-poppy-and-upbeat-separate-album-also-on-the-way-3949846', 'NME: Robert Smith interview report'),
        external('https://www.musicradar.com/artists/singles-albums/shes-banging-out-songs-saying-what-do-you-think-of-this-and-im-its-great-im-not-really-sure-but-it-took-me-16-years-to-do-the-last-album-robert-smith-cant-match-with-olivia-rodrigos-work-rate-but-teases-dismal-and-poppy-cure-albums', 'MusicRadar: album details'),
      )}
    `,
  },
  {
    title: 'Robert Smith turns up twice on the Rolling Stones’ Foreign Tongues',
    slug: 'robert-smith-rolling-stones-foreign-tongues-2026',
    excerpt: 'The Cure frontman adds chiming guitar to “Divine Intervention”, then reappears on synth and backing vocals elsewhere on the Rolling Stones’ new album.',
    published_date: '2026-07-10',
    reading_time: 4,
    tags: ['Robert Smith', 'The Rolling Stones', 'Foreign Tongues', 'Collaboration'],
    featured_image: 'https://www.rte.ie/images/002495be-1600.jpg',
    image_credit: 'Robert Smith in Cardiff, 24 June 2026. Photo: Maxine Howells/Getty Images via RTÉ',
    source_url: 'https://pitchfork.com/news/listen-to-the-rolling-stones-song-with-robert-smith-divine-intervention/',
    content: `
      <p>Robert Smith’s 2026 collaborations did not stop with Olivia Rodrigo. The Cure frontman also appears on the Rolling Stones’ <em>Foreign Tongues</em>, released on 10 July, contributing to two tracks on the band’s twenty-fifth studio album.</p>
      <p>His most visible credit is “Divine Intervention”, where he plays guitar rather than sings. The part is woven into the track’s bright, chiming detail, a Cure-adjacent texture inside the Stones’ loose rock-and-roll frame without turning the song into a stylistic impersonation.</p>
      <h2>More than the advertised cameo</h2>
      <p>Smith also appears on “Never Wanna Lose You”, adding synthesizer and backing vocals. The two credits show different sides of his studio vocabulary: the recognisable guitar colour listeners expected, then a less obvious supporting role built into the arrangement.</p>
      <p>The album’s guest list is unusually broad, including Paul McCartney, Steve Winwood and Red Hot Chili Peppers drummer Chad Smith, as well as a posthumous appearance from Charlie Watts. In that company Robert’s contribution still feels distinctive—not because it dominates, but because it is used as texture rather than celebrity decoration.</p>
      <p><em>Foreign Tongues</em> arrived little more than a month after Smith debuted “What’s Wrong With Me” at Primavera and spoke publicly about the next Cure records. The cluster of activity makes 2026 a notably outward-looking year: The Cure are back on the road, while their singer is also moving easily through other artists’ music.</p>
      ${sourceNote(
        external('https://pitchfork.com/news/listen-to-the-rolling-stones-song-with-robert-smith-divine-intervention/', 'Pitchfork: “Divine Intervention” credits'),
        external('https://apnews.com/article/rolling-stones-new-album-foreign-tongues-aae39555f9610a5f7d96c431a94bcd41', 'Associated Press: album announcement'),
        external('https://www.rte.ie/entertainment/2026/0625/1580374-the-cures-robert-smith-joins-rolling-stones-on-new-music/', 'RTÉ: Robert Smith collaboration report'),
      )}
    `,
  },
  {
    title: 'Simon Gallup returns after Eden keeps The Cure on the road',
    slug: 'simon-gallup-returns-eden-steps-in-2026',
    excerpt: 'When illness removes Simon from the Berlin shows, Eden Gallup moves from guitar to bass; a week later father and son are both onstage at Electric Castle.',
    published_date: '2026-07-20',
    reading_time: 4,
    tags: ['The Cure', 'Simon Gallup', 'Eden Gallup', 'Tour'],
    featured_image: 'https://www.nme.com/wp-content/uploads/2026/07/The-Cure-perform-at-Electric-Castle-2026.-CREDIT_-Robert-Bumbes-for-Electric-Castle.jpg',
    image_credit: 'The Cure at Electric Castle, 19 July 2026. Photo: Robert Bumbes for Electric Castle, via NME',
    source_url: 'https://www.nme.com/news/music/the-cure-and-dogstar-close-out-a-weekend-of-magic-and-mayhem-at-electric-castle-2026-3957905',
    content: `
      <p>The Cure’s three-night Berlin run took an abrupt turn shortly before the first show on 10 July, when Simon Gallup became unwell. Eden Gallup, already part of the expanded touring line-up on guitar and keyboards, moved across to bass so the concert could go ahead.</p>
      <p>He stayed in that role while Simon recovered, covering one of the most physically and melodically distinctive jobs in The Cure. The substitution was practical, familial and musically demanding: Simon’s bass is rarely just support, often carrying the tune while the guitars and keyboards build weather around it.</p>
      <h2>Father and son at Electric Castle</h2>
      <p>By the band’s 19 July headline set at Electric Castle in Romania, Simon was back onstage. Eden remained in the six-piece line-up, returning to the additional guitar and keyboard role he had occupied since Primavera. The sight of both Gallups together turned the performance into a quiet resolution of the previous week’s uncertainty.</p>
      <p>The band has not publicly detailed the illness, and there is no reason to speculate. What the episode did establish is the flexibility of the current live group. Eden was not brought in as a novelty or a visual echo of his father; he was able to change instruments at short notice and protect three major shows.</p>
      <p>Electric Castle closed with the pop-facing run of “The Lovecats”, “Friday I’m in Love” and “Close to Me”. Underneath that celebratory ending sat the more important news: Simon was back, the tour had not lost a night, and the expanded Cure line-up had proved why it exists.</p>
      ${sourceNote(
        external('https://www.musicradar.com/artists/shows-festivals/hope-you-will-joining-us-in-wishing-simon-the-speediest-of-recoveries-and-eden-thanks-son-of-gallup-saves-the-day-for-the-cure', 'MusicRadar: Berlin substitution'),
        external('https://www.nme.com/news/music/the-cure-and-dogstar-close-out-a-weekend-of-magic-and-mayhem-at-electric-castle-2026-3957905', 'NME: Electric Castle report'),
      )}
    `,
  },
  {
    title: 'Gabriel Cooper brings saxophone to The Cure in Nîmes',
    slug: 'gabriel-cooper-sax-cure-nimes-2026',
    excerpt: 'Jason Cooper’s 17-year-old son joins all three sold-out Nîmes concerts, giving “A Night Like This” its live saxophone line inside the Roman arena.',
    published_date: '2026-07-27',
    reading_time: 4,
    tags: ['The Cure', 'Gabriel Cooper', 'Jason Cooper', 'Nîmes', 'Guest'],
    featured_image: 'https://www.thecure.com/wp-content/uploads/sites/10452/2025/12/nimes-sq.jpg',
    image_credit: 'Official Festival de Nîmes artwork via thecure.com',
    source_url: 'https://mail.cure-concerts.de/concerts/2026-07-24.php',
    content: `
      <p>The Cure’s three sold-out nights at the Arènes de Nîmes gained an unexpected recurring guest. Gabriel Cooper—the 17-year-old son of drummer Jason Cooper—joined the band on saxophone for “A Night Like This” on 24, 25 and 26 July.</p>
      <p>The part is a brief but defining colour in the 1985 recording, and live versions have often translated or omitted it. Bringing a saxophonist into the six-piece touring line-up allowed the song to recover that brass voice without changing the architecture of the performance around it.</p>
      <h2>Three nights, three appearances</h2>
      <p>The first Nîmes concert confirmed Gabriel after he had also played the song during soundcheck. He returned on each of the following two nights, turning what might have been a one-off family moment into a small feature of the residency. Cureation’s setlist records now tag him against all three performances rather than listing him as a general member of the touring band.</p>
      <p>The residency itself was built for variation. Each night ran to around thirty songs, with changes reaching well beyond the encore. The first brought “A Letter to Elise” back for the first time since 2016, while the Roman arena gave the band an unusually dramatic setting for the long, dusk-to-midnight programmes they favour.</p>
      <p>Gabriel’s appearance belongs in the guest column, not as a permanent line-up change. Even so, it is a memorable addition to the 2026 story: a second generation entering one song with precision, beside a father who has anchored The Cure since 1995.</p>
      ${sourceNote(
        external('https://mail.cure-concerts.de/concerts/2026-07-24.php', 'Cure Concerts: Nîmes, 24 July'),
        external('https://mail.cure-concerts.de/concerts/2026-07-25.php', 'Cure Concerts: Nîmes, 25 July'),
        external('https://mail.cure-concerts.de/concerts/2026-07-26.php', 'Cure Concerts: Nîmes, 26 July'),
        external('https://festivaldenimes.com/artiste/the-cure/', 'Festival de Nîmes: event page'),
      )}
    `,
  },
  {
    title: 'The Cure finally play Lithuania and Estonia',
    slug: 'cure-first-lithuania-estonia-shows-2026',
    excerpt: 'Vilnius and Tallinn turn two March announcements into genuine landmarks as The Cure’s summer tour enters the Baltic states for the first time.',
    published_date: '2026-08-10',
    reading_time: 4,
    tags: ['The Cure', 'Vilnius', 'Tallinn', 'Lithuania', 'Estonia'],
    featured_image: 'https://www.bilesuserviss.lv/imageGenerator/concertShort/7811037ede7ac98d10fac283e52fd890.webp',
    image_credit: 'Official Tallinn concert artwork via Biļešu Serviss / Piletilevi',
    source_url: 'https://www.thecure.com/news/2026/03/3765/',
    content: `
      <p>The Cure’s long-awaited Baltic debuts are now part of the record rather than the itinerary. The band played Kalnų Parkas in Vilnius on 7 August and Tallinn’s Unibet Arena on 9 August—their first concerts in Lithuania and Estonia respectively.</p>
      <p>Vilnius received a 26-song set that began with “Alone” and moved through a compact survey of the catalogue before a nine-song encore ending in “Boys Don’t Cry”. The balance leaned towards a broad outdoor audience, but “alt.end”, “Wrong Number” and the pairing of “Alone” with “Endsong” kept the 2026 identity intact.</p>
      <h2>Tallinn goes deeper</h2>
      <p>Two nights later, Tallinn stretched to 28 songs and changed the centre of the programme. “Never Enough”, “Treasure”, “Want”, “A Strange Day” and “Secrets” all entered, while “Mint Car” joined the encore. It was the kind of shift that makes following this tour night by night rewarding: the familiar frame remains, but the emotional weight moves.</p>
      <p>Both concerts carried a significance independent of rarity counts. The Cure have played Europe continuously across their career, yet these two countries had remained blank spaces on the map. A first show after nearly fifty years of touring is not routine expansion; it is a meeting delayed by decades.</p>
      <p>The tour continued immediately to Oslo on 12 August and Gothenburg on 14 August, with Manchester, Belfast, Dublin, Edinburgh, Bordeaux and Paris still to come. The Baltic pair will remain one of the summer’s clearest landmarks because no future return can ever be the first.</p>
      ${sourceNote(
        external('https://www.thecure.com/news/2026/03/3765/', 'The Cure: original Baltic announcement'),
        external('https://cureation.net/setlists/kalnu-parkas-vilnius-2026-08-07', 'Cureation: Vilnius set list'),
        external('https://cureation.net/setlists/unibet-arena-tallinn-2026-08-09', 'Cureation: Tallinn set list'),
      )}
    `,
  },
  {
    title: 'From Oslo to Gothenburg, The Cure’s summer keeps changing shape',
    slug: 'cure-oslo-gothenburg-2026-tour-update',
    excerpt: 'Two Scandinavian festival sets complete the tour’s latest leg, with Oslo given a deep 28-song programme and Gothenburg a tighter closing-night sequence.',
    published_date: '2026-08-15',
    reading_time: 3,
    tags: ['The Cure', 'Oslo', 'Gothenburg', 'Festival Summer', 'Live'],
    featured_image: 'https://static.spinmagazine.com/files/2026/06/RSGettyImages-2280112112.jpg',
    image_credit: 'Robert Smith during the 2026 Festival Summer. Photo: Xavi Torrent/Getty Images via SPIN',
    source_url: 'https://www.thecure.com/',
    featured: true,
    content: `
      <p>The Cure’s 2026 Festival Summer reached Scandinavia this week with two deliberately different shows: a 28-song set at Oslo’s Øyafestivalen on 12 August, followed by a tighter 23-song headline performance at Way Out West in Gothenburg on 14 August.</p>
      <p>Oslo had room to wander. The main set moved from “Alone” and “Pictures of You” through “A Night Like This”, “Burn” and “Fascination Street”, then opened into deeper catalogue choices before “Endsong”. A long encore carried the brighter run of singles without losing the scale established earlier in the night.</p>
      <h2>Compression without retreat</h2>
      <p>Gothenburg worked to a shorter festival frame, but the change was not simply a diminished version of Oslo. The band reshaped the sequence to preserve its contrasts: the current album at the edges, a dark central stretch, then the rapid pop release of the encore.</p>
      <p>That adaptability has become the defining live story of 2026. Eden Gallup’s addition widened the sound; his emergency move to bass kept Berlin running; Simon Gallup’s return restored the familiar engine; Gabriel Cooper’s Nîmes appearances introduced a song-specific guest colour. Around those personnel moments, the set list has kept moving.</p>
      <p>The next phase brings major UK and Irish dates, including Manchester, Belfast, Dublin and Edinburgh, before France closes the month. Halfway through August, the evidence is strong: The Cure have treated the festival circuit as a series of individual concerts, not a single package moved from field to field.</p>
      ${sourceNote(
        external('https://cureation.net/setlists/oyafestivalen-2026-oslo-2026-08-12', 'Cureation: Oslo set list'),
        external('https://cureation.net/setlists/way-out-west-2026-gothenburg-2026-08-14', 'Cureation: Gothenburg set list'),
        external('https://www.thecure.com/', 'The Cure: official 2026 shows'),
      )}
    `,
  },
];

const common = {
  category: 'news',
  author_name: AUTHOR_NAME,
  featured: false,
  is_editorial: false,
};

const existing = await api(freshNewsPath());
const bySlug = new Map(existing.map((item) => [item.slug, item]));
const results = [];

for (const story of stories) {
  const current = bySlug.get(story.slug);
  const payload = { ...common, ...story };
  if (current) {
    await api(`/items/news/${current.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    results.push({ action: 'updated', id: current.id, slug: story.slug });
  } else {
    const created = await api('/items/news', { method: 'POST', body: JSON.stringify(payload) });
    results.push({ action: 'created', id: created.id, slug: story.slug });
  }
}

console.log(JSON.stringify({ count: results.length, results }, null, 2));
