#!/usr/bin/env python3
"""
Cureation Database Redesign & Migration Script
===============================================
Transforms the Directus database from a flat, disconnected schema
into a properly relational database with full source attribution.

WHAT THIS DOES:
1. Creates new collections (sources, videos, polls, did_you_know, album_personnel)
2. Adds source attribution fields to existing collections
3. Fixes broken relationships (setlists→tours, setlist_songs→songs, etc.)
4. Adds missing fields (slugs, era, purchase links, etc.)

SAFE: This script only ADDS fields/collections. It does NOT delete or modify existing data.
Run with --dry-run to preview changes.
"""

import urllib.request
import urllib.error
import sys
import json
import time

# ─── Configuration ───────────────────────────────────────────────────────────

DIRECTUS_URL = "https://dash.cureation.net"
TOKEN = "dW1LA2KLXEBOYdHhofxBHcNZfgOUdsll"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

DRY_RUN = "--dry-run" in sys.argv
VERBOSE = "--verbose" in sys.argv or "-v" in sys.argv

# ─── Helpers ─────────────────────────────────────────────────────────────────

def log(msg, indent=0):
    prefix = "  " * indent
    print(f"{prefix}{msg}")

def api(method, path, data=None):
    """Make a Directus API call. Returns response JSON or None."""
    url = f"{DIRECTUS_URL}{path}"
    if DRY_RUN:
        log(f"  [DRY RUN] {method} {path}")
        if data and VERBOSE:
            log(f"    Payload: {json.dumps(data, indent=2)[:500]}")
        return {"data": {}}

    try:
        body = json.dumps(data).encode("utf-8") if data else None
        req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_body = resp.read().decode("utf-8")
            if resp_body:
                return json.loads(resp_body)
            return {"data": {}}
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")[:300]
        log(f"  ⚠ {method} {path} → {e.code}: {error_msg}")
        return None
    except Exception as e:
        log(f"  ✗ {method} {path} → Error: {e}")
        return None

def get_existing_collections():
    """Get list of existing collection names."""
    result = api("GET", "/collections")
    if result and "data" in result:
        return [c["collection"] for c in result["data"]]
    return []

def get_existing_fields(collection):
    """Get list of existing field names for a collection."""
    result = api("GET", f"/fields/{collection}")
    if result and "data" in result:
        return [f["field"] for f in result["data"]]
    return []

def get_existing_relations():
    """Get list of existing relations."""
    result = api("GET", "/relations")
    if result and "data" in result:
        return result["data"]
    return []

def collection_exists(name, existing):
    return name in existing

def field_exists(collection, field, existing_fields):
    return field in existing_fields

def create_collection(name, meta, fields):
    """Create a new collection with fields and a real database table."""
    log(f"  Creating collection: {name}")
    payload = {
        "collection": name,
        "schema": {},  # CRITICAL: tells Directus to create an actual DB table
        "meta": meta,
        "fields": fields,
    }
    return api("POST", "/collections", payload)

def add_field(collection, field_schema):
    """Add a field to an existing collection."""
    field_name = field_schema.get("field", "unknown")
    log(f"  Adding field: {collection}.{field_name}")
    return api("POST", f"/fields/{collection}", field_schema)

def create_relation(relation):
    """Create a relation between collections."""
    log(f"  Creating relation: {relation['collection']}.{relation['field']} → {relation['related_collection']}")
    return api("POST", "/relations", relation)


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 1: NEW COLLECTIONS
# ═════════════════════════════════════════════════════════════════════════════

