#!/usr/bin/env python3
"""
Populate Directus `discography` with complete non-studio coverage and missing studio content.

What this does:
1) Expands `discography.type` choices to include studio/live/compilation/ep/single.
2) Fills missing long-form fields on existing studio albums.
3) Upserts official live, compilation, and remix-era releases by title (no duplicates).
"""

import json
import os
import re
import time
import urllib.error
import urllib.request

BASE = os.getenv("DIRECTUS_BASE", "https://dash.cureation.net")
TOKEN = os.getenv("DIRECTUS_TOKEN")

if not TOKEN:
    raise SystemExit("DIRECTUS_TOKEN is required.")

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}


def req(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, headers=HEADERS, method=method)

    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore")
        print(f"  ERROR {method} {path}: {exc.code} {detail[:300]}")
        return None


def is_empty(value):
    return value is None or (isinstance(value, str) and not value.strip())


def normalize_title(title):
    return re.sub(r"[^a-z0-9]", "", (title or "").lower())


def ensure_type_choices():
    payload = {
        "meta": {
            "options": {
                "choices": [
                    {"text": "Studio", "value": "studio"},
                    {"text": "Live", "value": "live"},
                    {"text": "Compilation", "value": "compilation"},
                    {"text": "EP", "value": "ep"},
                    {"text": "Single", "value": "single"},
                ]
            }
        }
    }
    result = req("PATCH", "/fields/discography/type", payload)
    if result and "data" in result:
        print("  OK type choices ensured: studio/live/compilation/ep/single")


def fetch_discography():
    cache_buster = int(time.time() * 1000)
    result = req(
        "GET",
        "/items/discography?limit=300&fields="
        "id,title,type,release_date,label,producer,featured,"
        "description,background_text,critical_reception,credits"
        f"&_={cache_buster}",
    )
    if not result or "data" not in result:
        return []
    return result["data"]


def patch_album(album_id, payload):
    result = req("PATCH", f"/items/discography/{album_id}", payload)
    if result and "data" in result:
        print(f"  UPDATED #{album_id}: {result['data'].get('title')}")
        return result["data"]
    return None


def create_album(payload):
    result = req("POST", "/items/discography", payload)
    if result and "data" in result:
        print(f"  CREATED #{result['data'].get('id')}: {result['data'].get('title')}")
        return result["data"]
    return None


def build_update_payload(current, desired, overwrite=False):
    patch = {}
    for key, desired_value in desired.items():
        current_value = current.get(key)

        # Always keep key fields canonical.
        if key in {"type", "release_date", "featured"} and current_value != desired_value:
            patch[key] = desired_value
            continue

        if overwrite:
            if current_value != desired_value:
                patch[key] = desired_value
            continue

        # Non-overwrite mode: fill gaps only.
        if is_empty(current_value) and not is_empty(desired_value):
            patch[key] = desired_value

    return patch


def upsert_by_title(existing_by_title, desired, overwrite=False):
    key = normalize_title(desired["title"])
    current = existing_by_title.get(key)

    if current:
        patch = build_update_payload(current, desired, overwrite=overwrite)
        if patch:
            updated = patch_album(current["id"], patch)
            if updated:
                existing_by_title[key] = updated
        else:
            print(f"  OK no change: {current.get('title')}")
        return

    created = create_album(desired)
    if created:
        existing_by_title[key] = created


