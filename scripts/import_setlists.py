#!/usr/bin/env python3
"""
Phase 2: Import all setlists from the_cure_setlists.json into Directus.

Steps:
1) Create `tours` collection if missing
2) Add new fields to `setlists` (source, state_province)
3) Fix `setlist_songs` relationships
4) Populate tours from known data
5) Bulk import ~739 concerts
6) Create setlist_songs rows linked to songs collection
"""

import json
import os
import re
import time
import urllib.error
import urllib.request

BASE = os.getenv("DIRECTUS_BASE", "https://dash.cureation.net")
TOKEN = os.getenv("DIRECTUS_TOKEN", "lWJqSCsTBaXlLHooNmQz1EPnB_81rbiy")

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
        if "already exists" in detail.lower() or "SQLITE_ERROR" in detail:
            return {"_already_exists": True}
        print(f"  ERROR {method} {path}: {exc.code} {detail[:300]}")
        return None


def normalize(title):
    return re.sub(r"[^a-z0-9]", "", (title or "").lower())


def generate_slug(text):
    return re.sub(r"[^\w\s-]", "", (text or "").lower()).strip().replace(" ", "-")


# ── Step 1: Create tours collection ─────────────────────────────────────────

def create_tours_collection():
    print("Creating tours collection...")
    payload = {
        "collection": "tours",
        "meta": {"icon": "tour", "note": "The Cure concert tours"},
        "schema": {"name": "tours"},
        "fields": [
            {
                "field": "id", "type": "integer",
                "meta": {"hidden": True, "readonly": True, "interface": "input"},
                "schema": {"is_primary_key": True, "has_auto_increment": True},
            },
            {"field": "name", "type": "string", "meta": {"interface": "input", "required": True}},
            {"field": "slug", "type": "string", "meta": {"interface": "input"}},
            {"field": "start_date", "type": "date", "meta": {"interface": "datetime"}},
            {"field": "end_date", "type": "date", "meta": {"interface": "datetime"}},
            {"field": "description", "type": "text", "meta": {"interface": "input-multiline"}},
            {"field": "associated_album", "type": "integer", "meta": {"interface": "select-dropdown-m2o"}},
            {"field": "total_shows", "type": "integer", "meta": {"interface": "input"}},
        ],
    }
    result = req("POST", "/collections", payload)
    if result:
        if result.get("_already_exists"):
            print("  ~ tours already exists")
        elif "data" in result:
            print("  OK created tours collection")
    return result


# ── Step 2: Add fields to setlists ──────────────────────────────────────────

def add_field_if_missing(collection, field_name, field_type, meta=None):
    check = req("GET", f"/fields/{collection}/{field_name}")
    if check and "data" in check:
        return
    payload = {"field": field_name, "type": field_type}
    if meta:
        payload["meta"] = meta
    result = req("POST", f"/fields/{collection}", payload)
    if result and "data" in result:
        print(f"  ADDED {collection}.{field_name}")


def expand_setlist_fields():
    print("\nAdding fields to setlists...")
    add_field_if_missing("setlists", "source", "string", {"interface": "input", "note": "Data source"})
    add_field_if_missing("setlists", "state_province", "string", {"interface": "input"})
    add_field_if_missing("setlists", "tour", "integer", {"interface": "select-dropdown-m2o", "note": "Link to tours collection"})

    print("Adding fields to setlist_songs...")
    add_field_if_missing("setlist_songs", "is_cover", "boolean", {"interface": "boolean"})
    add_field_if_missing("setlist_songs", "cover_artist", "string", {"interface": "input"})
    add_field_if_missing("setlist_songs", "is_debut", "boolean", {"interface": "boolean"})


# ── Step 3: Populate tours ───────────────────────────────────────────────────