def phase_1_new_collections(existing_collections):
    """Create brand new collections for features we don't have yet."""
    log("\n══════════════════════════════════════════════════════════")
    log("PHASE 1: Creating New Collections")
    log("══════════════════════════════════════════════════════════")

    # ─── 1a. SOURCES ─────────────────────────────────────────────────────
    # Central registry of where data comes from.
    # Every piece of content can optionally link to a source.
    if not collection_exists("sources", existing_collections):
        create_collection("sources", {
            "collection": "sources",
            "icon": "menu_book",
            "note": "Source attribution & citations for all content",
            "hidden": False,
            "singleton": False,
        }, [
            # Auto ID
            {"field": "id", "type": "integer", "meta": {"hidden": True, "interface": "input", "readonly": True, "special": ["no-duplicate"]}, "schema": {"is_primary_key": True, "has_auto_increment": True}},
            # Name of the source (e.g. "setlist.fm", "Wikipedia", "NME Magazine")
            {"field": "name", "type": "string", "meta": {"interface": "input", "width": "half", "required": True, "note": "Source name (e.g. 'setlist.fm', 'NME', 'Official website')"}, "schema": {"max_length": 255}},
            # Type of source
            {"field": "type", "type": "string", "meta": {"interface": "select-dropdown", "width": "half", "options": {"choices": [
                {"text": "Website", "value": "website"},
                {"text": "Book", "value": "book"},
                {"text": "Magazine", "value": "magazine"},
                {"text": "Interview", "value": "interview"},
                {"text": "Documentary", "value": "documentary"},
                {"text": "Official", "value": "official"},
                {"text": "Fan Community", "value": "fan"},
                {"text": "Archive", "value": "archive"},
                {"text": "API", "value": "api"},
                {"text": "Other", "value": "other"},
            ]}}, "schema": {"max_length": 50}},
            # URL
            {"field": "url", "type": "text", "meta": {"interface": "input", "note": "URL to the source (if applicable)"}, "schema": {}},
            # Author/creator
            {"field": "author", "type": "string", "meta": {"interface": "input", "width": "half", "note": "Author or creator of the source"}, "schema": {"max_length": 255}},
            # Description
            {"field": "description", "type": "text", "meta": {"interface": "input-multiline", "note": "Brief description of this source"}, "schema": {}},
            # Logo/icon
            {"field": "logo", "type": "uuid", "meta": {"interface": "file-image", "width": "half", "note": "Logo or icon for this source"}, "schema": {}},
            # Is this an official Cure source?
            {"field": "is_official", "type": "boolean", "meta": {"interface": "boolean", "width": "half", "note": "Is this an official source (band, label, etc.)?"}, "schema": {"default_value": False}},
            # Reliability rating (1-5)
            {"field": "reliability", "type": "integer", "meta": {"interface": "select-dropdown", "width": "half", "note": "How reliable is this source? (1=unverified, 5=official)", "options": {"choices": [
                {"text": "★ Unverified", "value": 1},
                {"text": "★★ Fan-sourced", "value": 2},
                {"text": "★★★ Reputable", "value": 3},
                {"text": "★★★★ Highly reliable", "value": 4},
                {"text": "★★★★★ Official/Primary", "value": 5},
            ]}}, "schema": {"default_value": 3}},
        ])
        log("  ✓ Created 'sources' collection", 1)
    else:
        log("  ○ 'sources' already exists, skipping", 1)

    # ─── 1b. VIDEOS ──────────────────────────────────────────────────────
    if not collection_exists("videos", existing_collections):
        create_collection("videos", {
            "collection": "videos",
            "icon": "videocam",
            "note": "Music videos, live performances, interviews, documentaries",
            "hidden": False,
            "singleton": False,
        }, [
            {"field": "id", "type": "integer", "meta": {"hidden": True, "interface": "input", "readonly": True, "special": ["no-duplicate"]}, "schema": {"is_primary_key": True, "has_auto_increment": True}},
            {"field": "title", "type": "string", "meta": {"interface": "input", "required": True, "note": "Video title"}, "schema": {"max_length": 255}},
            {"field": "slug", "type": "string", "meta": {"interface": "input", "note": "URL-friendly slug"}, "schema": {"max_length": 255}},
            {"field": "video_url", "type": "text", "meta": {"interface": "input", "required": True, "note": "YouTube/Vimeo URL"}, "schema": {}},
            {"field": "embed_id", "type": "string", "meta": {"interface": "input", "note": "YouTube video ID for embedding"}, "schema": {"max_length": 50}},
            {"field": "thumbnail", "type": "uuid", "meta": {"interface": "file-image", "note": "Video thumbnail"}, "schema": {}},
            {"field": "type", "type": "string", "meta": {"interface": "select-dropdown", "width": "half", "options": {"choices": [
                {"text": "Music Video", "value": "music_video"},
                {"text": "Live Performance", "value": "live"},
                {"text": "Interview", "value": "interview"},
                {"text": "Documentary", "value": "documentary"},
                {"text": "TV Appearance", "value": "tv"},
                {"text": "Fan Video", "value": "fan"},
                {"text": "Behind the Scenes", "value": "bts"},
                {"text": "Lyric Video", "value": "lyric_video"},
                {"text": "Other", "value": "other"},
            ]}}, "schema": {"max_length": 50}},
            {"field": "description", "type": "text", "meta": {"interface": "input-multiline", "note": "Video description"}, "schema": {}},
            {"field": "date", "type": "date", "meta": {"interface": "datetime", "width": "half", "note": "Date of video/performance"}, "schema": {}},
            {"field": "duration", "type": "string", "meta": {"interface": "input", "width": "half", "note": "Video duration (e.g. '4:23')"}, "schema": {"max_length": 20}},
            {"field": "song", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Related song (if applicable)"}, "schema": {}},
            {"field": "album", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Related album"}, "schema": {}},
            {"field": "setlist", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Related concert/setlist"}, "schema": {}},
            {"field": "director", "type": "string", "meta": {"interface": "input", "width": "half", "note": "Director (for music videos)"}, "schema": {"max_length": 255}},
            {"field": "is_featured", "type": "boolean", "meta": {"interface": "boolean", "width": "half"}, "schema": {"default_value": False}},
            {"field": "view_count", "type": "integer", "meta": {"interface": "input", "width": "half", "note": "YouTube view count (for display)"}, "schema": {}},
            {"field": "source", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Where this video is from"}, "schema": {}},
            {"field": "source_url", "type": "text", "meta": {"interface": "input", "note": "Direct source URL"}, "schema": {}},
        ])
        log("  ✓ Created 'videos' collection", 1)
    else:
        log("  ○ 'videos' already exists, skipping", 1)

    # ─── 1c. POLLS ───────────────────────────────────────────────────────
    if not collection_exists("polls", existing_collections):
        create_collection("polls", {
            "collection": "polls",
            "icon": "poll",
            "note": "Fan polls and surveys",
            "hidden": False,
            "singleton": False,
        }, [
            {"field": "id", "type": "integer", "meta": {"hidden": True, "interface": "input", "readonly": True, "special": ["no-duplicate"]}, "schema": {"is_primary_key": True, "has_auto_increment": True}},
            {"field": "question", "type": "string", "meta": {"interface": "input", "required": True, "note": "Poll question"}, "schema": {"max_length": 500}},
            {"field": "slug", "type": "string", "meta": {"interface": "input"}, "schema": {"max_length": 255}},
            {"field": "description", "type": "text", "meta": {"interface": "input-multiline"}, "schema": {}},
            {"field": "type", "type": "string", "meta": {"interface": "select-dropdown", "width": "half", "options": {"choices": [
                {"text": "Single Choice", "value": "single"},
                {"text": "Multiple Choice", "value": "multiple"},
                {"text": "Ranking", "value": "ranking"},
            ]}}, "schema": {"max_length": 20, "default_value": "single"}},
            {"field": "status", "type": "string", "meta": {"interface": "select-dropdown", "width": "half", "options": {"choices": [
                {"text": "Draft", "value": "draft"},
                {"text": "Active", "value": "active"},
                {"text": "Closed", "value": "closed"},
                {"text": "Featured", "value": "featured"},
            ]}}, "schema": {"max_length": 20, "default_value": "draft"}},
            {"field": "start_date", "type": "date", "meta": {"interface": "datetime", "width": "half"}, "schema": {}},
            {"field": "end_date", "type": "date", "meta": {"interface": "datetime", "width": "half"}, "schema": {}},
            {"field": "total_votes", "type": "integer", "meta": {"interface": "input", "width": "half", "readonly": True}, "schema": {"default_value": 0}},
            {"field": "category", "type": "string", "meta": {"interface": "select-dropdown", "width": "half", "options": {"choices": [
                {"text": "Albums", "value": "albums"},
                {"text": "Songs", "value": "songs"},
                {"text": "Tours", "value": "tours"},
                {"text": "Members", "value": "members"},
                {"text": "General", "value": "general"},
                {"text": "This or That", "value": "versus"},
            ]}}, "schema": {"max_length": 30}},
        ])
        log("  ✓ Created 'polls' collection", 1)
    else:
        log("  ○ 'polls' already exists, skipping", 1)

    # ─── 1d. POLL OPTIONS ────────────────────────────────────────────────
    if not collection_exists("poll_options", existing_collections):
        create_collection("poll_options", {
            "collection": "poll_options",
            "icon": "radio_button_checked",
            "note": "Options/choices for polls",
            "hidden": False,
            "singleton": False,
        }, [
            {"field": "id", "type": "integer", "meta": {"hidden": True, "interface": "input", "readonly": True, "special": ["no-duplicate"]}, "schema": {"is_primary_key": True, "has_auto_increment": True}},
            {"field": "poll", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "required": True}, "schema": {}},
            {"field": "label", "type": "string", "meta": {"interface": "input", "required": True}, "schema": {"max_length": 255}},
            {"field": "image", "type": "uuid", "meta": {"interface": "file-image"}, "schema": {}},
            {"field": "vote_count", "type": "integer", "meta": {"interface": "input", "readonly": True}, "schema": {"default_value": 0}},
            {"field": "sort_order", "type": "integer", "meta": {"interface": "input", "width": "half"}, "schema": {"default_value": 0}},
        ])
        log("  ✓ Created 'poll_options' collection", 1)
    else:
        log("  ○ 'poll_options' already exists, skipping", 1)

    # ─── 1e. DID YOU KNOW ────────────────────────────────────────────────
    if not collection_exists("did_you_know", existing_collections):
        create_collection("did_you_know", {
            "collection": "did_you_know",
            "icon": "lightbulb",
            "note": "Fun facts and trivia about The Cure",
            "hidden": False,
            "singleton": False,
        }, [
            {"field": "id", "type": "integer", "meta": {"hidden": True, "interface": "input", "readonly": True, "special": ["no-duplicate"]}, "schema": {"is_primary_key": True, "has_auto_increment": True}},
            {"field": "fact", "type": "text", "meta": {"interface": "input-multiline", "required": True, "note": "The fun fact text"}, "schema": {}},
            {"field": "category", "type": "string", "meta": {"interface": "select-dropdown", "width": "half", "options": {"choices": [
                {"text": "Recording", "value": "recording"},
                {"text": "Live", "value": "live"},
                {"text": "Members", "value": "members"},
                {"text": "Albums", "value": "albums"},
                {"text": "Songs", "value": "songs"},
                {"text": "History", "value": "history"},
                {"text": "Pop Culture", "value": "pop_culture"},
                {"text": "Equipment", "value": "equipment"},
            ]}}, "schema": {"max_length": 30}},
            {"field": "related_album", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half"}, "schema": {}},
            {"field": "related_song", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half"}, "schema": {}},
            {"field": "related_member", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half"}, "schema": {}},
            {"field": "source", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Where this fact comes from"}, "schema": {}},
            {"field": "source_detail", "type": "string", "meta": {"interface": "input", "note": "Specific page, timestamp, or reference"}, "schema": {"max_length": 500}},
            {"field": "is_verified", "type": "boolean", "meta": {"interface": "boolean", "width": "half"}, "schema": {"default_value": False}},
            {"field": "is_featured", "type": "boolean", "meta": {"interface": "boolean", "width": "half"}, "schema": {"default_value": False}},
        ])
        log("  ✓ Created 'did_you_know' collection", 1)
    else:
        log("  ○ 'did_you_know' already exists, skipping", 1)

    # ─── 1f. ALBUM PERSONNEL (Junction: who played on what album) ────────
    if not collection_exists("album_personnel", existing_collections):
        create_collection("album_personnel", {
            "collection": "album_personnel",
            "icon": "groups",
            "note": "Which members/musicians played on each album",
            "hidden": False,
            "singleton": False,
        }, [
            {"field": "id", "type": "integer", "meta": {"hidden": True, "interface": "input", "readonly": True, "special": ["no-duplicate"]}, "schema": {"is_primary_key": True, "has_auto_increment": True}},
            {"field": "album", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "required": True}, "schema": {}},
            {"field": "member", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half"}, "schema": {}},
            {"field": "musician_name", "type": "string", "meta": {"interface": "input", "width": "half", "note": "For non-band-member musicians (session players, etc.)"}, "schema": {"max_length": 255}},
            {"field": "role", "type": "string", "meta": {"interface": "input", "note": "Instrument/role (e.g. 'Lead Guitar', 'Keyboards', 'Producer')"}, "schema": {"max_length": 255}},
            {"field": "is_guest", "type": "boolean", "meta": {"interface": "boolean", "width": "half"}, "schema": {"default_value": False}},
        ])
        log("  ✓ Created 'album_personnel' collection", 1)
    else:
        log("  ○ 'album_personnel' already exists, skipping", 1)

    # ─── 1g. SITE STATS (singleton for visitor counting) ─────────────────
    if not collection_exists("site_stats", existing_collections):
        create_collection("site_stats", {
            "collection": "site_stats",
            "icon": "analytics",
            "note": "Site visitor statistics",
            "hidden": False,
            "singleton": True,
        }, [
            {"field": "id", "type": "integer", "meta": {"hidden": True, "interface": "input", "readonly": True, "special": ["no-duplicate"]}, "schema": {"is_primary_key": True, "has_auto_increment": True}},
            {"field": "total_visits", "type": "integer", "meta": {"interface": "input", "width": "half"}, "schema": {"default_value": 0}},
            {"field": "today_visits", "type": "integer", "meta": {"interface": "input", "width": "half"}, "schema": {"default_value": 0}},
            {"field": "today_peak", "type": "integer", "meta": {"interface": "input", "width": "half"}, "schema": {"default_value": 0}},
            {"field": "currently_online", "type": "integer", "meta": {"interface": "input", "width": "half"}, "schema": {"default_value": 0}},
            {"field": "last_reset", "type": "timestamp", "meta": {"interface": "datetime"}, "schema": {}},
        ])
        log("  ✓ Created 'site_stats' collection", 1)
    else:
        log("  ○ 'site_stats' already exists, skipping", 1)


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 2: ADD SOURCE ATTRIBUTION TO EXISTING COLLECTIONS
# ═════════════════════════════════════════════════════════════════════════════

def phase_2_add_attribution(existing_collections):
    """Add source/attribution fields to existing collections."""
    log("\n══════════════════════════════════════════════════════════")
    log("PHASE 2: Adding Source Attribution Fields")
    log("══════════════════════════════════════════════════════════")

    # Collections that should have source attribution
    # Format: (collection, fields_to_add)
    attribution_targets = [
        ("discography", [
            {"field": "source", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Primary data source", "group": None}, "schema": {}},
            {"field": "source_url", "type": "text", "meta": {"interface": "input", "note": "Direct URL to source", "group": None}, "schema": {}},
            {"field": "era", "type": "string", "meta": {"interface": "select-dropdown", "width": "half", "note": "Musical era", "options": {"choices": [
                {"text": "Early (1976-1982)", "value": "early"},
                {"text": "Pop (1983-1986)", "value": "pop"},
                {"text": "Classic (1987-1992)", "value": "classic"},
                {"text": "Experimental (1993-2004)", "value": "experimental"},
                {"text": "Modern (2005+)", "value": "modern"},
            ]}, "group": None}, "schema": {"max_length": 30}},
            {"field": "slug", "type": "string", "meta": {"interface": "input", "note": "URL-friendly slug", "group": None}, "schema": {"max_length": 255}},
            {"field": "bandcamp_url", "type": "string", "meta": {"interface": "input", "width": "half", "group": None}, "schema": {"max_length": 255}},
            {"field": "amazon_url", "type": "string", "meta": {"interface": "input", "width": "half", "note": "Amazon purchase link", "group": None}, "schema": {"max_length": 255}},
            {"field": "official_store_url", "type": "string", "meta": {"interface": "input", "width": "half", "note": "Official store purchase link", "group": None}, "schema": {"max_length": 255}},
        ]),
        ("songs", [
            {"field": "source", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Lyrics/info source", "group": None}, "schema": {}},
            {"field": "source_url", "type": "text", "meta": {"interface": "input", "note": "Direct URL to source", "group": None}, "schema": {}},
            {"field": "slug", "type": "string", "meta": {"interface": "input", "note": "URL-friendly slug", "group": None}, "schema": {"max_length": 255}},
        ]),
        ("members", [
            {"field": "source", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Bio source", "group": None}, "schema": {}},
            {"field": "source_url", "type": "text", "meta": {"interface": "input", "note": "Direct URL to source", "group": None}, "schema": {}},
            {"field": "birth_date", "type": "date", "meta": {"interface": "datetime", "width": "half", "group": None}, "schema": {}},
            {"field": "photo_file", "type": "uuid", "meta": {"interface": "file-image", "note": "Member photo (Directus file)", "group": None}, "schema": {}},
        ]),
        ("photos", [
            {"field": "source", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Photo source/credit", "group": None}, "schema": {}},
            {"field": "source_url", "type": "text", "meta": {"interface": "input", "note": "Original source URL", "group": None}, "schema": {}},
            {"field": "image_file", "type": "uuid", "meta": {"interface": "file-image", "note": "Photo file (Directus asset)", "group": None}, "schema": {}},
            {"field": "license", "type": "string", "meta": {"interface": "select-dropdown", "width": "half", "options": {"choices": [
                {"text": "All Rights Reserved", "value": "arr"},
                {"text": "Creative Commons", "value": "cc"},
                {"text": "Fair Use", "value": "fair_use"},
                {"text": "Public Domain", "value": "public_domain"},
                {"text": "Press/Promo", "value": "press"},
                {"text": "Fan Submitted", "value": "fan"},
            ]}, "group": None}, "schema": {"max_length": 30}},
            {"field": "copyright_holder", "type": "string", "meta": {"interface": "input", "width": "half", "group": None}, "schema": {"max_length": 255}},
            {"field": "album", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Related album", "group": None}, "schema": {}},
        ]),
        ("timeline", [
            {"field": "source", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Event source", "group": None}, "schema": {}},
            {"field": "source_url", "type": "text", "meta": {"interface": "input", "note": "Source URL", "group": None}, "schema": {}},
            # Fix: related_album and related_member should be integer FKs
            {"field": "related_album_id", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Related album (proper FK)", "group": None}, "schema": {}},
            {"field": "related_member_id", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Related member (proper FK)", "group": None}, "schema": {}},
        ]),
        ("news", [
            {"field": "source", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Original source", "group": None}, "schema": {}},
            {"field": "source_url", "type": "text", "meta": {"interface": "input", "note": "Original article URL", "group": None}, "schema": {}},
            {"field": "featured_image_file", "type": "uuid", "meta": {"interface": "file-image", "note": "Featured image (Directus file)", "group": None}, "schema": {}},
            {"field": "image_credit", "type": "string", "meta": {"interface": "input", "note": "Photo credit for featured image", "group": None}, "schema": {"max_length": 255}},
        ]),
        ("setlists", [
            # setlists already has 'source' as string, add source FK
            {"field": "source_id", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Source registry entry", "group": None}, "schema": {}},
        ]),
        ("tours", [
            {"field": "source", "type": "integer", "meta": {"interface": "select-dropdown-m2o", "width": "half", "note": "Data source", "group": None}, "schema": {}},
            {"field": "source_url", "type": "text", "meta": {"interface": "input", "note": "Source URL", "group": None}, "schema": {}},
            {"field": "image", "type": "uuid", "meta": {"interface": "file-image", "note": "Tour poster/image", "group": None}, "schema": {}},
        ]),
    ]

    for collection, fields in attribution_targets:
        if collection not in existing_collections:
            log(f"  ○ Skipping {collection} (doesn't exist)")
            continue

        existing_fields = get_existing_fields(collection)
        for field_schema in fields:
            field_name = field_schema["field"]
            if not field_exists(collection, field_name, existing_fields):
                add_field(collection, field_schema)
            else:
                log(f"  ○ {collection}.{field_name} already exists, skipping")


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 3: FIX BROKEN RELATIONSHIPS
# ═════════════════════════════════════════════════════════════════════════════

def phase_3_fix_relations(existing_relations):
    """Create proper foreign key relations that are missing."""
    log("\n══════════════════════════════════════════════════════════")
    log("PHASE 3: Fixing Broken Relationships")
    log("══════════════════════════════════════════════════════════")

    # Build a set of existing relation keys for quick lookup
    existing_rel_keys = set()
    for r in existing_relations:
        key = f"{r['collection']}.{r['field']}→{r['related_collection']}"
        existing_rel_keys.add(key)

    relations_to_create = [
        # ─── Fix setlists.tour → tours ───────────────────────────────
        {
            "collection": "setlists",
            "field": "tour",
            "related_collection": "tours",
            "meta": {"one_field": "setlists", "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        # ─── Fix tours.associated_album → discography ────────────────
        {
            "collection": "tours",
            "field": "associated_album",
            "related_collection": "discography",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        # ─── Fix setlist_songs.song → songs ──────────────────────────
        {
            "collection": "setlist_songs",
            "field": "song",
            "related_collection": "songs",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        # ─── Fix setlist_songs.setlist → setlists ────────────────────
        {
            "collection": "setlist_songs",
            "field": "setlist",
            "related_collection": "setlists",
            "meta": {"one_field": "songs", "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        # ─── New: timeline.related_album_id → discography ────────────
        {
            "collection": "timeline",
            "field": "related_album_id",
            "related_collection": "discography",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        # ─── New: timeline.related_member_id → members ───────────────
        {
            "collection": "timeline",
            "field": "related_member_id",
            "related_collection": "members",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        # ─── New: photos.album → discography ─────────────────────────
        {
            "collection": "photos",
            "field": "album",
            "related_collection": "discography",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },

        # ─── Source relations for all collections ─────────────────────
        {
            "collection": "discography",
            "field": "source",
            "related_collection": "sources",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "songs",
            "field": "source",
            "related_collection": "sources",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "members",
            "field": "source",
            "related_collection": "sources",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "photos",
            "field": "source",
            "related_collection": "sources",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "timeline",
            "field": "source",
            "related_collection": "sources",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "news",
            "field": "source",
            "related_collection": "sources",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "setlists",
            "field": "source_id",
            "related_collection": "sources",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "tours",
            "field": "source",
            "related_collection": "sources",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },

        # ─── Video relations ─────────────────────────────────────────
        {
            "collection": "videos",
            "field": "song",
            "related_collection": "songs",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "videos",
            "field": "album",
            "related_collection": "discography",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "videos",
            "field": "setlist",
            "related_collection": "setlists",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "videos",
            "field": "source",
            "related_collection": "sources",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },

        # ─── Poll relations ──────────────────────────────────────────
        {
            "collection": "poll_options",
            "field": "poll",
            "related_collection": "polls",
            "meta": {"one_field": "options", "sort_field": "sort_order", "one_deselect_action": "delete"},
            "schema": {"on_delete": "CASCADE"},
        },

        # ─── Did You Know relations ──────────────────────────────────
        {
            "collection": "did_you_know",
            "field": "related_album",
            "related_collection": "discography",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "did_you_know",
            "field": "related_song",
            "related_collection": "songs",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "did_you_know",
            "field": "related_member",
            "related_collection": "members",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
        {
            "collection": "did_you_know",
            "field": "source",
            "related_collection": "sources",
            "meta": {"one_field": None, "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },

        # ─── Album personnel relations ───────────────────────────────
        {
            "collection": "album_personnel",
            "field": "album",
            "related_collection": "discography",
            "meta": {"one_field": "personnel", "sort_field": None, "one_deselect_action": "delete"},
            "schema": {"on_delete": "CASCADE"},
        },
        {
            "collection": "album_personnel",
            "field": "member",
            "related_collection": "members",
            "meta": {"one_field": "albums", "sort_field": None, "one_deselect_action": "nullify"},
            "schema": {"on_delete": "SET NULL"},
        },
    ]

    for rel in relations_to_create:
        key = f"{rel['collection']}.{rel['field']}→{rel['related_collection']}"
        if key in existing_rel_keys:
            log(f"  ○ Relation {key} already exists, skipping")
        else:
            create_relation(rel)
            time.sleep(0.3)  # Be gentle with the API


# ═════════════════════════════════════════════════════════════════════════════
# PHASE 4: SEED INITIAL SOURCE DATA
# ═════════════════════════════════════════════════════════════════════════════

def phase_4_seed_sources():
    """Create initial source entries for common data origins."""
    log("\n══════════════════════════════════════════════════════════")
    log("PHASE 4: Seeding Initial Source Data")
    log("══════════════════════════════════════════════════════════")

    sources = [
        {
            "name": "setlist.fm",
            "type": "website",
            "url": "https://www.setlist.fm/setlists/the-cure-bd6952e.html",
            "description": "Crowd-sourced setlist database. Primary source for concert setlists.",
            "is_official": False,
            "reliability": 4,
        },
        {
            "name": "Wikipedia",
            "type": "website",
            "url": "https://en.wikipedia.org/wiki/The_Cure",
            "description": "General reference for biographical and discographical data.",
            "is_official": False,
            "reliability": 3,
        },
        {
            "name": "The Cure Official Website",
            "type": "official",
            "url": "https://www.thecure.com",
            "description": "Official band website and announcements.",
            "is_official": True,
            "reliability": 5,
        },
        {
            "name": "Discogs",
            "type": "website",
            "url": "https://www.discogs.com/artist/4840-The-Cure",
            "description": "Comprehensive discography database with release details, credits, and catalog numbers.",
            "is_official": False,
            "reliability": 4,
        },
        {
            "name": "AllMusic",
            "type": "website",
            "url": "https://www.allmusic.com/artist/the-cure-mn0000131645",
            "description": "Album reviews, ratings, and editorial content.",
            "is_official": False,
            "reliability": 4,
        },
        {
            "name": "NME",
            "type": "magazine",
            "url": "https://www.nme.com",
            "description": "Music journalism - interviews, reviews, features.",
            "is_official": False,
            "reliability": 4,
        },
        {
            "name": "A Chain of Flowers",
            "type": "fan",
            "url": "https://www.thecure.com/chainofflowers",
            "description": "Long-running Cure fan community and archive.",
            "is_official": False,
            "reliability": 3,
        },
        {
            "name": "Ten Imaginary Years (Book)",
            "type": "book",
            "author": "Robert Smith & Lol Tolhurst (with Steve Sutherland)",
            "description": "Official illustrated biography covering 1978-1988.",
            "is_official": True,
            "reliability": 5,
        },
        {
            "name": "Cureation Staff",
            "type": "fan",
            "url": "https://cureation.net",
            "description": "Original research and editorial by the Cureation team.",
            "is_official": False,
            "reliability": 4,
        },
        {
            "name": "Fiction Records / Polydor",
            "type": "official",
            "description": "Official label discography and press materials.",
            "is_official": True,
            "reliability": 5,
        },
    ]

    # Check if sources already have data
    result = api("GET", "/items/sources?limit=1&meta=total_count")
    if result and result.get("meta", {}).get("total_count", 0) > 0:
        log("  ○ Sources already have data, skipping seed")
        return

    for source in sources:
        log(f"  Seeding source: {source['name']}")
        api("POST", "/items/sources", source)
        time.sleep(0.2)

    log("  ✓ Seeded 10 initial sources")


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

def main():
    log("╔══════════════════════════════════════════════════════════╗")
    log("║     CUREATION DATABASE REDESIGN & MIGRATION             ║")
    log("╠══════════════════════════════════════════════════════════╣")
    log("║  This script transforms the Directus database:          ║")
    log("║  • Creates new collections (sources, videos, polls...)  ║")
    log("║  • Adds source attribution to all content               ║")
    log("║  • Fixes broken relationships                           ║")
    log("║  • Seeds initial source data                            ║")
    log("║                                                          ║")
    log("║  SAFE: Only ADDS fields/collections. Never deletes.     ║")
    log("╚══════════════════════════════════════════════════════════╝")

    if DRY_RUN:
        log("\n🏃 DRY RUN MODE — No changes will be made\n")

    # Gather current state
    log("\nGathering current database state...")
    existing_collections = get_existing_collections()
    existing_relations = get_existing_relations()
    log(f"  Found {len(existing_collections)} collections")
    log(f"  Found {len(existing_relations)} relations")

    # Run phases
    phase_1_new_collections(existing_collections)
    phase_2_add_attribution(existing_collections)
    phase_3_fix_relations(existing_relations)
    phase_4_seed_sources()

    log("\n══════════════════════════════════════════════════════════")
    log("MIGRATION COMPLETE")
    log("══════════════════════════════════════════════════════════")
    log("\nNext steps:")
    log("  1. Verify collections in Directus admin: https://dash.cureation.net")
    log("  2. Update TypeScript types (src/types/directus.ts)")
    log("  3. Update API functions (src/lib/directus.ts)")
    log("  4. Populate source attributions on existing data")
    log("  5. Start adding videos, polls, and facts!")


if __name__ == "__main__":
    main()