STUDIO_ENRICHMENTS = {
    "Three Imaginary Boys": {
        "type": "studio",
        "background_text": (
            "Recorded during 1978 and early 1979, the debut captured The Cure in transition "
            "from punk roots to a colder, moodier post-punk identity. Robert Smith later "
            "said the final track selection reflected label decisions as much as band intent."
        ),
        "critical_reception": (
            "Early reviews were mixed but recognized the band's distinctive atmosphere and "
            "songwriting edge. Retrospectively it is widely treated as an essential starting "
            "point for The Cure and late-70s post-punk."
        ),
        "credits": (
            "The Cure: Robert Smith, Michael Dempsey, Lol Tolhurst. Produced by Chris Parry "
            "for Fiction Records."
        ),
    },
    "Seventeen Seconds": {
        "type": "studio",
        "background_text": (
            "With Simon Gallup and Matthieu Hartley joining, the band pivoted toward minimal "
            "arrangements, space, and atmosphere. The sessions established the sonic language "
            "that would define much of The Cure's 1980s output."
        ),
        "critical_reception": (
            "The album marked a major artistic step forward and became a lasting fan favorite, "
            "especially for the enduring single 'A Forest'. It is regularly cited as a key "
            "foundation of gothic and atmospheric post-punk."
        ),
        "credits": (
            "The Cure lineup era: Robert Smith, Simon Gallup, Lol Tolhurst, Matthieu Hartley. "
            "Produced by Mike Hedges and The Cure."
        ),
    },
    "Faith": {
        "type": "studio",
        "background_text": (
            "Built around slow tempos, repetition, and stark textures, Faith deepened the mood "
            "first explored on Seventeen Seconds. Its writing and sequencing emphasized grief, "
            "emptiness, and spiritual uncertainty."
        ),
        "critical_reception": (
            "Faith reinforced The Cure's reputation as one of the era's boldest atmospheric "
            "bands. Over time it has been recognized as a centerpiece of the group's early "
            "dark-period catalog."
        ),
        "credits": (
            "The Cure: Robert Smith, Simon Gallup, Lol Tolhurst. Produced by Mike Hedges and "
            "The Cure."
        ),
    },
    "Pornography": {
        "type": "studio",
        "background_text": (
            "Created during intense personal and internal band strain, Pornography pushed the "
            "group toward maximal density, noise, and emotional extremity. It concluded the "
            "early trilogy of Seventeen Seconds, Faith, and Pornography."
        ),
        "critical_reception": (
            "Initially polarizing, the record is now routinely ranked among The Cure's most "
            "important releases and one of the defining statements in dark alternative rock."
        ),
        "credits": (
            "The Cure: Robert Smith, Simon Gallup, Lol Tolhurst. Produced by Phil Thornalley "
            "and The Cure."
        ),
    },
    "The Top": {
        "type": "studio",
        "background_text": (
            "Following the collapse of the previous lineup, Robert Smith steered an unusually "
            "fluid and experimental recording period. The Top bridges the severe early trilogy "
            "and the sharper pop structures of the mid-80s albums."
        ),
        "critical_reception": (
            "The album remains divisive but valued for its unpredictability and adventurous "
            "tone. Retrospective reassessment often highlights it as an underrated turning point."
        ),
        "credits": (
            "Core contributors included Robert Smith with collaborators from the era's touring "
            "lineup. Produced by David M. Allen and The Cure."
        ),
    },
    "The Head on the Door": {
        "type": "studio",
        "background_text": (
            "The stabilized five-piece lineup delivered a concise, highly melodic set that "
            "balanced hooks with mood. The record marked The Cure's breakthrough into broader "
            "international visibility."
        ),
        "critical_reception": (
            "Widely praised on release, it is now considered one of the strongest pop-era Cure "
            "albums and a gateway record for many listeners."
        ),
        "credits": (
            "The Cure: Robert Smith, Simon Gallup, Lol Tolhurst, Porl Thompson, Boris Williams. "
            "Produced by David M. Allen and The Cure."
        ),
    },
    "Kiss Me, Kiss Me, Kiss Me": {
        "type": "studio",
        "background_text": (
            "Designed as a broad double album statement, the sessions ranged from lush pop to "
            "noise rock and atmospheric balladry. The scale and variety helped turn The Cure "
            "into a global arena-level act."
        ),
        "critical_reception": (
            "Critics and fans embraced its ambition and songwriting depth. It remains one of the "
            "band's most celebrated and commercially impactful releases."
        ),
        "credits": (
            "The Cure lineup era: Robert Smith, Simon Gallup, Porl Thompson, Boris Williams, "
            "Lol Tolhurst. Produced by David M. Allen and The Cure."
        ),
    },
    "Wish": {
        "type": "studio",
        "background_text": (
            "Recorded in 1991-1992 after the Disintegration era, Wish combined widescreen guitar "
            "textures with direct pop songwriting. The album captured the band at a commercial "
            "peak while preserving its emotional depth."
        ),
        "critical_reception": (
            "A major chart success on release and still one of the band's most accessible "
            "records. Retrospective writing often highlights the balance between melancholy and "
            "anthemic singles."
        ),
        "credits": (
            "The Cure: Robert Smith, Simon Gallup, Porl Thompson, Boris Williams, Perry Bamonte. "
            "Produced by David M. Allen and The Cure."
        ),
    },
    "Wild Mood Swings": {
        "type": "studio",
        "background_text": (
            "Built during a period of lineup change, the album intentionally jumped between "
            "styles rather than following a single mood. It reflected Robert Smith's interest "
            "in contrast and orchestral color after the success of Wish."
        ),
        "critical_reception": (
            "Reception was mixed at release, but later reassessment has been kinder to its "
            "range and craftsmanship. It remains a debated but increasingly appreciated record."
        ),
        "credits": (
            "The Cure centered on Robert Smith and Simon Gallup with multiple collaborators "
            "across sessions. Produced by Robert Smith and Steve Lyon."
        ),
    },
    "Bloodflowers": {
        "type": "studio",
        "background_text": (
            "A deliberate return to long-form, atmospheric writing, Bloodflowers emphasized "
            "patience, texture, and emotional weight. Robert Smith framed it as spiritually "
            "connected to the band's earlier darker works."
        ),
        "critical_reception": (
            "Reviews were generally strong and many fans regard it as one of the best "
            "post-90s Cure albums. Its reputation has continued to grow over time."
        ),
        "credits": (
            "The Cure: Robert Smith, Simon Gallup, Perry Bamonte, Roger O'Donnell, Jason Cooper. "
            "Produced by Robert Smith and Paul Corkett."
        ),
    },
    "The Cure": {
        "type": "studio",
        "background_text": (
            "The self-titled record documented an aggressive tonal shift, with producer Ross "
            "Robinson pushing the band toward raw performances and heavier sonics. It stands as "
            "one of the catalog's most confrontational studio releases."
        ),
        "critical_reception": (
            "Critical reaction was split, with praise for risk-taking and criticism of the mix "
            "and sequencing. Over time it has gained recognition as a bold stylistic detour."
        ),
        "credits": (
            "The Cure: Robert Smith, Simon Gallup, Perry Bamonte, Roger O'Donnell, Jason Cooper. "
            "Produced by Ross Robinson."
        ),
    },
    "4:13 Dream": {
        "type": "studio",
        "background_text": (
            "Drawn from larger sessions that did not fully materialize as a planned double "
            "release, 4:13 Dream focused on bright guitars and compact arrangements."
        ),
        "critical_reception": (
            "Reception ranged from positive to mixed, but fans often highlight strong individual "
            "tracks and melodic writing. It remains the band's final 2000s studio statement."
        ),
        "credits": (
            "The Cure: Robert Smith, Simon Gallup, Porl Thompson, Roger O'Donnell, Jason Cooper. "
            "Produced by Robert Smith and Keith Uddin."
        ),
    },
    "Songs of a Lost World": {
        "type": "studio",
        "background_text": (
            "Released on 1 November 2024, this album ended a sixteen-year studio gap with a "
            "focused eight-track sequence centered on grief, age, and memory."
        ),
        "critical_reception": (
            "The record received broad acclaim and was widely described as a major late-career "
            "achievement, with several outlets placing it among the band's strongest albums."
        ),
        "credits": (
            "The Cure: Robert Smith, Simon Gallup, Roger O'Donnell, Reeves Gabrels, Jason Cooper, "
            "Perry Bamonte. Produced by Robert Smith and Paul Corkett."
        ),
    },
}