KNOWN_TOURS = [
    {"name": "Future Pastimes Tour", "slug": "future-pastimes", "start_date": "2000-02-01", "end_date": "2000-12-31"},
    {"name": "Dream Tour", "slug": "dream-tour", "start_date": "2000-02-23", "end_date": "2000-12-11"},
    {"name": "Bloodflowers Tour", "slug": "bloodflowers-tour", "start_date": "2000-02-22", "end_date": "2000-12-15"},
    {"name": "Greatest Hits Tour", "slug": "greatest-hits-tour", "start_date": "2001-11-01", "end_date": "2002-03-31"},
    {"name": "Trilogy Tour", "slug": "trilogy-tour", "start_date": "2002-11-01", "end_date": "2002-11-30"},
    {"name": "Curiosa Festival Tour", "slug": "curiosa-festival", "start_date": "2004-07-01", "end_date": "2004-09-30"},
    {"name": "The Cure Tour 2004", "slug": "cure-tour-2004", "start_date": "2004-06-01", "end_date": "2004-12-31"},
    {"name": "4Tour", "slug": "4tour", "start_date": "2007-10-01", "end_date": "2008-03-31"},
    {"name": "4Play Tour", "slug": "4play-tour", "start_date": "2008-06-01", "end_date": "2008-12-31"},
    {"name": "Festival Summer 2009", "slug": "festivals-2009", "start_date": "2009-06-01", "end_date": "2009-09-30"},
    {"name": "Reflections Tour", "slug": "reflections-tour", "start_date": "2011-11-01", "end_date": "2011-12-31"},
    {"name": "Bestival 2011", "slug": "bestival-2011", "start_date": "2011-09-08", "end_date": "2011-09-11"},
    {"name": "Festival Summer 2012", "slug": "festivals-2012", "start_date": "2012-06-01", "end_date": "2012-09-30"},
    {"name": "LatAm & Festivals 2013", "slug": "latam-festivals-2013", "start_date": "2013-04-01", "end_date": "2013-08-31"},
    {"name": "North America 2016", "slug": "north-america-2016", "start_date": "2016-05-01", "end_date": "2016-07-31"},
    {"name": "Anniversary Tour 2018", "slug": "anniversary-2018", "start_date": "2018-06-01", "end_date": "2018-12-31"},
    {"name": "Shows of a Lost World Tour", "slug": "shows-of-a-lost-world", "start_date": "2022-10-01", "end_date": "2023-12-31"},
]


def populate_tours():
    print("\nPopulating tours...")
    existing = req("GET", "/items/tours?limit=200&fields=id,name,slug")
    existing_slugs = set()
    if existing and "data" in existing:
        existing_slugs = {t.get("slug") for t in existing["data"]}

    tour_map = {}
    if existing and "data" in existing:
        for t in existing["data"]:
            tour_map[normalize(t["name"])] = t["id"]

    for tour in KNOWN_TOURS:
        if tour["slug"] in existing_slugs:
            # Find ID
            if existing and "data" in existing:
                for t in existing["data"]:
                    if t["slug"] == tour["slug"]:
                        tour_map[normalize(tour["name"])] = t["id"]
            continue
        result = req("POST", "/items/tours", tour)
        if result and "data" in result:
            print(f"  CREATED tour: {tour['name']}")
            tour_map[normalize(tour["name"])] = result["data"]["id"]
        time.sleep(0.05)

    return tour_map


# ── Step 4: Load and parse setlist JSON ──────────────────────────────────────

def load_setlists_json():
    json_path = os.path.join(
        os.path.dirname(__file__), "..",
        "Outside setlist", "Untitled", "CureationSetlists",
        "draft post bots", "the_cure_setlists.json"
    )
    # Handle absolute path fallback
    if not os.path.exists(json_path):
        json_path = "/Users/bernardmcweeney/cureation/Outside setlist/Untitled/CureationSetlists/draft post bots/the_cure_setlists.json"

    with open(json_path) as f:
        text = f.read()

    # Use json.JSONDecoder.raw_decode to parse objects one at a time
    # This handles truncated files gracefully
    decoder = json.JSONDecoder()
    data = []

    # Skip the opening '['
    idx = text.index("[") + 1

    while idx < len(text):
        # Skip whitespace and commas
        while idx < len(text) and text[idx] in " \t\n\r,":
            idx += 1

        if idx >= len(text) or text[idx] == "]":
            break

        if text[idx] != "{":
            idx += 1
            continue

        try:
            obj, end_idx = decoder.raw_decode(text, idx)
            if "event_date" in obj:
                data.append(obj)
            idx = end_idx
        except json.JSONDecodeError:
            # Hit truncated object at end of file - stop
            break

    print(f"  Loaded {len(data)} setlists from JSON")
    return data


def parse_date(date_str):
    """Convert DD-MM-YYYY to YYYY-MM-DD"""
    parts = date_str.split("-")
    if len(parts) == 3 and len(parts[2]) == 4:
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    return date_str


# ── Step 5: Build song lookup ────────────────────────────────────────────────

def build_song_lookup():
    """Build a map of normalized song title -> song ID from Directus"""
    result = req("GET", "/items/songs?limit=500&fields=id,title")
    lookup = {}
    if result and "data" in result:
        for song in result["data"]:
            key = normalize(song["title"])
            lookup[key] = song["id"]
    print(f"  Song lookup: {len(lookup)} songs in Directus")
    return lookup


# ── Step 6: Bulk import ──────────────────────────────────────────────────────

