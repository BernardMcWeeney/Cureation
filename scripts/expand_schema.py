#!/usr/bin/env python3
"""
Phase 1A: Expand Directus discography schema with new fields and type choices.
Also adds deluxe editions, box sets, and key EPs/singles to discography.
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
        print(f"  ERROR {method} {path}: {exc.code} {detail[:300]}")
        return None


def normalize_title(title):
    return re.sub(r"[^a-z0-9]", "", (title or "").lower())


# ── Step 1: Expand type choices ──────────────────────────────────────────────

def expand_type_choices():
    print("Expanding discography.type choices...")
    payload = {
        "meta": {
            "options": {
                "choices": [
                    {"text": "Studio Album", "value": "studio"},
                    {"text": "Live Album", "value": "live"},
                    {"text": "Compilation", "value": "compilation"},
                    {"text": "EP", "value": "ep"},
                    {"text": "Single", "value": "single"},
                    {"text": "Deluxe Edition", "value": "deluxe"},
                    {"text": "Reissue", "value": "reissue"},
                    {"text": "Box Set", "value": "boxset"},
                    {"text": "Soundtrack", "value": "soundtrack"},
                    {"text": "Remix Album", "value": "remix"},
                ]
            }
        }
    }
    result = req("PATCH", "/fields/discography/type", payload)
    if result and "data" in result:
        print("  OK expanded to 10 types")
    return result


# ── Step 2: Add new fields to discography ────────────────────────────────────

def add_field(collection, field_name, field_type, meta=None, schema=None):
    payload = {
        "field": field_name,
        "type": field_type,
    }
    if meta:
        payload["meta"] = meta
    if schema:
        payload["schema"] = schema

    result = req("POST", f"/fields/{collection}", payload)
    if result and "data" in result:
        print(f"  ADDED {collection}.{field_name}")
        return True
    elif result is None:
        # Might already exist - check
        check = req("GET", f"/fields/{collection}/{field_name}")
        if check and "data" in check:
            print(f"  EXISTS {collection}.{field_name}")
            return True
    return False


def add_new_fields():
    print("\nAdding new fields to discography...")

    fields = [
        ("discography", "parent_album", "integer", {
            "interface": "select-dropdown-m2o",
            "display": "related-values",
            "note": "Links deluxe/reissue to original album"
        }, {}),
        ("discography", "spotify_url", "string", {
            "interface": "input",
            "note": "Spotify album URL"
        }, {}),
        ("discography", "apple_music_url", "string", {
            "interface": "input",
            "note": "Apple Music album URL"
        }, {}),
        ("discography", "disc_count", "integer", {
            "interface": "input",
            "note": "Number of discs"
        }, {"default_value": 1}),
        ("discography", "track_count", "integer", {
            "interface": "input",
            "note": "Total track count"
        }, {}),
        ("discography", "catalog_number", "string", {
            "interface": "input",
            "note": "Catalog number (e.g. FIXCD 14)"
        }, {}),
        ("discography", "genre_tags", "json", {
            "interface": "tags",
            "note": "Genre tags (e.g. post-punk, gothic rock)"
        }, {}),
    ]

    for collection, name, ftype, meta, schema in fields:
        add_field(collection, name, ftype, meta, schema or None)
        time.sleep(0.1)

    # Create M2O relationship for parent_album -> discography
    print("\n  Setting up parent_album M2O relationship...")
    rel_payload = {
        "collection": "discography",
        "field": "parent_album",
        "related_collection": "discography",
        "meta": {"one_field": None},
        "schema": {"on_delete": "SET NULL"},
    }
    result = req("POST", "/relations", rel_payload)
    if result and "data" in result:
        print("  OK parent_album -> discography relationship created")
    else:
        print("  (relationship may already exist)")


# ── Step 3: Add deluxe editions and box sets ─────────────────────────────────

ADDITIONAL_RELEASES = [
    # Deluxe editions
    {
        "title": "Three Imaginary Boys (Deluxe Edition)",
        "type": "deluxe",
        "release_date": "2004-11-29",
        "label": "Fiction/Polydor",
        "producer": "Chris Parry",
        "featured": False,
        "description": "Expanded 2-disc edition with demos, B-sides, and Peel Sessions from the debut era.",
        "parent_title": "Three Imaginary Boys",
    },
    {
        "title": "Seventeen Seconds (Deluxe Edition)",
        "type": "deluxe",
        "release_date": "2005-08-22",
        "label": "Fiction/Polydor",
        "producer": "Mike Hedges and The Cure",
        "featured": False,
        "description": "Expanded 2-disc edition with rarities and live recordings from the Seventeen Seconds era.",
        "parent_title": "Seventeen Seconds",
    },
    {
        "title": "Faith (Deluxe Edition)",
        "type": "deluxe",
        "release_date": "2005-08-22",
        "label": "Fiction/Polydor",
        "producer": "Mike Hedges and The Cure",
        "featured": False,
        "description": "Expanded 2-disc edition including Carnage Visors instrumental soundtrack.",
        "parent_title": "Faith",
    },
    {
        "title": "Pornography (Deluxe Edition)",
        "type": "deluxe",
        "release_date": "2005-08-22",
        "label": "Fiction/Polydor",
        "producer": "Phil Thornalley and The Cure",
        "featured": False,
        "description": "Expanded edition with demos and live material from The Cure's darkest era.",
        "parent_title": "Pornography",
    },
    {
        "title": "The Top (Deluxe Edition)",
        "type": "deluxe",
        "release_date": "2006-06-12",
        "label": "Fiction/Polydor",
        "producer": "David M. Allen and The Cure",
        "featured": False,
        "description": "Expanded edition with Concert live album material and bonus tracks.",
        "parent_title": "The Top",
    },
    {
        "title": "The Head on the Door (Deluxe Edition)",
        "type": "deluxe",
        "release_date": "2006-08-14",
        "label": "Fiction/Polydor",
        "producer": "David M. Allen and The Cure",
        "featured": False,
        "description": "Expanded edition with remixes, B-sides, and live recordings from 1985.",
        "parent_title": "The Head on the Door",
    },
    {
        "title": "Kiss Me, Kiss Me, Kiss Me (Deluxe Edition)",
        "type": "deluxe",
        "release_date": "2006-08-14",
        "label": "Fiction/Polydor",
        "producer": "David M. Allen and The Cure",
        "featured": False,
        "description": "Expanded edition with demos, live tracks, and rarities from the KMKMKM sessions.",
        "parent_title": "Kiss Me, Kiss Me, Kiss Me",
    },
    {
        "title": "Disintegration (Deluxe Edition)",
        "type": "deluxe",
        "release_date": "2010-06-08",
        "label": "Fiction/Polydor",
        "producer": "David M. Allen and Robert Smith",
        "featured": True,
        "description": "3-disc deluxe with rarities, live material, and instrumentals from the Disintegration sessions.",
        "parent_title": "Disintegration",
    },
    {
        "title": "Wish (30th Anniversary Edition)",
        "type": "deluxe",
        "release_date": "2022-10-07",
        "label": "Fiction/Polydor",
        "producer": "David M. Allen and The Cure",
        "featured": False,
        "description": "3-disc 30th anniversary with 21 previously unreleased demos and live tracks.",
        "parent_title": "Wish",
    },
    # Box sets
    {
        "title": "Join the Dots: B-Sides & Rarities 1978-2001",
        "type": "boxset",
        "release_date": "2004-01-26",
        "label": "Fiction/Polydor",
        "producer": "The Cure",
        "featured": False,
        "description": "4-disc box set collecting B-sides, rarities, and unreleased tracks spanning 23 years.",
        "disc_count": 4,
    },
    {
        "title": "Entreat Plus",
        "type": "live",
        "release_date": "2010-09-13",
        "label": "Fiction/Polydor",
        "producer": "The Cure",
        "featured": False,
        "description": "Expanded version of Entreat with additional Disintegration-era live tracks from Wembley 1989.",
        "parent_title": "Entreat",
    },
    # Key EPs
    {
        "title": "Charlotte Sometimes",
        "type": "ep",
        "release_date": "1981-10-09",
        "label": "Fiction Records",
        "producer": "The Cure",
        "featured": False,
        "description": "Non-album single and EP featuring 'Charlotte Sometimes', 'Splintered in Her Head'.",
    },
    {
        "title": "The Walk",
        "type": "ep",
        "release_date": "1983-07-01",
        "label": "Fiction Records",
        "producer": "The Cure",
        "featured": False,
        "description": "Single/EP from the post-Pornography pop transition including 'The Dream' and 'The Upstairs Room'.",
    },
    {
        "title": "Hypnagogic States",
        "type": "ep",
        "release_date": "2008-09-13",
        "label": "Geffen",
        "producer": "The Cure",
        "featured": False,
        "description": "4-track EP released ahead of 4:13 Dream, featuring alternate mixes and exclusive tracks.",
    },
]


def add_releases():
    print("\nAdding deluxe editions, box sets, and EPs...")

    # Fetch current discography
    result = req("GET", "/items/discography?limit=300&fields=id,title")
    if not result or "data" not in result:
        print("  ERROR: could not fetch discography")
        return

    existing = {normalize_title(a["title"]): a for a in result["data"]}

    for release in ADDITIONAL_RELEASES:
        key = normalize_title(release["title"])
        if key in existing:
            print(f"  EXISTS: {release['title']}")
            continue

        payload = {k: v for k, v in release.items() if k != "parent_title"}

        # Resolve parent_album reference
        parent_title = release.get("parent_title")
        if parent_title:
            parent_key = normalize_title(parent_title)
            parent = existing.get(parent_key)
            if parent:
                payload["parent_album"] = parent["id"]
                print(f"  Linked to parent: {parent_title} (#{parent['id']})")

        result = req("POST", "/items/discography", payload)
        if result and "data" in result:
            item = result["data"]
            existing[key] = item
            print(f"  CREATED #{item['id']}: {release['title']}")
        time.sleep(0.1)


# ── Step 4: Update track counts on existing albums ──────────────────────────

def update_track_counts():
    print("\nUpdating track counts...")
    # Fetch songs grouped by album
    result = req("GET", "/items/songs?limit=500&fields=album&groupBy[]=album&aggregate[count]=id")
    if not result or "data" not in result:
        # Fallback: count manually
        songs_result = req("GET", "/items/songs?limit=500&fields=id,album")
        if not songs_result or "data" not in songs_result:
            print("  Could not fetch songs")
            return
        counts = {}
        for s in songs_result["data"]:
            album_id = s.get("album")
            if album_id:
                counts[album_id] = counts.get(album_id, 0) + 1
        for album_id, count in counts.items():
            req("PATCH", f"/items/discography/{album_id}", {"track_count": count})
        print(f"  Updated {len(counts)} albums with track counts")
        return

    for row in result["data"]:
        album_id = row.get("album")
        count = row.get("count", {}).get("id", 0)
        if album_id and count:
            req("PATCH", f"/items/discography/{album_id}", {"track_count": count})
    print("  Done")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=== Phase 1A: Expand Discography Schema ===\n")

    expand_type_choices()
    add_new_fields()
    add_releases()
    update_track_counts()

    # Final verification
    print("\n=== Verification ===")
    result = req("GET", "/items/discography?limit=300&fields=id,title,type&sort=release_date")
    if result and "data" in result:
        by_type = {}
        for a in result["data"]:
            t = a.get("type") or "(none)"
            by_type[t] = by_type.get(t, 0) + 1
        print(f"Total releases: {len(result['data'])}")
        for t in sorted(by_type.keys()):
            print(f"  {t}: {by_type[t]}")
    print("\nDone!")


if __name__ == "__main__":
    main()
