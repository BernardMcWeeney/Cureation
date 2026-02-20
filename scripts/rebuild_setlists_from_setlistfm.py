#!/usr/bin/env python3
"""
Wipe and rebuild The Cure tours/setlists data in Directus from setlist.fm.

Collections used (current schema):
- tours
- setlists
- setlist_songs

Environment variables (or CLI flags):
- DIRECTUS_BASE (default: https://dash.cureation.net)
- DIRECTUS_TOKEN (required)
- SETLISTFM_API_KEY or API_KEY_SETLIST_FM (required)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


THE_CURE_MBID = "69ee3720-a7cb-4402-b48d-a02c366f2bcf"


def now_utc_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def slugify(value: str | None) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text).strip("-")
    return text


def unique_slug(base: str, used: set[str]) -> str:
    raw = slugify(base) or "item"
    candidate = raw
    n = 2
    while candidate in used:
        candidate = f"{raw}-{n}"
        n += 1
    used.add(candidate)
    return candidate


def parse_event_date(value: str | None) -> str | None:
    if not value:
        return None

    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(value, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None


class HTTPClient:
    def __init__(self, retries: int = 5, timeout: int = 60):
        self.retries = retries
        self.timeout = timeout

    def request_json(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        body: Any | None = None,
    ) -> dict[str, Any]:
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(url, data=payload, headers=headers or {}, method=method)

        for attempt in range(1, self.retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    raw = response.read().decode("utf-8", "ignore")
                    if not raw.strip():
                        return {}
                    return json.loads(raw)
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", "ignore")
                retriable = exc.code in (408, 429, 500, 502, 503, 504)
                if retriable and attempt < self.retries:
                    sleep_s = min(8, 1.5 * attempt)
                    time.sleep(sleep_s)
                    continue
                raise RuntimeError(f"{method} {url} -> HTTP {exc.code}: {detail[:500]}") from exc
            except urllib.error.URLError as exc:
                if attempt < self.retries:
                    sleep_s = min(8, 1.5 * attempt)
                    time.sleep(sleep_s)
                    continue
                raise RuntimeError(f"{method} {url} -> URL error: {exc.reason}") from exc


@dataclass
class DirectusClient:
    base: str
    token: str
    http: HTTPClient

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        body: Any | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base}{path}"
        if params:
            q = urllib.parse.urlencode(params, doseq=True)
            url = f"{url}?{q}"
        return self.http.request_json(method, url, headers=self._headers(), body=body)

    def fetch_all_ids(self, collection: str, page_size: int = 500) -> list[int]:
        ids: list[int] = []
        offset = 0
        while True:
            res = self.request(
                "GET",
                f"/items/{collection}",
                params={"fields": "id", "limit": page_size, "offset": offset, "sort": "id"},
            )
            rows = res.get("data") or []
            if not rows:
                break
            ids.extend([r["id"] for r in rows if isinstance(r, dict) and "id" in r])
            if len(rows) < page_size:
                break
            offset += page_size
        return ids

    def bulk_delete_all(self, collection: str, batch_size: int = 250) -> int:
        ids = self.fetch_all_ids(collection)
        total = len(ids)
        if total == 0:
            return 0

        for i in range(0, total, batch_size):
            chunk = ids[i : i + batch_size]
            self.request("DELETE", f"/items/{collection}", body={"keys": chunk})
            if (i // batch_size + 1) % 10 == 0 or (i + batch_size) >= total:
                print(f"  {collection}: deleted {min(i + batch_size, total)}/{total}")
        return total

    def create_item(self, collection: str, payload: dict[str, Any]) -> dict[str, Any]:
        res = self.request("POST", f"/items/{collection}", body=payload)
        data = res.get("data")
        if not isinstance(data, dict):
            raise RuntimeError(f"Unexpected create response for {collection}: {res}")
        return data

    def create_many(self, collection: str, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not payloads:
            return []
        res = self.request("POST", f"/items/{collection}", body=payloads)
        data = res.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return [data]
        raise RuntimeError(f"Unexpected bulk create response for {collection}: {res}")

    def total_count(self, collection: str) -> int:
        res = self.request(
            "GET",
            f"/items/{collection}",
            params={"limit": 1, "meta": "total_count", "fields": "id"},
        )
        meta = res.get("meta") or {}
        return int(meta.get("total_count", 0))


@dataclass
class SetlistFMClient:
    api_key: str
    http: HTTPClient
    base: str = "https://api.setlist.fm/rest/1.0"

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "x-api-key": self.api_key,
            "User-Agent": "cureation-setlist-importer/1.0",
        }

    def request(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.base}{path}"
        if params:
            q = urllib.parse.urlencode(params, doseq=True)
            url = f"{url}?{q}"
        return self.http.request_json("GET", url, headers=self._headers())

    def fetch_all_artist_setlists(self, artist_mbid: str) -> list[dict[str, Any]]:
        all_rows: list[dict[str, Any]] = []
        page = 1

        while True:
            payload = self.request(f"/artist/{artist_mbid}/setlists", params={"p": page})
            rows = payload.get("setlist") or []
            if isinstance(rows, dict):
                rows = [rows]

            total = int(payload.get("total") or 0)
            ipp = int(payload.get("itemsPerPage") or (len(rows) or 20))
            total_pages = max(1, math.ceil(total / ipp)) if total and ipp else page

            all_rows.extend(rows)
            print(
                f"  setlist.fm page {page}/{total_pages} "
                f"(fetched {len(all_rows)}{'/' + str(total) if total else ''})"
            )

            if page >= total_pages or not rows:
                break

            page += 1
            time.sleep(0.12)

        return all_rows


def get_country_name(city_block: dict[str, Any]) -> str | None:
    country = city_block.get("country") or {}
    if isinstance(country, dict):
        return (country.get("name") or country.get("code") or "").strip() or None
    return None


def classify_set_type(set_block: dict[str, Any], set_index: int) -> str:
    encore_raw = set_block.get("encore")
    if encore_raw in (None, "", 0, "0", False):
        return "main" if set_index == 1 else f"set{set_index}"

    encore_str = str(encore_raw).strip().lower()
    if encore_str in ("1", "true", "yes"):
        return "encore"
    if encore_str.isdigit():
        return f"encore{encore_str}"
    return "encore"


def extract_setlist_songs(setlist: dict[str, Any]) -> list[dict[str, Any]]:
    sets = (setlist.get("sets") or {}).get("set") or []
    if isinstance(sets, dict):
        sets = [sets]

    output: list[dict[str, Any]] = []
    position = 1

    for idx, set_block in enumerate(sets, start=1):
        if not isinstance(set_block, dict):
            continue

        set_type = classify_set_type(set_block, idx)
        songs = set_block.get("song") or []
        if isinstance(songs, dict):
            songs = [songs]

        for song in songs:
            if not isinstance(song, dict):
                continue
            title = (song.get("name") or "").strip()
            if not title:
                continue

            info = (song.get("info") or "").strip()
            cover = song.get("cover") or {}
            cover_artist = (cover.get("name") or "").strip() if isinstance(cover, dict) else ""
            is_cover = bool(cover_artist and normalize(cover_artist) != "thecure")
            is_debut = "debut" in info.lower() if info else False

            output.append(
                {
                    "song_title": title,
                    "position": position,
                    "set_type": set_type,
                    "notes": info or None,
                    "is_cover": is_cover,
                    "cover_artist": cover_artist or None,
                    "is_debut": is_debut,
                }
            )
            position += 1

    return output


def build_song_lookup(directus: DirectusClient) -> dict[str, int]:
    lookup: dict[str, int] = {}
    offset = 0
    page_size = 500

    while True:
        res = directus.request(
            "GET",
            "/items/songs",
            params={"fields": "id,title", "limit": page_size, "offset": offset, "sort": "id"},
        )
        rows = res.get("data") or []
        if not rows:
            break
        for row in rows:
            title = row.get("title")
            if title:
                lookup[normalize(title)] = row["id"]
        if len(rows) < page_size:
            break
        offset += page_size

    print(f"Loaded {len(lookup)} songs from Directus for setlist song linking.")
    return lookup


def build_tour_aggregates(setlists: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tours: dict[str, dict[str, Any]] = {}
    for row in setlists:
        tour_name = ((row.get("tour") or {}).get("name") or "").strip()
        if not tour_name:
            continue

        show_date = parse_event_date(row.get("eventDate"))
        item = tours.get(tour_name)
        if item is None:
            item = {
                "name": tour_name,
                "start_date": show_date,
                "end_date": show_date,
                "total_shows": 0,
            }
            tours[tour_name] = item

        item["total_shows"] += 1
        if show_date:
            if not item["start_date"] or show_date < item["start_date"]:
                item["start_date"] = show_date
            if not item["end_date"] or show_date > item["end_date"]:
                item["end_date"] = show_date

    return sorted(tours.values(), key=lambda x: (x.get("start_date") or "9999-99-99", x["name"]))


def create_tours(
    directus: DirectusClient, tour_rows: list[dict[str, Any]]
) -> dict[str, int]:
    name_to_id: dict[str, int] = {}
    used_slugs: set[str] = set()
    now = dt.date.today().isoformat()

    for row in tour_rows:
        slug = unique_slug(row["name"], used_slugs)
        payload = {
            "name": row["name"],
            "slug": slug,
            "start_date": row.get("start_date"),
            "end_date": row.get("end_date"),
            "description": f"Imported from setlist.fm on {now}",
            "total_shows": row.get("total_shows") or 0,
        }
        created = directus.create_item("tours", payload)
        name_to_id[normalize(row["name"])] = created["id"]

    print(f"Created {len(name_to_id)} tours.")
    return name_to_id


def wipe_setlist_related_data(directus: DirectusClient) -> None:
    print("Wiping existing setlist/tour data...")
    for collection in ("setlist_songs", "setlists", "tours"):
        deleted = directus.bulk_delete_all(collection)
        print(f"  {collection}: deleted {deleted}")


def import_setlists(
    directus: DirectusClient,
    setlists: list[dict[str, Any]],
    song_lookup: dict[str, int],
    tour_map: dict[str, int],
) -> tuple[int, int, int, int, int]:
    created_setlists = 0
    created_setlist_songs = 0
    skipped_no_date = 0
    errors = 0
    linked_song_refs = 0
    used_slugs: set[str] = set()

    for idx, src in enumerate(setlists, start=1):
        date_iso = parse_event_date(src.get("eventDate"))
        if not date_iso:
            skipped_no_date += 1
            continue

        venue = src.get("venue") or {}
        city = venue.get("city") or {}
        tour_name = ((src.get("tour") or {}).get("name") or "").strip() or None
        sfm_id = (src.get("id") or "").strip() if isinstance(src.get("id"), str) else src.get("id")

        venue_name = (venue.get("name") or "").strip() or "Unknown Venue"
        city_name = (city.get("name") or "").strip() or None
        country_name = get_country_name(city)
        state_province = (city.get("stateCode") or city.get("state") or "").strip() or None

        setlist_song_rows = extract_setlist_songs(src)
        slug_base = f"{date_iso}-{venue_name}-{city_name or 'unknown'}-{sfm_id or idx}"
        slug = unique_slug(slug_base, used_slugs)

        info_note = (src.get("info") or "").strip()
        source_url = (src.get("url") or "").strip()
        source_id = str(sfm_id).strip() if sfm_id is not None else ""
        note_parts: list[str] = []
        if info_note:
            note_parts.append(info_note)
        if source_url:
            note_parts.append(f"Source: {source_url}")
        if source_id:
            note_parts.append(f"setlist.fm ID: {source_id}")
        notes = "\n\n".join(note_parts) if note_parts else None
        setlist_payload = {
            "venue": venue_name,
            "city": city_name,
            "country": country_name,
            "state_province": state_province,
            "date": date_iso,
            "tour_name": tour_name,
            "tour": tour_map.get(normalize(tour_name)) if tour_name else None,
            "slug": slug,
            "song_count": len(setlist_song_rows),
            "source": "setlist.fm",
            "notes": notes,
        }

        try:
            created_setlist = directus.create_item("setlists", setlist_payload)
            setlist_id = created_setlist["id"]
            created_setlists += 1
        except Exception as exc:  # noqa: BLE001
            errors += 1
            print(f"  ERROR creating setlist #{idx}: {exc}")
            continue

        if setlist_song_rows:
            payloads: list[dict[str, Any]] = []
            for row in setlist_song_rows:
                payload = dict(row)
                payload["setlist"] = setlist_id
                payload["song"] = song_lookup.get(normalize(row["song_title"]))
                if payload["song"] is not None:
                    linked_song_refs += 1
                payloads.append(payload)

            try:
                for start in range(0, len(payloads), 200):
                    batch = payloads[start : start + 200]
                    directus.create_many("setlist_songs", batch)
                    created_setlist_songs += len(batch)
            except Exception as exc:  # noqa: BLE001
                # Fallback to individual inserts if a batch fails.
                for payload in payloads:
                    try:
                        directus.create_item("setlist_songs", payload)
                        created_setlist_songs += 1
                    except Exception as item_exc:  # noqa: BLE001
                        errors += 1
                        print(f"  ERROR creating setlist_song for setlist {setlist_id}: {item_exc}")
                print(f"  WARN batch fallback for setlist {setlist_id}: {exc}")

        if idx % 25 == 0:
            print(
                f"  Progress {idx}/{len(setlists)} "
                f"(setlists={created_setlists}, songs={created_setlist_songs}, linked={linked_song_refs}, errors={errors})"
            )

    return created_setlists, created_setlist_songs, linked_song_refs, skipped_no_date, errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Wipe and rebuild Cureation tours/setlists from setlist.fm"
    )
    parser.add_argument("--directus-base", default=os.getenv("DIRECTUS_BASE", "https://dash.cureation.net"))
    parser.add_argument("--directus-token", default=os.getenv("DIRECTUS_TOKEN"))
    parser.add_argument(
        "--setlistfm-api-key",
        default=os.getenv("SETLISTFM_API_KEY") or os.getenv("API_KEY_SETLIST_FM"),
    )
    parser.add_argument("--artist-mbid", default=THE_CURE_MBID)
    parser.add_argument("--wipe", action="store_true", help="Delete existing tours/setlists/setlist_songs first")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.directus_token:
        print("ERROR: DIRECTUS token is required (--directus-token or DIRECTUS_TOKEN).")
        return 2
    if not args.setlistfm_api_key:
        print("ERROR: setlist.fm API key is required (--setlistfm-api-key or SETLISTFM_API_KEY/API_KEY_SETLIST_FM).")
        return 2

    directus_base = args.directus_base.rstrip("/")
    print(f"Started at {now_utc_iso()}")
    print(f"Directus: {directus_base}")

    http = HTTPClient(retries=5, timeout=60)
    directus = DirectusClient(base=directus_base, token=args.directus_token, http=http)
    setlistfm = SetlistFMClient(api_key=args.setlistfm_api_key, http=http)

    before_counts = {
        "tours": directus.total_count("tours"),
        "setlists": directus.total_count("setlists"),
        "setlist_songs": directus.total_count("setlist_songs"),
    }
    print(f"Before: {before_counts}")

    if args.wipe:
        wipe_setlist_related_data(directus)
    else:
        print("Wipe skipped (run with --wipe to fully rebuild from empty state).")

    print("Fetching all The Cure setlists from setlist.fm...")
    all_setlists = setlistfm.fetch_all_artist_setlists(args.artist_mbid)
    print(f"Fetched {len(all_setlists)} setlists from setlist.fm.")
    if not all_setlists:
        print("No setlists fetched, aborting.")
        return 1

    print("Building tours from setlist data...")
    tour_rows = build_tour_aggregates(all_setlists)
    tour_map = create_tours(directus, tour_rows)

    print("Loading songs lookup from Directus...")
    song_lookup = build_song_lookup(directus)

    print("Importing setlists and setlist_songs...")
    created_setlists, created_setlist_songs, linked_song_refs, skipped_no_date, errors = import_setlists(
        directus=directus,
        setlists=all_setlists,
        song_lookup=song_lookup,
        tour_map=tour_map,
    )

    after_counts = {
        "tours": directus.total_count("tours"),
        "setlists": directus.total_count("setlists"),
        "setlist_songs": directus.total_count("setlist_songs"),
    }

    print("\nSummary")
    print(f"- Created tours: {len(tour_map)}")
    print(f"- Created setlists: {created_setlists}")
    print(f"- Created setlist_songs: {created_setlist_songs}")
    print(f"- Linked setlist_songs.song -> songs.id: {linked_song_refs}")
    print(f"- Skipped (missing/invalid date): {skipped_no_date}")
    print(f"- Errors: {errors}")
    print(f"- Final counts: {after_counts}")
    print(f"Finished at {now_utc_iso()}")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