LIVE_ALBUMS = [
    {
        "title": "Concert: The Cure Live",
        "type": "live",
        "release_date": "1984-10-26",
        "label": "Fiction Records",
        "producer": "The Cure",
        "featured": False,
        "description": "The first official live album by The Cure, capturing the band's early-80s stage intensity.",
        "background_text": "Issued after The Top era, Concert documented a transitional lineup and the group's growing live scale.",
        "critical_reception": "A strong UK chart performer that helped establish The Cure as a formidable concert act.",
        "credits": "Live performances by The Cure; original production and sleeve credits per Fiction release notes.",
    },
    {
        "title": "Entreat",
        "type": "live",
        "release_date": "1991-03-25",
        "label": "Fiction Records",
        "producer": "The Cure",
        "featured": False,
        "description": "Live interpretations of Disintegration-era material, originally released as a limited issue.",
        "background_text": "Compiled from performances during The Prayer Tour and later given broader commercial release.",
        "critical_reception": "Highly regarded by fans for its immersive atmosphere and deep focus on Disintegration songs.",
        "credits": "The Cure live lineup from the Disintegration period; production credits as listed on official editions.",
    },
    {
        "title": "Show",
        "type": "live",
        "release_date": "1993-09-13",
        "label": "Fiction/Polydor, Elektra",
        "producer": "Robert Smith",
        "featured": False,
        "description": "Major live release from the Wish tour, emphasizing the band's larger arena-era setlist.",
        "background_text": "Recorded over two nights in 1992 and released with a companion concert film.",
        "critical_reception": "Charted internationally and became one of the band's best known live albums.",
        "credits": "The Cure lineup from the Wish tour period; produced by Robert Smith.",
    },
    {
        "title": "Paris",
        "type": "live",
        "release_date": "1993-10-25",
        "label": "Fiction/Polydor, Elektra",
        "producer": "The Cure",
        "featured": False,
        "description": "A companion to Show with a darker setlist focused on cult favorites and deep cuts.",
        "background_text": "Recorded in Paris during the Wish-era touring cycle and released shortly after Show.",
        "critical_reception": "Praised by long-time fans for its mood and song selection from the band's darker catalog.",
        "credits": "The Cure live performances recorded in Paris; official production/mix credits per release notes.",
    },
    {
        "title": "Bestival Live 2011",
        "type": "live",
        "release_date": "2011-12-02",
        "label": "Sunday Best",
        "producer": "The Cure",
        "featured": False,
        "description": "Double live set documenting the band's headline performance at Bestival 2011.",
        "background_text": "Released as a charity-focused issue tied to the Isle of Wight festival performance.",
        "critical_reception": "Well received as a snapshot of the modern-era live band and an expansive setlist.",
        "credits": "The Cure live at Bestival 2011; release issued via Sunday Best.",
    },
    {
        "title": "40 Live (Curaetion-25 + Anniversary)",
        "type": "live",
        "release_date": "2019-10-18",
        "label": "Eagle Vision/Universal Music Group",
        "producer": "Tim Pope and The Cure",
        "featured": False,
        "description": "Fortieth-anniversary live package combining the Curaetion-25 and Anniversary performances.",
        "background_text": "Documents two major 2018 shows: Meltdown Festival and Hyde Park anniversary celebration.",
        "critical_reception": "Celebrated as a comprehensive modern live document spanning the full studio-era catalog.",
        "credits": "The Cure live recordings with film direction by Tim Pope; released by Eagle Vision.",
    },
    {
        "title": "Songs of a Live World - Troxy London MMXXIV",
        "type": "live",
        "release_date": "2024-12-13",
        "label": "Fiction/Polydor",
        "producer": "The Cure",
        "featured": True,
        "description": "Live presentation of Songs of a Lost World material alongside selected catalog tracks.",
        "background_text": "Recorded at London's Troxy and released in late 2024 after the studio album's launch cycle.",
        "critical_reception": "Praised as a strong companion release that highlighted the emotional weight of the new songs.",
        "credits": "The Cure live lineup of the 2024 era; release and production credits per official listing.",
    },
]


