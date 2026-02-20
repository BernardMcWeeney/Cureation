#!/usr/bin/env python3
"""
Directus migration for line-by-line lyrics model.

What this script does:
1) Ensures songs.lyrics_structured (JSON) exists
2) Ensures lyric_meanings collection + fields exist
3) Ensures lyric_meanings.song is related to songs
4) Backfills songs.lyrics_structured from songs.lyrics text

Usage:
  DIRECTUS_TOKEN=... python3 scripts/migrate_lyrics_line_model.py
  DIRECTUS_TOKEN=... python3 scripts/migrate_lyrics_line_model.py --force-rebuild
"""

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


BASE = os.environ.get("DIRECTUS_URL", "https://dash.cureation.net").rstrip("/")
TOKEN = os.environ.get("DIRECTUS_TOKEN", "").strip()
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}


def req(method: str, path: str, body: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    url = f"{BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="replace")
        print(f"  ERROR {method} {path} -> {e.code}: {msg[:260]}")
        return None
    except Exception as e:
        print(f"  ERROR {method} {path} -> {e}")
        return None


def normalize_newlines(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def parse_structured_lyrics(lyrics: str) -> List[Dict[str, Any]]:
    text = normalize_newlines(lyrics)
    if not text:
        return []

    blocks = [b.strip() for b in re.split(r"\n{2,}", text) if b.strip()]
    sections: List[Dict[str, Any]] = []
    section_order = 1
    line_no = 1

    for block in blocks:
        raw_lines = [ln.strip() for ln in block.split("\n") if ln.strip()]
        if not raw_lines:
            continue

        label = None
        first_line = raw_lines[0]
        m = re.match(r"^\[(.*?)\]$", first_line)
        if m:
            label = m.group(1).strip()
            raw_lines = raw_lines[1:]

        section = {
            "section_id": f"section-{section_order}",
            "label": label or None,
            "order": section_order,
            "lines": [],
        }

        for ln in raw_lines:
            section["lines"].append(
                {
                    "line_id": f"line-{line_no}",
                    "line_no": line_no,
                    "text": ln,
                }
            )
            line_no += 1

        # Keep header-only sections (e.g. Instrumental Intro).
        if label or section["lines"]:
            sections.append(section)
            section_order += 1

    return sections


def ensure_songs_lyrics_structured_field() -> bool:
    print("Checking songs fields...")
    desired_meta = {
        "interface": "input-code",
        "width": "full",
        "sort": 14,
        "hidden": False,
        "readonly": False,
        "required": False,
        "note": "Structured lyrics by section and line",
    }
    fields = req("GET", "/fields/songs")
    if not fields or "data" not in fields:
        # Fallback for restricted field metadata permissions:
        # probe if the field is queryable from items endpoint.
        probe = req("GET", "/items/songs?limit=1&fields=lyrics_structured")
        if probe and "data" in probe:
            print("  ✓ songs.lyrics_structured is queryable")
            return True
        return False

    existing = {f.get("field") for f in fields["data"]}
    if "lyrics_structured" in existing:
        req("PATCH", "/fields/songs/lyrics_structured", {"meta": desired_meta})
        print("  ✓ songs.lyrics_structured already exists")
        return True

    print("Creating songs.lyrics_structured...")
    payload = {
        "field": "lyrics_structured",
        "type": "json",
        "meta": desired_meta,
    }
    created = req("POST", "/fields/songs", payload)
    ok = bool(created and created.get("data"))
    if ok:
        print("  ✓ Created songs.lyrics_structured")
        return True

    # Field may already exist even if metadata list is restricted.
    probe = req("GET", "/items/songs?limit=1&fields=lyrics_structured")
    if probe and "data" in probe:
        print("  ✓ songs.lyrics_structured already exists")
        return True

    return False


def ensure_field(
    collection: str,
    field_name: str,
    field_type: str,
    meta: Optional[Dict[str, Any]] = None,
    schema: Optional[Dict[str, Any]] = None,
) -> bool:
    check = req("GET", f"/fields/{collection}/{field_name}")
    if check and check.get("data"):
        patch_payload: Dict[str, Any] = {}
        if meta is not None:
            patch_payload["meta"] = meta
        if schema is not None:
            patch_payload["schema"] = schema
        if patch_payload:
            req("PATCH", f"/fields/{collection}/{field_name}", patch_payload)
        return True

    payload: Dict[str, Any] = {"field": field_name, "type": field_type}
    if meta is not None:
        payload["meta"] = meta
    if schema is not None:
        payload["schema"] = schema

    created = req("POST", f"/fields/{collection}", payload)
    if created and created.get("data"):
        print(f"  ✓ Added {collection}.{field_name}")
        return True

    # Field metadata may be hidden by permissions. Probe item queryability.
    probe = req("GET", f"/items/{collection}?limit=1&fields={field_name}")
    if probe and "data" in probe:
        print(f"  ✓ {collection}.{field_name} is queryable")
        return True

    return False


def ensure_lyric_meanings_collection() -> bool:
    print("Checking lyric_meanings collection...")
    existing = req("GET", "/collections/lyric_meanings")
    if existing and existing.get("data"):
        print("  ✓ lyric_meanings collection already exists")
        return True

    # Fallback probe when collection metadata is permission-restricted.
    probe = req("GET", "/items/lyric_meanings?limit=1")
    if probe and "data" in probe:
        print("  ✓ lyric_meanings collection is queryable")
        return True

    print("Creating lyric_meanings collection...")
    payload = {
        "collection": "lyric_meanings",
        "meta": {
            "icon": "format_quote",
            "note": "Line-by-line lyric annotations",
        },
        "schema": {"name": "lyric_meanings"},
        "fields": [
            {
                "field": "id",
                "type": "integer",
                "meta": {"hidden": True, "readonly": True, "interface": "input"},
                "schema": {"is_primary_key": True, "has_auto_increment": True},
            },
            {
                "field": "song",
                "type": "integer",
                "meta": {
                    "interface": "select-dropdown-m2o",
                    "required": True,
                    "note": "Related song in songs collection",
                },
            },
            {
                "field": "section_id",
                "type": "string",
                "meta": {"interface": "input", "note": "Optional section id from lyrics_structured"},
            },
            {
                "field": "section_label",
                "type": "string",
                "meta": {"interface": "input", "note": "Optional section label (Verse, Chorus, etc.)"},
            },
            {
                "field": "line_id",
                "type": "string",
                "meta": {"interface": "input", "required": False, "note": "line-{n} id from lyrics_structured"},
            },
            {
                "field": "line_no",
                "type": "integer",
                "meta": {"interface": "input", "note": "Preferred mapping key for editors"},
            },
            {
                "field": "line",
                "type": "text",
                "meta": {"interface": "input-multiline", "note": "Optional fallback matcher when id/no is missing"},
            },
            {
                "field": "meaning",
                "type": "text",
                "meta": {"interface": "input-multiline", "required": True},
            },
            {
                "field": "contributor",
                "type": "string",
                "meta": {"interface": "input"},
            },
            {
                "field": "status",
                "type": "string",
                "meta": {
                    "interface": "select-dropdown",
                    "options": {
                        "choices": [
                            {"text": "Published", "value": "published"},
                            {"text": "Draft", "value": "draft"},
                        ]
                    },
                },
                "schema": {"default_value": "published"},
            },
            {
                "field": "source",
                "type": "string",
                "meta": {"interface": "input"},
            },
        ],
    }
    created = req("POST", "/collections", payload)
    ok = bool(created and (created.get("data") or created.get("_already_exists")))
    if ok:
        print("  ✓ Created lyric_meanings collection")
        return True

    # Final probe in case create returned non-fatal permission/visibility behavior.
    probe = req("GET", "/items/lyric_meanings?limit=1")
    if probe and "data" in probe:
        print("  ✓ lyric_meanings collection already exists")
        return True

    return False


def ensure_lyric_meanings_fields() -> bool:
    print("Checking lyric_meanings fields...")
    specs = [
        (
            "song",
            "integer",
            {
                "interface": "select-dropdown-m2o",
                "required": True,
                "note": "Related song in songs collection",
            },
            None,
        ),
        (
            "section_id",
            "string",
            {"interface": "input", "note": "Optional section id from lyrics_structured"},
            None,
        ),
        (
            "section_label",
            "string",
            {"interface": "input", "note": "Optional section label (Verse, Chorus, etc.)"},
            None,
        ),
        (
            "line_id",
            "string",
            {"interface": "input", "required": False, "note": "line-{n} id from lyrics_structured"},
            None,
        ),
        (
            "line_no",
            "integer",
            {"interface": "input", "note": "Preferred mapping key for editors"},
            None,
        ),
        (
            "line",
            "text",
            {"interface": "input-multiline", "note": "Optional fallback matcher when id/no is missing"},
            None,
        ),
        (
            "meaning",
            "text",
            {"interface": "input-multiline", "required": True},
            None,
        ),
        ("contributor", "string", {"interface": "input"}, None),
        (
            "status",
            "string",
            {
                "interface": "select-dropdown",
                "options": {
                    "choices": [
                        {"text": "Published", "value": "published"},
                        {"text": "Draft", "value": "draft"},
                    ]
                },
            },
            {"default_value": "published"},
        ),
        ("source", "string", {"interface": "input"}, None),
    ]

    ok = True
    for field_name, field_type, meta, schema in specs:
        if not ensure_field("lyric_meanings", field_name, field_type, meta=meta, schema=schema):
            ok = False
    if ok:
        print("  ✓ lyric_meanings fields are ready")
    return ok


def ensure_lyric_meanings_song_relation() -> bool:
    print("Checking lyric_meanings.song relation...")
    existing = req("GET", "/relations/lyric_meanings/song")
    if existing and existing.get("data"):
        print("  ✓ lyric_meanings.song relation already exists")
        return True

    payload = {
        "collection": "lyric_meanings",
        "field": "song",
        "related_collection": "songs",
        "meta": {"one_field": None},
        "schema": {"on_delete": "CASCADE"},
    }
    created = req("POST", "/relations", payload)
    if created and created.get("data"):
        print("  ✓ Created lyric_meanings.song relation")
        return True

    # Probe again in case create returned a non-fatal "already exists" error.
    probe = req("GET", "/relations/lyric_meanings/song")
    if probe and probe.get("data"):
        print("  ✓ lyric_meanings.song relation exists")
        return True

    return False


def backfill_lyrics_structured(force_rebuild: bool) -> Tuple[int, int, int]:
    print("Backfilling songs.lyrics_structured...")
    result = req("GET", "/items/songs?limit=-1&fields=id,title,lyrics,lyrics_structured")
    if not result or "data" not in result:
        return (0, 0, 0)

    songs = result["data"]
    updated = 0
    skipped = 0
    failed = 0

    for song in songs:
        song_id = song.get("id")
        lyrics = song.get("lyrics")
        existing = song.get("lyrics_structured")

        if not lyrics or not str(lyrics).strip():
            skipped += 1
            continue

        if (
            not force_rebuild
            and isinstance(existing, list)
            and len(existing) > 0
        ):
            skipped += 1
            continue

        structured = parse_structured_lyrics(str(lyrics))
        if not structured:
            skipped += 1
            continue

        patched = req("PATCH", f"/items/songs/{song_id}", {"lyrics_structured": structured})
        if patched and patched.get("data"):
            updated += 1
            if updated % 25 == 0:
                print(f"  Updated {updated} songs...")
            time.sleep(0.02)
        else:
            failed += 1

    print(f"  ✓ Updated: {updated}, skipped: {skipped}, failed: {failed}")
    return (updated, skipped, failed)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force-rebuild",
        action="store_true",
        help="Regenerate lyrics_structured for songs that already have it",
    )
    args = parser.parse_args()

    if not TOKEN:
        raise SystemExit("DIRECTUS_TOKEN environment variable is required.")

    print("=== Lyrics Line-Model Migration ===")
    print(f"Base: {BASE}")

    if not ensure_songs_lyrics_structured_field():
        raise SystemExit("Failed to ensure songs.lyrics_structured")

    if not ensure_lyric_meanings_collection():
        raise SystemExit("Failed to ensure lyric_meanings collection")

    if not ensure_lyric_meanings_fields():
        raise SystemExit("Failed to ensure lyric_meanings fields")

    if not ensure_lyric_meanings_song_relation():
        print("  ! Could not confirm lyric_meanings.song relation. Continuing with line model backfill.")

    updated, skipped, failed = backfill_lyrics_structured(force_rebuild=args.force_rebuild)

    print("\n=== Done ===")
    print(f"songs.lyrics_structured updated: {updated}")
    print(f"songs skipped: {skipped}")
    print(f"songs failed: {failed}")


if __name__ == "__main__":
    main()