def import_setlists(raw_setlists, tour_map, song_lookup):
    print(f"\nImporting {len(raw_setlists)} setlists...")

    # Fetch existing setlists to avoid duplicates
    existing_result = req("GET", "/items/setlists?limit=1000&fields=id,date,venue,city")
    existing_keys = set()
    if existing_result and "data" in existing_result:
        for s in existing_result["data"]:
            key = f"{s.get('date')}|{normalize(s.get('venue',''))}|{normalize(s.get('city',''))}"
            existing_keys.add(key)
    print(f"  Existing setlists: {len(existing_keys)}")

    created = 0
    skipped = 0
    errors = 0

    for i, raw in enumerate(raw_setlists):
        date_raw = raw.get("event_date", "")
        if not date_raw:
            skipped += 1
            continue

        iso_date = parse_date(date_raw)
        venue = raw.get("venue", "Unknown Venue")
        city = raw.get("city", "Unknown City")
        country = raw.get("country", "")

        # Dedup check
        dedup_key = f"{iso_date}|{normalize(venue)}|{normalize(city)}"
        if dedup_key in existing_keys:
            skipped += 1
            continue

        # Gather songs from sets
        all_songs = []
        for setdata in raw.get("sets", []):
            set_num = int(setdata.get("set_number", 0))
            set_type = "main" if set_num == 0 else f"encore" if set_num == 1 else f"encore2"
            for pos, song in enumerate(setdata.get("songs", []), 1):
                all_songs.append({
                    "name": song.get("name", ""),
                    "info": song.get("info", ""),
                    "set_type": set_type,
                    "position": len(all_songs) + 1,
                })

        # Generate slug
        slug = generate_slug(f"{venue} {city} {iso_date}")

        # Try to match tour
        tour_id = None
        tour_name_raw = raw.get("tour_name") or raw.get("tour") or ""
        if tour_name_raw:
            tour_id = tour_map.get(normalize(tour_name_raw))

        setlist_payload = {
            "date": iso_date,
            "venue": venue,
            "city": city,
            "country": country,
            "slug": slug,
            "song_count": len(all_songs),
            "source": "setlist.fm",
            "notes": "",
        }
        if tour_name_raw:
            setlist_payload["tour_name"] = tour_name_raw
        if tour_id:
            setlist_payload["tour"] = tour_id

        result = req("POST", "/items/setlists", setlist_payload)
        if not result or "data" not in result:
            errors += 1
            continue

        setlist_id = result["data"]["id"]
        existing_keys.add(dedup_key)
        created += 1

        # Create setlist_songs
        if all_songs:
            songs_batch = []
            for song_entry in all_songs:
                song_name = song_entry["name"]
                song_id = song_lookup.get(normalize(song_name))

                songs_batch.append({
                    "setlist": setlist_id,
                    "song": song_id,
                    "song_title": song_name,
                    "position": song_entry["position"],
                    "set_type": song_entry["set_type"],
                    "notes": song_entry["info"] or None,
                })

            # Batch create (Directus supports array POST)
            if songs_batch:
                batch_result = req("POST", "/items/setlist_songs", songs_batch)
                if not batch_result:
                    # Fallback to individual creates
                    for sb in songs_batch:
                        req("POST", "/items/setlist_songs", sb)
                        time.sleep(0.01)

        # Progress logging
        if (i + 1) % 50 == 0:
            print(f"  Progress: {i + 1}/{len(raw_setlists)} (created: {created}, skipped: {skipped})")

        # Small delay to not overwhelm the API
        time.sleep(0.03)

    print(f"\n  DONE: created={created}, skipped={skipped}, errors={errors}")
    return created


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=== Phase 2: Setlist Import ===\n")

    print("Step 1: Create tours collection")
    create_tours_collection()

    print("\nStep 2: Expand setlist fields")
    expand_setlist_fields()

    print("\nStep 3: Populate tours")
    tour_map = populate_tours()
    print(f"  Tour map: {len(tour_map)} tours")

    print("\nStep 4: Load setlist JSON")
    raw_setlists = load_setlists_json()

    print("\nStep 5: Build song lookup")
    song_lookup = build_song_lookup()

    print("\nStep 6: Import setlists")
    created = import_setlists(raw_setlists, tour_map, song_lookup)

    # Verification
    print("\n=== Verification ===")
    setlist_count = req("GET", "/items/setlists?limit=1&meta=total_count&fields=id")
    if setlist_count and "meta" in setlist_count:
        print(f"Total setlists in Directus: {setlist_count['meta'].get('total_count', '?')}")

    songs_count = req("GET", "/items/setlist_songs?limit=1&meta=total_count&fields=id")
    if songs_count and "meta" in songs_count:
        print(f"Total setlist_songs in Directus: {songs_count['meta'].get('total_count', '?')}")

    tours_count = req("GET", "/items/tours?limit=1&meta=total_count&fields=id")
    if tours_count and "meta" in tours_count:
        print(f"Total tours in Directus: {tours_count['meta'].get('total_count', '?')}")

    print("\nDone!")


if __name__ == "__main__":
    main()