COMPILATION_AND_RELATED = [
    {
        "title": "Boys Don't Cry",
        "type": "compilation",
        "release_date": "1980-02-05",
        "label": "PVC, Fiction",
        "producer": "The Cure and Chris Parry",
        "featured": False,
        "description": "Early compilation that introduced key non-album and alternate early-era tracks to wider markets.",
        "background_text": "Assembled shortly after the debut period for territories where the original UK album varied in availability.",
        "critical_reception": "Historically important for helping establish The Cure's international audience.",
        "credits": "Compilation of early Cure recordings curated for regional release on PVC/Fiction.",
    },
    {
        "title": "Japanese Whispers",
        "type": "compilation",
        "release_date": "1983-12-16",
        "label": "Fiction, Sire",
        "producer": "The Cure",
        "featured": False,
        "description": "Collection of singles and related material from The Cure's 1982-1983 transition period.",
        "background_text": "Captures the post-Pornography shift toward brighter pop structures and experimentation.",
        "critical_reception": "Frequently cited as an essential bridge between the early dark trilogy and later pop breakthroughs.",
        "credits": "Features the early-80s Cure lineups across multiple sessions and single releases.",
    },
    {
        "title": "Standing on a Beach: The Singles",
        "type": "compilation",
        "release_date": "1986-05-15",
        "label": "Fiction, Elektra",
        "producer": "The Cure",
        "featured": True,
        "description": "Landmark singles anthology covering the first major phase of The Cure's career.",
        "background_text": "Released at the midpoint of the 1980s rise, with variants titled Staring at the Sea in some formats.",
        "critical_reception": "One of the band's most successful catalog releases, with multi-platinum certifications in several markets.",
        "credits": "Compilation of officially released singles from the early Cure era on Fiction/Elektra.",
    },
    {
        "title": "Galore: The Singles 1987-1997",
        "type": "compilation",
        "release_date": "1997-10-28",
        "label": "Fiction, Elektra",
        "producer": "The Cure",
        "featured": False,
        "description": "Second major singles overview, focused on the late-80s and 90s hit period.",
        "background_text": "Served as a companion volume to Standing on a Beach for the next decade of singles output.",
        "critical_reception": "Well received as a concise summary of the band's arena-era and post-Wish single run.",
        "credits": "Compilation of officially released singles from 1987 through 1997.",
    },
    {
        "title": "Greatest Hits",
        "type": "compilation",
        "release_date": "2001-11-07",
        "label": "Fiction/Polydor, Elektra",
        "producer": "The Cure",
        "featured": False,
        "description": "Career-spanning best-of set collecting The Cure's most recognizable singles.",
        "background_text": "Released with multiple editions, including a companion acoustic reinterpretation program.",
        "critical_reception": "A durable catalog performer that introduced the band to new listeners in the 2000s.",
        "credits": "Compilation assembled from officially released Cure singles and key catalog tracks.",
    },
    {
        "title": "Alternative Rarities 1988-1989",
        "type": "compilation",
        "release_date": "2010-05-15",
        "label": "Self-released",
        "producer": "Robert Smith",
        "featured": False,
        "description": "Digital-only rarities set from the late-80s period, issued in limited form.",
        "background_text": "Released as a focused archival companion to broader reissue activity.",
        "critical_reception": "Primarily valued by collectors and dedicated fans for access to otherwise hard-to-find material.",
        "credits": "Archival/rare recordings curated for limited digital release.",
    },
    {
        "title": "Acoustic Hits",
        "type": "compilation",
        "release_date": "2017-04-22",
        "label": "Fiction, Elektra",
        "producer": "The Cure",
        "featured": False,
        "description": "Acoustic reinterpretations of major Cure songs, originally paired with Greatest Hits editions.",
        "background_text": "Received a wider standalone vinyl issue after first appearing as a bonus disc in 2001.",
        "critical_reception": "Regarded as a compelling alternate view of familiar material.",
        "credits": "Acoustic studio performances by The Cure recorded for Greatest Hits era releases.",
    },
    {
        "title": "Mixed Up",
        "type": "compilation",
        "release_date": "1990-11-05",
        "label": "Fiction, Elektra",
        "producer": "The Cure",
        "featured": False,
        "description": "Remix-focused collection presenting extended and reworked versions of key songs.",
        "background_text": "Built during the post-Disintegration period and became a significant crossover catalog title.",
        "critical_reception": "Commercially successful and later reassessed as an influential alternative-remix document.",
        "credits": "Remixes and extended versions produced/curated by The Cure and collaborators.",
    },
    {
        "title": "Torn Down: Mixed Up Extras 2018",
        "type": "compilation",
        "release_date": "2018-04-21",
        "label": "Fiction, Elektra",
        "producer": "Robert Smith",
        "featured": False,
        "description": "Companion remix project revisiting and reimagining catalog tracks in modern form.",
        "background_text": "Issued as part of expanded Mixed Up-era reissue activity and archival presentation.",
        "critical_reception": "Praised by long-time fans interested in reinterpretations rather than canonical album versions.",
        "credits": "Remix collection curated and shaped by Robert Smith with archival source material.",
    },
    {
        "title": "Mixes of a Lost World",
        "type": "compilation",
        "release_date": "2025-06-13",
        "label": "Fiction, Polydor",
        "producer": "The Cure and guests",
        "featured": True,
        "description": "Remix project connected to Songs of a Lost World, featuring reinterpretations of the new-era material.",
        "background_text": "Released in 2025 as a post-album expansion of the Songs of a Lost World cycle.",
        "critical_reception": "Received attention for extending the album's themes into club and experimental remix spaces.",
        "credits": "Songs of a Lost World material remixed by invited producers and collaborators.",
    },
]


