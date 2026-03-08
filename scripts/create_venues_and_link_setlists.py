#!/usr/bin/env python3
"""
Create a Directus `venues` collection and link all `setlists` rows to it.

What it does:
1. Ensures `venues` collection exists with venue metadata fields.
2. Builds one venue row per unique (venue, city, state_province, country).
3. Adds Cure-specific venue details:
   - first_cure_show
   - latest_cure_show
   - cure_show_count
   - famous_moment
4. Optionally enriches top venues with Wikipedia/Wikidata (capacity, website, coords, etc.).
5. Ensures `setlists.venue_link` (M2O -> venues) exists.
6. Patches every setlist with the correct `venue_link`.

Usage:
  DIRECTUS_TOKEN=... python3 scripts/create_venues_and_link_setlists.py
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Any


DEFAULT_BASE = "https://dash.cureation.net"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIDATA_ENTITY_API = "https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def norm_space(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def ascii_fold(value: str) -> str:
    return (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
    )


def slugify(value: str) -> str:
    folded = ascii_fold(value).lower()
    folded = re.sub(r"[^a-z0-9]+", "-", folded).strip("-")
    return folded or "unknown"


def normalize_key_piece(value: str) -> str:
    folded = ascii_fold(value).lower()
    folded = re.sub(r"[^a-z0-9]+", "", folded)
    return folded


def make_venue_key(venue: str, city: str, state: str, country: str) -> str:
    return "|".join(
        [
            normalize_key_piece(venue),
            normalize_key_piece(city),
            normalize_key_piece(state),
            normalize_key_piece(country),
        ]
    )


def valid_date(value: str) -> str:
    value = (value or "").strip()[:10]
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value
    return ""


def pick_most_common(rows: list[dict[str, Any]], field: str) -> str:
    counts = Counter(norm_space(r.get(field, "")) for r in rows)
    counts.pop("", None)
    if not counts:
        return ""
    return counts.most_common(1)[0][0]


def first_sentence(text: str, max_chars: int = 260) -> str:
    text = norm_space(text)
    if not text:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", text)
    out = parts[0] if parts else text
    out = out.strip()
    if len(out) > max_chars:
        out = out[: max_chars - 1].rstrip() + "…"
    return out


def compact_note(value: str, max_chars: int = 220) -> str:
    text = norm_space(value)
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"


def parse_wikidata_time_year(value: str) -> int | None:
    # Example: "+1871-01-01T00:00:00Z"
    m = re.match(r"^[+-]?(\d{1,6})-", value or "")
    if not m:
        return None
    try:
        year = int(m.group(1))
        if 0 < year <= 3000:
            return year
    except ValueError:
        return None
    return None


def parse_wikidata_amount_int(value: dict[str, Any]) -> int | None:
    amount = value.get("amount")
    if not amount:
        return None
    try:
        raw = float(str(amount).replace("+", ""))
        if raw <= 0:
            return None
        return int(round(raw))
    except ValueError:
        return None


class DirectusClient:
    def __init__(self, base: str, token: str, timeout: float = 30.0):
        self.base = base.rstrip("/")
        self.token = token.strip()
        self.timeout = timeout

    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | list[Any] | None = None,
        retries: int = 3,
    ) -> tuple[int, Any]:
        query = ""
        if params:
            encoded = {}
            for k, v in params.items():
                if v is None:
                    continue
                encoded[k] = v
            query = "?" + urllib.parse.urlencode(encoded, doseq=True)

        url = f"{self.base}{path}{query}"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
        }
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")

        attempt = 0
        while True:
            attempt += 1
            req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    raw = resp.read().decode("utf-8", errors="replace")
                    payload: Any
                    try:
                        payload = json.loads(raw) if raw else {}
                    except json.JSONDecodeError:
                        payload = {"raw": raw}
                    return resp.status, payload
            except urllib.error.HTTPError as exc:
                raw = exc.read().decode("utf-8", errors="replace")
                payload: Any
                try:
                    payload = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    payload = {"raw": raw}
                if exc.code in (429, 500, 502, 503, 504) and attempt <= retries:
                    time.sleep(0.6 * attempt)
                    continue
                return exc.code, payload
            except urllib.error.URLError as exc:
                if attempt <= retries:
                    time.sleep(0.6 * attempt)
                    continue
                return 599, {"errors": [{"message": str(exc)}]}

    def fetch_all_items(
        self,
        collection: str,
        fields: str,
        sort: str = "",
        page_size: int = 500,
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        offset = 0
        while True:
            params: dict[str, Any] = {
                "fields": fields,
                "limit": page_size,
                "offset": offset,
            }
            if sort:
                params["sort"] = sort
            status, payload = self._request("GET", f"/items/{collection}", params=params)
            if status >= 400:
                message = payload.get("errors", [{}])[0].get("message", "unknown error")
                raise RuntimeError(f"Fetch failed for {collection}: HTTP {status} {message}")
            rows = payload.get("data") or []
            if not isinstance(rows, list):
                raise RuntimeError(f"Unexpected payload for {collection}: {rows!r}")
            out.extend(rows)
            if len(rows) < page_size:
                break
            offset += page_size
        return out

    def create_collection(self, payload: dict[str, Any]) -> tuple[int, Any]:
        return self._request("POST", "/collections", body=payload)

    def create_field(self, collection: str, payload: dict[str, Any]) -> tuple[int, Any]:
        return self._request("POST", f"/fields/{collection}", body=payload)

    def create_relation(self, payload: dict[str, Any]) -> tuple[int, Any]:
        return self._request("POST", "/relations", body=payload)

    def get_relations(self) -> list[dict[str, Any]]:
        status, payload = self._request("GET", "/relations")
        if status >= 400:
            return []
        data = payload if isinstance(payload, list) else payload.get("data") or []
        return data if isinstance(data, list) else []

    def create_item(self, collection: str, payload: dict[str, Any]) -> tuple[int, Any]:
        return self._request("POST", f"/items/{collection}", body=payload)

    def patch_item(self, collection: str, item_id: int | str, payload: dict[str, Any]) -> tuple[int, Any]:
        return self._request("PATCH", f"/items/{collection}/{item_id}", body=payload)


@dataclass
class WikiProfile:
    capacity: int | None = None
    opened_year: int | None = None
    venue_type: str = ""
    latitude: float | None = None
    longitude: float | None = None
    wikipedia_url: str = ""
    official_website: str = ""
    description: str = ""


class WikiClient:
    def __init__(self, timeout: float = 15.0):
        self.timeout = timeout
        self.type_label_cache: dict[str, str] = {}

    def _get_json(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        query = urllib.parse.urlencode(params, doseq=True)
        full_url = f"{url}?{query}" if query else url
        req = urllib.request.Request(
            full_url,
            method="GET",
            headers={"Accept": "application/json", "User-Agent": "cureation-venue-linker/1.0"},
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}

    def _entity_label(self, qid: str) -> str:
        if qid in self.type_label_cache:
            return self.type_label_cache[qid]
        try:
            payload = self._get_json(
                "https://www.wikidata.org/w/api.php",
                {
                    "action": "wbgetentities",
                    "ids": qid,
                    "props": "labels",
                    "languages": "en",
                    "format": "json",
                },
            )
            label = (
                payload.get("entities", {})
                .get(qid, {})
                .get("labels", {})
                .get("en", {})
                .get("value", "")
            )
        except Exception:
            label = ""
        self.type_label_cache[qid] = label
        return label

    def _claim_datavalue(self, claims: dict[str, Any], prop: str) -> Any:
        rows = claims.get(prop) or []
        if not rows:
            return None
        mainsnak = rows[0].get("mainsnak", {})
        datavalue = mainsnak.get("datavalue", {})
        return datavalue.get("value")

    def search_profile(self, venue_name: str, city: str, country: str) -> WikiProfile:
        query = " ".join(x for x in [venue_name, city, country, "venue"] if x)
        if not query.strip():
            return WikiProfile()

        try:
            search = self._get_json(
                WIKIPEDIA_API,
                {
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "srlimit": 5,
                    "format": "json",
                    "utf8": 1,
                },
            )
        except Exception:
            return WikiProfile()

        candidates = search.get("query", {}).get("search", [])
        if not candidates:
            return WikiProfile()

        title = candidates[0].get("title", "")
        if not title:
            return WikiProfile()

        try:
            detail = self._get_json(
                WIKIPEDIA_API,
                {
                    "action": "query",
                    "prop": "pageprops|extracts|coordinates|info",
                    "inprop": "url",
                    "titles": title,
                    "ppprop": "wikibase_item",
                    "exintro": 1,
                    "explaintext": 1,
                    "redirects": 1,
                    "format": "json",
                    "utf8": 1,
                },
            )
        except Exception:
            return WikiProfile()

        pages = detail.get("query", {}).get("pages", {})
        page = {}
        for _, val in pages.items():
            if isinstance(val, dict) and "missing" not in val:
                page = val
                break
        if not page:
            return WikiProfile()

        profile = WikiProfile()
        profile.wikipedia_url = page.get("fullurl", "") or ""
        profile.description = first_sentence(page.get("extract", "") or "")

        coords = page.get("coordinates") or []
        if coords and isinstance(coords, list):
            coord0 = coords[0] or {}
            lat = coord0.get("lat")
            lon = coord0.get("lon")
            if isinstance(lat, (int, float)):
                profile.latitude = float(lat)
            if isinstance(lon, (int, float)):
                profile.longitude = float(lon)

        qid = (page.get("pageprops") or {}).get("wikibase_item", "")
        if not qid:
            return profile

        try:
            entity_payload = self._get_json(WIKIDATA_ENTITY_API.format(qid=qid), {})
        except Exception:
            return profile

        entity = entity_payload.get("entities", {}).get(qid, {})
        claims = entity.get("claims", {})

        cap_val = self._claim_datavalue(claims, "P1083")
        if isinstance(cap_val, dict):
            profile.capacity = parse_wikidata_amount_int(cap_val)

        opened_val = self._claim_datavalue(claims, "P571")
        if isinstance(opened_val, dict):
            profile.opened_year = parse_wikidata_time_year(opened_val.get("time", ""))

        site_val = self._claim_datavalue(claims, "P856")
        if isinstance(site_val, str):
            profile.official_website = site_val

        if profile.latitude is None or profile.longitude is None:
            point_val = self._claim_datavalue(claims, "P625")
            if isinstance(point_val, dict):
                lat = point_val.get("latitude")
                lon = point_val.get("longitude")
                if isinstance(lat, (int, float)):
                    profile.latitude = float(lat)
                if isinstance(lon, (int, float)):
                    profile.longitude = float(lon)

        type_val = self._claim_datavalue(claims, "P31")
        if isinstance(type_val, dict):
            type_qid = type_val.get("id", "")
            if type_qid:
                profile.venue_type = self._entity_label(type_qid)

        return profile


def ensure_venues_collection_and_fields(client: DirectusClient, dry_run: bool) -> None:
    venues_collection_payload = {
        "collection": "venues",
        "meta": {
            "collection": "venues",
            "icon": "location_on",
            "note": "Concert venues with The Cure-specific context",
            "hidden": False,
            "singleton": False,
            "accountability": "all",
        },
        "schema": {},
        "fields": [
            {
                "field": "id",
                "type": "integer",
                "meta": {"hidden": True, "interface": "input", "readonly": True},
                "schema": {"is_primary_key": True, "has_auto_increment": True},
            },
            {
                "field": "name",
                "type": "string",
                "meta": {"interface": "input", "required": True, "width": "full"},
                "schema": {"max_length": 255},
            },
            {
                "field": "slug",
                "type": "string",
                "meta": {"interface": "input", "width": "half"},
                "schema": {"max_length": 255},
            },
            {
                "field": "city",
                "type": "string",
                "meta": {"interface": "input", "width": "half"},
                "schema": {"max_length": 255},
            },
            {
                "field": "state_province",
                "type": "string",
                "meta": {"interface": "input", "width": "half"},
                "schema": {"max_length": 255},
            },
            {
                "field": "country",
                "type": "string",
                "meta": {"interface": "input", "width": "half"},
                "schema": {"max_length": 255},
            },
            {
                "field": "location",
                "type": "string",
                "meta": {"interface": "input", "width": "full"},
                "schema": {"max_length": 255},
            },
            {"field": "capacity", "type": "integer", "meta": {"interface": "input", "width": "half"}, "schema": {}},
            {"field": "opened_year", "type": "integer", "meta": {"interface": "input", "width": "half"}, "schema": {}},
            {"field": "venue_type", "type": "string", "meta": {"interface": "input", "width": "half"}, "schema": {"max_length": 255}},
            {"field": "latitude", "type": "float", "meta": {"interface": "input", "width": "half"}, "schema": {}},
            {"field": "longitude", "type": "float", "meta": {"interface": "input", "width": "half"}, "schema": {}},
            {"field": "wikipedia_url", "type": "text", "meta": {"interface": "input", "width": "full"}, "schema": {}},
            {"field": "official_website", "type": "text", "meta": {"interface": "input", "width": "full"}, "schema": {}},
            {"field": "description", "type": "text", "meta": {"interface": "input-multiline", "width": "full"}, "schema": {}},
            {"field": "famous_moment", "type": "text", "meta": {"interface": "input-multiline", "width": "full"}, "schema": {}},
            {"field": "first_cure_show", "type": "date", "meta": {"interface": "datetime", "width": "half"}, "schema": {}},
            {"field": "latest_cure_show", "type": "date", "meta": {"interface": "datetime", "width": "half"}, "schema": {}},
            {"field": "cure_show_count", "type": "integer", "meta": {"interface": "input", "width": "half"}, "schema": {}},
            {"field": "source_notes", "type": "text", "meta": {"interface": "input-multiline", "width": "full"}, "schema": {}},
            {"field": "last_synced_at", "type": "timestamp", "meta": {"interface": "datetime", "width": "half"}, "schema": {}},
        ],
    }

    if dry_run:
        print("[DRY] ensure venues collection")
    else:
        status, payload = client.create_collection(venues_collection_payload)
        if status < 400:
            print("  + created collection venues")
        else:
            message = payload.get("errors", [{}])[0].get("message", "unknown error")
            if "already exists" in message.lower() or "duplicate" in message.lower():
                print("  = collection venues already exists")
            else:
                raise RuntimeError(f"Failed creating venues collection: HTTP {status} {message}")

    # Ensure important fields in case collection existed with partial schema.
    ensure_field_specs = [
        ("slug", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
        ("city", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
        ("state_province", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
        ("country", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
        ("location", "string", {"interface": "input", "width": "full"}, {"max_length": 255}),
        ("capacity", "integer", {"interface": "input", "width": "half"}, None),
        ("opened_year", "integer", {"interface": "input", "width": "half"}, None),
        ("venue_type", "string", {"interface": "input", "width": "half"}, {"max_length": 255}),
        ("latitude", "float", {"interface": "input", "width": "half"}, None),
        ("longitude", "float", {"interface": "input", "width": "half"}, None),
        ("wikipedia_url", "text", {"interface": "input", "width": "full"}, None),
        ("official_website", "text", {"interface": "input", "width": "full"}, None),
        ("description", "text", {"interface": "input-multiline", "width": "full"}, None),
        ("famous_moment", "text", {"interface": "input-multiline", "width": "full"}, None),
        ("first_cure_show", "date", {"interface": "datetime", "width": "half"}, None),
        ("latest_cure_show", "date", {"interface": "datetime", "width": "half"}, None),
        ("cure_show_count", "integer", {"interface": "input", "width": "half"}, None),
        ("source_notes", "text", {"interface": "input-multiline", "width": "full"}, None),
        ("last_synced_at", "timestamp", {"interface": "datetime", "width": "half"}, None),
    ]

    for field_name, field_type, meta, schema in ensure_field_specs:
        body = {"field": field_name, "type": field_type, "meta": meta}
        if schema is not None:
            body["schema"] = schema
        if dry_run:
            print(f"[DRY] ensure field venues.{field_name}")
            continue
        status, payload = client.create_field("venues", body)
        if status < 400:
            print(f"  + field venues.{field_name}")
            continue
        message = payload.get("errors", [{}])[0].get("message", "unknown error")
        if "already exists" in message.lower() or "duplicate" in message.lower():
            continue
        # Some Directus setups return generic FORBIDDEN for existing/hidden fields.
        if status == 403 and "does not exist" in message.lower():
            continue
        print(f"  ! skipping field venues.{field_name}: HTTP {status} {message}")

def ensure_setlists_venue_link_relation(client: DirectusClient, dry_run: bool) -> None:
    field_payload = {
        "field": "venue_link",
        "type": "integer",
        "meta": {
            "interface": "select-dropdown-m2o",
            "width": "full",
            "note": "Linked venue record",
        },
        "schema": {},
    }
    if dry_run:
        print("[DRY] ensure field setlists.venue_link")
    else:
        status, payload = client.create_field("setlists", field_payload)
        if status < 400:
            print("  + field setlists.venue_link")
        else:
            message = payload.get("errors", [{}])[0].get("message", "unknown error")
            if "already exists" in message.lower() or "duplicate" in message.lower():
                print("  = field setlists.venue_link already exists")
            else:
                print(f"  ! setlists.venue_link field: HTTP {status} {message}")

    relations = client.get_relations()
    exists = any(
        rel.get("collection") == "setlists"
        and rel.get("field") == "venue_link"
        and rel.get("related_collection") == "venues"
        for rel in relations
    )
    if exists:
        print("  = relation setlists.venue_link -> venues already exists")
        return

    rel_payload = {
        "collection": "setlists",
        "field": "venue_link",
        "related_collection": "venues",
        "meta": {
            "one_field": None,
            "sort_field": None,
            "one_deselect_action": "nullify",
        },
        "schema": {"on_delete": "SET NULL"},
    }
    if dry_run:
        print("[DRY] ensure relation setlists.venue_link -> venues")
    else:
        status, payload = client.create_relation(rel_payload)
        if status < 400:
            print("  + relation setlists.venue_link -> venues")
        else:
            message = payload.get("errors", [{}])[0].get("message", "unknown error")
            print(f"  ! relation setlists.venue_link -> venues: HTTP {status} {message}")


def build_famous_moment(rows: list[dict[str, Any]], count: int, first_show: str, latest_show: str) -> str:
    if count <= 1:
        base = f"The Cure performed here on {first_show}."
    elif count >= 10:
        base = (
            f"One of The Cure's most-visited venues, with {count} documented performances "
            f"from {first_show} to {latest_show}."
        )
    else:
        base = (
            f"Hosted {count} documented The Cure shows between {first_show} and {latest_show}."
        )

    # Try to include a notable fact from setlist notes.
    keywords = (
        "first",
        "last",
        "final",
        "debut",
        "premiere",
        "livestream",
        "release",
        "anniversary",
        "reunion",
        "rare",
    )
    for row in sorted(rows, key=lambda x: valid_date(x.get("date", ""))):
        note = norm_space(row.get("notes", ""))
        if note and any(k in note.lower() for k in keywords):
            return f"{base} Notable note: {compact_note(note)}"
    return base


def build_description(
    venue_name: str,
    location: str,
    count: int,
    first_show: str,
    latest_show: str,
    wiki_description: str,
) -> str:
    parts: list[str] = []
    if wiki_description:
        parts.append(wiki_description)
    if count <= 1:
        parts.append(f"The Cure has 1 documented show here ({first_show}).")
    else:
        parts.append(
            f"The Cure has {count} documented shows here, spanning {first_show} to {latest_show}."
        )
    if location:
        parts.append(f"Location: {location}.")
    if not wiki_description:
        parts.append(f"{venue_name} is tracked as part of the Cureation live archive.")
    return " ".join(parts).strip()


def make_source_notes(wiki_used: bool) -> str:
    if wiki_used:
        return (
            "Venue metadata combines Directus setlist history with public reference data "
            "(Wikipedia/Wikidata) where available."
        )
    return "Venue metadata derived from Directus setlists; external reference data unavailable for this row."


def main() -> int:
    parser = argparse.ArgumentParser(description="Create venues collection and link setlists in Directus")
    parser.add_argument("--base", default=DEFAULT_BASE, help="Directus base URL")
    parser.add_argument("--token", default="", help="Directus token (or set DIRECTUS_TOKEN)")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without mutating data")
    parser.add_argument(
        "--wiki-limit",
        type=int,
        default=250,
        help="Max number of most-used venues to enrich from Wikipedia/Wikidata (0 = disable)",
    )
    parser.add_argument("--wiki-pause", type=float, default=0.05, help="Delay between wiki lookups")
    parser.add_argument(
        "--max-setlists",
        type=int,
        default=0,
        help="Optional cap for setlists processed (testing only; 0 means all)",
    )
    args = parser.parse_args()

    token = args.token.strip() or os.environ.get("DIRECTUS_TOKEN", "").strip()
    if not token:
        print("ERROR: missing token. Use --token or DIRECTUS_TOKEN.", file=sys.stderr)
        return 2

    print("=== Create Venues + Link Setlists ===")
    print(f"Base: {args.base.rstrip('/')}")
    print(f"Dry run: {args.dry_run}")
    print(f"Wiki enrich limit: {args.wiki_limit}")

    client = DirectusClient(base=args.base, token=token)

    print("\n[1/6] Ensuring venues collection schema")
    ensure_venues_collection_and_fields(client, dry_run=args.dry_run)

    print("\n[2/6] Loading setlists for venue build")
    source_setlists = client.fetch_all_items(
        "setlists",
        fields="id,venue,city,state_province,country,date,tour_name,notes",
        sort="id",
        page_size=500,
    )
    if args.max_setlists > 0:
        source_setlists = source_setlists[: args.max_setlists]
    print(f"  loaded {len(source_setlists)} setlists")
    if not source_setlists:
        print("No setlists found. Nothing to do.")
        return 0

    print("\n[3/6] Grouping setlists by venue key")
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in source_setlists:
        venue = norm_space(row.get("venue", ""))
        city = norm_space(row.get("city", ""))
        state = norm_space(row.get("state_province", ""))
        country = norm_space(row.get("country", ""))
        key = make_venue_key(venue, city, state, country)
        grouped[key].append(row)
    print(f"  unique venue keys: {len(grouped)}")

    # Existing venues for idempotency.
    existing_venues = client.fetch_all_items(
        "venues",
        fields="id,name,slug,city,state_province,country,cure_show_count",
        sort="id",
        page_size=500,
    )
    print(f"  existing venues: {len(existing_venues)}")

    existing_by_key: dict[str, dict[str, Any]] = {}
    existing_slugs: set[str] = set()
    for v in existing_venues:
        key = make_venue_key(
            norm_space(v.get("name", "")),
            norm_space(v.get("city", "")),
            norm_space(v.get("state_province", "")),
            norm_space(v.get("country", "")),
        )
        if key:
            existing_by_key[key] = v
        slug = norm_space(v.get("slug", ""))
        if slug:
            existing_slugs.add(slug)

    # Order by most-frequent venues first so wiki enrichment covers most setlists.
    venue_groups = sorted(grouped.items(), key=lambda kv: len(kv[1]), reverse=True)
    wiki_client = WikiClient()

    venue_id_by_key: dict[str, int] = {}
    created = 0
    reused = 0
    patched_existing = 0
    failed_venues = 0
    wiki_used_count = 0

    print("\n[4/6] Creating/updating venues")
    for idx, (key, rows) in enumerate(venue_groups, start=1):
        name = pick_most_common(rows, "venue")
        city = pick_most_common(rows, "city")
        state = pick_most_common(rows, "state_province")
        country = pick_most_common(rows, "country")
        dates = sorted(d for d in (valid_date(r.get("date", "")) for r in rows) if d)
        first_show = dates[0] if dates else ""
        latest_show = dates[-1] if dates else ""
        show_count = len(rows)

        location = ", ".join([p for p in [city, state, country] if p])
        famous_moment = build_famous_moment(rows, show_count, first_show or "unknown date", latest_show or "unknown date")

        wiki_profile = WikiProfile()
        should_enrich = args.wiki_limit > 0 and idx <= args.wiki_limit
        if should_enrich:
            try:
                wiki_profile = wiki_client.search_profile(name, city, country)
                if any(
                    [
                        wiki_profile.capacity is not None,
                        wiki_profile.wikipedia_url,
                        wiki_profile.description,
                        wiki_profile.official_website,
                    ]
                ):
                    wiki_used_count += 1
            except Exception:
                wiki_profile = WikiProfile()
            if args.wiki_pause > 0:
                time.sleep(args.wiki_pause)

        description = build_description(
            venue_name=name,
            location=location,
            count=show_count,
            first_show=first_show or "unknown date",
            latest_show=latest_show or "unknown date",
            wiki_description=wiki_profile.description,
        )

        slug_base = slugify("-".join([name, city or state, country]).strip("-"))
        slug = slug_base
        n = 2
        while slug in existing_slugs:
            slug = f"{slug_base}-{n}"
            n += 1

        payload = {
            "name": name,
            "slug": slug,
            "city": city or None,
            "state_province": state or None,
            "country": country or None,
            "location": location or None,
            "capacity": wiki_profile.capacity,
            "opened_year": wiki_profile.opened_year,
            "venue_type": wiki_profile.venue_type or None,
            "latitude": wiki_profile.latitude,
            "longitude": wiki_profile.longitude,
            "wikipedia_url": wiki_profile.wikipedia_url or None,
            "official_website": wiki_profile.official_website or None,
            "description": description,
            "famous_moment": famous_moment,
            "first_cure_show": first_show or None,
            "latest_cure_show": latest_show or None,
            "cure_show_count": show_count,
            "source_notes": make_source_notes(bool(wiki_profile.wikipedia_url)),
            "last_synced_at": now_iso(),
        }

        existing = existing_by_key.get(key)
        if existing:
            venue_id = int(existing.get("id"))
            venue_id_by_key[key] = venue_id
            reused += 1

            patch_payload = {
                "location": payload["location"],
                "first_cure_show": payload["first_cure_show"],
                "latest_cure_show": payload["latest_cure_show"],
                "cure_show_count": payload["cure_show_count"],
                "famous_moment": payload["famous_moment"],
                "description": payload["description"],
                "source_notes": payload["source_notes"],
                "last_synced_at": payload["last_synced_at"],
            }
            # Only fill optional metadata if available from wiki.
            for opt in (
                "capacity",
                "opened_year",
                "venue_type",
                "latitude",
                "longitude",
                "wikipedia_url",
                "official_website",
            ):
                if payload.get(opt) not in (None, ""):
                    patch_payload[opt] = payload[opt]

            if args.dry_run:
                print(f"  [DRY] patch venues/{venue_id} ({name})")
                patched_existing += 1
            else:
                status, res = client.patch_item("venues", venue_id, patch_payload)
                if status < 400:
                    patched_existing += 1
                else:
                    message = res.get("errors", [{}])[0].get("message", "unknown error")
                    print(f"  ! failed patch venues/{venue_id} ({name}): HTTP {status} {message}")
            continue

        if args.dry_run:
            print(f"  [DRY] create venue {name} ({location})")
            created += 1
            venue_id_by_key[key] = -created
            existing_slugs.add(slug)
            continue

        status, res = client.create_item("venues", payload)
        if status >= 400:
            message = res.get("errors", [{}])[0].get("message", "unknown error")
            print(f"  ! failed create venue {name} ({location}): HTTP {status} {message}")
            failed_venues += 1
            continue
        data = res.get("data") or {}
        venue_id = data.get("id")
        if not venue_id:
            print(f"  ! missing id in create response for venue {name}")
            failed_venues += 1
            continue
        venue_id_by_key[key] = int(venue_id)
        existing_slugs.add(slug)
        created += 1

        if idx % 100 == 0:
            print(f"  progress {idx}/{len(venue_groups)} (created={created}, reused={reused}, failed={failed_venues})")

    print(
        "  venues summary: "
        f"created={created}, reused={reused}, patched_existing={patched_existing}, "
        f"failed={failed_venues}, wiki_enriched={wiki_used_count}"
    )

    print("\n[5/6] Ensuring setlists venue relation")
    ensure_setlists_venue_link_relation(client, dry_run=args.dry_run)

    print("\n[6/6] Loading setlists for linking")
    setlists = client.fetch_all_items(
        "setlists",
        fields="id,venue,city,state_province,country,venue_link",
        sort="id",
        page_size=500,
    )
    if args.max_setlists > 0:
        setlists = setlists[: args.max_setlists]
    print(f"  loaded {len(setlists)} setlists for link patching")

    print("\n[6/6] Linking setlists -> venues")
    linked = 0
    skipped = 0
    failed_links = 0

    for idx, row in enumerate(setlists, start=1):
        setlist_id = row.get("id")
        venue = norm_space(row.get("venue", ""))
        city = norm_space(row.get("city", ""))
        state = norm_space(row.get("state_province", ""))
        country = norm_space(row.get("country", ""))
        key = make_venue_key(venue, city, state, country)
        venue_id = venue_id_by_key.get(key)

        if not venue_id:
            failed_links += 1
            continue

        current_link = row.get("venue_link")
        try:
            current_link_int = int(current_link) if current_link is not None else None
        except (TypeError, ValueError):
            current_link_int = None

        if current_link_int == venue_id:
            skipped += 1
            continue

        if args.dry_run:
            linked += 1
            continue

        status, res = client.patch_item("setlists", setlist_id, {"venue_link": venue_id})
        if status < 400:
            linked += 1
        else:
            message = res.get("errors", [{}])[0].get("message", "unknown error")
            print(f"  ! failed setlists/{setlist_id} -> venue {venue_id}: HTTP {status} {message}")
            failed_links += 1

        if idx % 200 == 0:
            print(
                f"  progress {idx}/{len(setlists)} "
                f"(linked={linked}, skipped={skipped}, failed={failed_links})"
            )

    print("\n=== Done ===")
    print(
        f"Setlists total={len(setlists)} linked={linked} skipped={skipped} failed={failed_links}; "
        f"venues created={created} reused={reused} failed={failed_venues}"
    )
    return 0 if (failed_venues == 0 and failed_links == 0) else 1


if __name__ == "__main__":
    raise SystemExit(main())