def main():
    print("\n=== Discography Full Population ===\n")

    print("1) Ensuring type choices...")
    ensure_type_choices()
    time.sleep(0.1)

    albums = fetch_discography()
    if not albums:
        raise SystemExit("No discography records returned. Aborting.")

    existing_by_title = {normalize_title(a.get("title", "")): a for a in albums}
    print(f"\nCurrent discography records: {len(existing_by_title)}")

    print("\n2) Filling missing studio long-form fields...")
    for title, payload in STUDIO_ENRICHMENTS.items():
        upsert_by_title(existing_by_title, {"title": title, **payload}, overwrite=False)
        time.sleep(0.08)

    print("\n3) Upserting live albums...")
    for payload in LIVE_ALBUMS:
        upsert_by_title(existing_by_title, payload, overwrite=True)
        time.sleep(0.08)

    print("\n4) Upserting compilation/remix albums...")
    for payload in COMPILATION_AND_RELATED:
        upsert_by_title(existing_by_title, payload, overwrite=True)
        time.sleep(0.08)

    print("\n5) Verification...\n")
    final = fetch_discography()
    by_type = {}
    missing_long_fields = 0

    for album in final:
        t = album.get("type") or "(none)"
        by_type[t] = by_type.get(t, 0) + 1
        if any(is_empty(album.get(f)) for f in ["background_text", "critical_reception", "credits"]):
            missing_long_fields += 1

    total = len(final)
    print(f"Total albums: {total}")
    for t in sorted(by_type.keys()):
        print(f"  {t}: {by_type[t]}")
    print(f"Albums still missing one or more long-form fields: {missing_long_fields}")


if __name__ == "__main__":
    main()
