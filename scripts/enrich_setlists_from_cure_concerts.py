#!/usr/bin/env python3
"""
Enrich Directus setlists with concert facts from cure-concerts.de.

Because the provided Directus token cannot write to several custom collections
(e.g. videos/sources/polls), this script stores structured concert metadata in
new JSON/text fields on `setlists`, and uploads media into existing `photos`
and `directus_files` collections.

Features:
- Adds missing fields to `setlists` and `photos`
- Parses lineup, support, soundcheck, stage banter, tickets, photos,
  video/audio links, trivia facts, and recording metadata
- Uploads ticket/photo images to Directus files and creates `photos` items
- Creates missing `members` entries when lineup names are unknown
- Idempotent: skips already-enriched setlists unless `--force`
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import mimetypes
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any

DIRECTUS_BASE_DEFAULT = "https://dash.cureation.net"
CURE_CONCERTS_BASE = "https://www.cure-concerts.de"
USER_AGENT = "cureation-concert-enricher/1.0"


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def slugify(value: str | None) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text).strip("-")
    return text or "item"


def unique_preserve_order(values: list[Any]) -> list[Any]:
    out: list[Any] = []
    seen: set[Any] = set()
    for v in values:
        key = json.dumps(v, sort_keys=True) if isinstance(v, (dict, list)) else str(v)
        if key in seen:
            continue
        seen.add(key)
        out.append(v)
    return out


def clean_text(fragment: str) -> str:
    text = fragment
    text = re.sub(r"(?is)<script.*?>.*?</script>", "", text)
    text = re.sub(r"(?is)<style.*?>.*?</style>", "", text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</(div|p|li|tr|td|ul|ol|table|h\d)>", "\n", text)
    text = re.sub(r"(?is)<[^>]+>", "", text)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def split_nonempty_lines(fragment: str) -> list[str]:
    lines = [line.strip() for line in clean_text(fragment).splitlines()]
    out = []
    for line in lines:
        if not line or line == "-":
            continue
        out.append(line)
    return out


def sha8(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:8]


class HTTPClient:
    def __init__(self, retries: int = 4, timeout: int = 45):
        self.retries = retries
        self.timeout = timeout

    def request(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        data: bytes | None = None,
        expect_json: bool = True,
    ) -> tuple[int, Any]:
        req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)

        for attempt in range(1, self.retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as response:
                    status = response.getcode()
                    raw = response.read()
                    if not expect_json:
                        return status, raw

                    if not raw:
                        return status, {}
                    try:
                        return status, json.loads(raw)
                    except json.JSONDecodeError:
                        return status, {"raw": raw.decode("utf-8", "ignore")}
            except urllib.error.HTTPError as exc:
                status = exc.code
                body = exc.read().decode("utf-8", "ignore")
                retriable = status in (408, 429, 500, 502, 503, 504)
                if retriable and attempt < self.retries:
                    time.sleep(min(8.0, 1.5 * attempt))
                    continue

                if expect_json:
                    try:
                        return status, json.loads(body)
                    except json.JSONDecodeError:
                        return status, {"errors": [{"message": body[:800]}]}
                return status, body.encode("utf-8", "ignore")
            except (urllib.error.URLError, TimeoutError, OSError):
                if attempt < self.retries:
                    time.sleep(min(8.0, 1.5 * attempt))
                    continue
                raise

        # Unreachable
        raise RuntimeError(f"Failed request: {method} {url}")


class DirectusClient:
    def __init__(self, base: str, token: str, http: HTTPClient):
        self.base = base.rstrip("/")
        self.token = token
        self.http = http

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {self.token}"}
        if extra:
            headers.update(extra)
        return headers

    def request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        body: Any | None = None,
        extra_headers: dict[str, str] | None = None,
        raw_data: bytes | None = None,
        expect_json: bool = True,
    ) -> tuple[int, Any]:
        url = f"{self.base}{path}"
        if params:
            query = urllib.parse.urlencode(params, doseq=True)
            url = f"{url}?{query}"

        headers = self._headers(extra_headers)
        data = raw_data
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")

        return self.http.request(method, url, headers=headers, data=data, expect_json=expect_json)

    def fetch_all_items(
        self,
        collection: str,
        fields: str,
        sort: str | None = None,
        page_size: int = 500,
        filter_obj: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        offset = 0
        rows: list[dict[str, Any]] = []

        while True:
            params: dict[str, Any] = {
                "fields": fields,
                "limit": page_size,
                "offset": offset,
            }
            if sort:
                params["sort"] = sort
            if filter_obj:
                params["filter"] = json.dumps(filter_obj)

            status, payload = self.request("GET", f"/items/{collection}", params=params)
            if status >= 400:
                message = payload.get("errors", [{}])[0].get("message", "unknown error")
                raise RuntimeError(f"Failed to fetch {collection}: HTTP {status} {message}")

            chunk = payload.get("data") or []
            if not chunk:
                break

            rows.extend([row for row in chunk if isinstance(row, dict)])
            if len(chunk) < page_size:
                break
            offset += page_size

        return rows

    def get_fields(self, collection: str) -> set[str]:
        status, payload = self.request("GET", f"/fields/{collection}")
        if status >= 400:
            return set()
        return {row.get("field") for row in (payload.get("data") or []) if row.get("field")}

    def ensure_field(
        self,
        collection: str,
        field: str,
        field_type: str,
        meta: dict[str, Any] | None = None,
        schema: dict[str, Any] | None = None,
        dry_run: bool = False,
    ) -> bool:
        status, payload = self.request("GET", f"/fields/{collection}/{field}")
        if status == 200 and payload.get("data"):
            return False

        body: dict[str, Any] = {"field": field, "type": field_type}
        if meta:
            body["meta"] = meta
        if schema:
            body["schema"] = schema

        if dry_run:
            print(f"[DRY] add field {collection}.{field} ({field_type})")
            return True

        status, payload = self.request("POST", f"/fields/{collection}", body=body)
        if status >= 400:
            message = payload.get("errors", [{}])[0].get("message", "unknown error")
            raise RuntimeError(f"Failed adding field {collection}.{field}: HTTP {status} {message}")

        print(f"  + field {collection}.{field}")
        return True

    def ensure_relation(
        self,
        collection: str,
        field: str,
        related_collection: str,
        dry_run: bool = False,
    ) -> bool:
        status, payload = self.request("GET", "/relations")
        if status >= 400:
            return False

        existing = payload if isinstance(payload, list) else payload.get("data") or []
        for rel in existing:
            if (
                rel.get("collection") == collection
                and rel.get("field") == field
                and rel.get("related_collection") == related_collection
            ):
                return False

        body = {
            "collection": collection,
            "field": field,
            "related_collection": related_collection,
            "meta": {
                "one_field": None,
                "sort_field": None,
                "one_deselect_action": "nullify",
            },
            "schema": {"on_delete": "SET NULL"},
        }

        if dry_run:
            print(f"[DRY] add relation {collection}.{field} -> {related_collection}")
            return True

        status, payload = self.request("POST", "/relations", body=body)
        if status >= 400:
            message = payload.get("errors", [{}])[0].get("message", "unknown error")
            print(f"  ! relation skipped {collection}.{field}: HTTP {status} {message}")
            return False

        print(f"  + relation {collection}.{field} -> {related_collection}")
        return True

    def patch_item(self, collection: str, item_id: int | str, payload: dict[str, Any]) -> tuple[int, Any]:
        return self.request("PATCH", f"/items/{collection}/{item_id}", body=payload)

    def create_item(self, collection: str, payload: dict[str, Any]) -> tuple[int, Any]:
        return self.request("POST", f"/items/{collection}", body=payload)

    def upload_file(
        self,
        filename: str,
        file_bytes: bytes,
        mime_type: str,
        title: str | None = None,
        dry_run: bool = False,
    ) -> str | None:
        if dry_run:
            print(f"[DRY] upload file {filename} ({len(file_bytes)} bytes)")
            return f"dry-{sha8(filename)}"

        boundary = f"----CodexBoundary{uuid.uuid4().hex}"
        lines: list[bytes] = []

        if title:
            lines.append(f"--{boundary}\r\n".encode())
            lines.append(b'Content-Disposition: form-data; name="title"\r\n\r\n')
            lines.append(title.encode("utf-8"))
            lines.append(b"\r\n")

        lines.append(f"--{boundary}\r\n".encode())
        lines.append(
            (
                f'Content-Disposition: form-data; name="file"; '
                f'filename="{filename}"\r\n'
            ).encode()
        )
        lines.append(f"Content-Type: {mime_type}\r\n\r\n".encode())
        lines.append(file_bytes)
        lines.append(b"\r\n")
        lines.append(f"--{boundary}--\r\n".encode())

        body = b"".join(lines)
        status, payload = self.request(
            "POST",
            "/files",
            extra_headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            raw_data=body,
            expect_json=True,
        )
        if status >= 400:
            message = payload.get("errors", [{}])[0].get("message", "unknown error")
            raise RuntimeError(f"Failed to upload {filename}: HTTP {status} {message}")

        data = payload.get("data") or {}
        return data.get("id")


def extract_section(page_html: str, section_number: str) -> str:
    start_re = re.compile(rf"<!---\s*#####\s*#{re.escape(section_number)}\b.*?-->", re.IGNORECASE | re.DOTALL)
    start = start_re.search(page_html)
    if not start:
        return ""

    next_re = re.compile(r"<!---\s*#####\s*#", re.IGNORECASE)
    nxt = next_re.search(page_html, start.end())
    end = nxt.start() if nxt else len(page_html)
    return page_html[start.start() : end]


def extract_box(section_html: str, box_id: str) -> str:
    # Most boxes close with a marker like <!--- #123 ---></div>
    box_re = re.compile(
        rf'<div id="{re.escape(box_id)}"[^>]*>(.*?)<!---\s*#\d+\s*--+>\s*</div>',
        re.IGNORECASE | re.DOTALL,
    )
    match = box_re.search(section_html)
    if match:
        return match.group(1)

    # Fallback if marker format is slightly different
    box_re_fallback = re.compile(
        rf'<div id="{re.escape(box_id)}"[^>]*>(.*?)</div>',
        re.IGNORECASE | re.DOTALL,
    )
    match = box_re_fallback.search(section_html)
    return match.group(1) if match else ""


def parse_title_info(page_html: str) -> dict[str, str]:
    out: dict[str, str] = {}
    title_match = re.search(r"<title>(.*?)</title>", page_html, re.IGNORECASE | re.DOTALL)
    if not title_match:
        return out

    title = clean_text(title_match.group(1))
    out["title"] = title

    pattern = re.compile(
        r"The Cure live concert:\s*([0-9-]{10})\s*(.*?)\s*-\s*(.*?)\s*\((.*?)\)",
        re.IGNORECASE,
    )
    match = pattern.search(title)
    if match:
        out["date"] = match.group(1).strip()
        out["city"] = match.group(2).strip()
        out["venue"] = match.group(3).strip()
        out["country"] = match.group(4).strip()

    return out


def parse_trivia(section_html: str) -> tuple[dict[str, str], list[str]]:
    facts: dict[str, str] = {}
    for match in re.finditer(
        r'<span class="subheadline">\s*([^:<]+):\s*</span>\s*(.*?)<br>',
        section_html,
        re.IGNORECASE | re.DOTALL,
    ):
        label = clean_text(match.group(1)).strip()
        value = clean_text(match.group(2)).strip()
        if label and value:
            facts[label] = value

    notes = []
    for li in re.findall(r"<li[^>]*>(.*?)</li>", section_html, re.IGNORECASE | re.DOTALL):
        value = clean_text(li)
        if value:
            notes.append(value)

    return facts, notes


def parse_banter(section_html: str) -> tuple[list[dict[str, str]], str | None]:
    banter: list[dict[str, str]] = []
    current_section = "Mainset"

    token_re = re.compile(
        r'<div class="concertpart">([^<]+)</div>|<div class="announce">(.*?)</div>',
        re.IGNORECASE | re.DOTALL,
    )
    for match in token_re.finditer(section_html):
        concert_part = match.group(1)
        announce = match.group(2)

        if concert_part:
            current_section = clean_text(concert_part) or current_section
            continue

        if announce is None:
            continue

        text = clean_text(announce)
        if not text or text == "-":
            continue

        banter.append({"section": current_section, "text": text})

    note_match = re.search(r'<div class="note">(.*?)</div>', section_html, re.IGNORECASE | re.DOTALL)
    note_text = clean_text(note_match.group(1)) if note_match else None

    return banter, note_text


def parse_media_links(section_html: str) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []

    descriptions = [
        clean_text(x)
        for x in re.findall(
            r'<div class="videodescription">\s*&bull;\s*(.*?)</div>',
            section_html,
            re.IGNORECASE | re.DOTALL,
        )
    ]

    srcs = re.findall(r'data-src="([^"]+)"', section_html, re.IGNORECASE)
    for i, src in enumerate(srcs):
        entry = {"url": src}
        if i < len(descriptions) and descriptions[i]:
            entry["description"] = descriptions[i]
        links.append(entry)

    return unique_preserve_order(links)


def parse_audio_links(section_html: str, page_url: str) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    for href, text in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', section_html, re.IGNORECASE | re.DOTALL):
        absolute = urllib.parse.urljoin(page_url, href)
        label = clean_text(text)
        item = {"url": absolute}
        if label:
            item["label"] = label
        links.append(item)
    return unique_preserve_order(links)


def parse_image_urls(section_html: str, page_url: str, img_id: str | None = None) -> list[str]:
    urls: list[str] = []
    if img_id:
        pattern = re.compile(rf'<img[^>]*id="{re.escape(img_id)}"[^>]*src="([^"]+)"', re.IGNORECASE)
        candidates = pattern.findall(section_html)
    else:
        candidates = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>\s*<img', section_html, re.IGNORECASE | re.DOTALL)

    for src in candidates:
        urls.append(urllib.parse.urljoin(page_url, src))

    # Some pages use direct img tags inside galleries without anchors
    if not urls and not img_id:
        for src in re.findall(r'<img[^>]*src="([^"]+)"', section_html, re.IGNORECASE):
            if "sub_img_photo" in src.lower():
                urls.append(urllib.parse.urljoin(page_url, src))

    return unique_preserve_order(urls)


def parse_recordings(section_html: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []

    def extract_value(row_html: str, marker: str) -> str:
        match = re.search(
            rf'<!---\s*{marker}\s*--+>\s*<div id="rec-329"[^>]*>(.*?)</div>',
            row_html,
            re.IGNORECASE | re.DOTALL,
        )
        if not match:
            return ""
        value = clean_text(match.group(1)).strip()
        if value in {"", "-", "&nbsp;"}:
            return ""
        return value

    parts = section_html.split('<div id="rec-326">')
    for part in parts[1:]:
        row_html = part.split('<div id="rec-326">', 1)[0]
        row = {
            "source": extract_value(row_html, "SOURCE"),
            "format": extract_value(row_html, "FORMAT"),
            "initials": extract_value(row_html, "INITIALS"),
            "equipment": extract_value(row_html, "EQUIPMENT"),
            "note": extract_value(row_html, "NOTE"),
        }
        if any(v for v in row.values()):
            rows.append(row)

    return rows


def parse_credit(section_html: str, page_url: str) -> dict[str, str]:
    credit: dict[str, str] = {}
    anchor = re.search(
        r'thanks to\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
        section_html,
        re.IGNORECASE | re.DOTALL,
    )
    if anchor:
        credit["name"] = clean_text(anchor.group(2))
        credit["url"] = urllib.parse.urljoin(page_url, anchor.group(1))
    return credit


def extract_lineup_names(raw_line: str) -> list[str]:
    text = (raw_line or "").strip()
    if not text:
        return []

    lowered = text.lower()
    if lowered in {"guests:", "guest:"}:
        return []
    if lowered.startswith("this was "):
        return []
    if lowered.startswith("before and after "):
        return []

    # Remove explanatory tail phrases frequently found in lineup notes.
    text = re.split(r"\s+on\s+", text, maxsplit=1, flags=re.IGNORECASE)[0]
    text = re.split(
        r",\s*(replacing|who|both|all|before|after)\b",
        text,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]

    # Strip role-like suffixes (e.g. "Porl Thompson guitar").
    text = re.sub(
        r"\s+(guitar|vocals?|bass|drums?|keyboard|keyboards?)$",
        "",
        text,
        flags=re.IGNORECASE,
    )

    candidates: list[str] = []
    chunks = re.split(r"\s*,\s*|\s+and\s+", text, flags=re.IGNORECASE)
    for chunk in chunks:
        chunk = chunk.strip(" .;:-")
        if not chunk:
            continue

        # Keep only likely person names: 1-4 capitalized words.
        if re.match(r"^[A-Z][A-Za-z'`.-]+(?:\s+[A-Z][A-Za-z'`.-]+){0,3}$", chunk):
            if chunk.lower().startswith("the "):
                continue
            candidates.append(chunk)

    if not candidates and re.match(r"^[A-Z][A-Za-z'`.-]+(?:\s+[A-Z][A-Za-z'`.-]+){0,3}$", text):
        candidates.append(text.strip())

    return unique_preserve_order(candidates)


def parse_cure_concert_page(page_url: str, page_html: str) -> dict[str, Any]:
    parsed: dict[str, Any] = {
        "page_url": page_url,
        "title_info": parse_title_info(page_html),
    }

    lineup_section = extract_section(page_html, "005")
    trivia_section = extract_section(page_html, "006")
    soundcheck_section = extract_section(page_html, "007")
    announcements_section = extract_section(page_html, "008")
    ticket_section = extract_section(page_html, "010")
    photo_section = extract_section(page_html, "016")
    video_section = extract_section(page_html, "017")
    audio_section = extract_section(page_html, "018")
    recordings_section = extract_section(page_html, "022")
    support_section = extract_section(page_html, "023")
    additional_section = extract_section(page_html, "024")

    parsed["lineup"] = split_nonempty_lines(extract_box(lineup_section, "box-lineup"))
    parsed["support"] = split_nonempty_lines(extract_box(support_section, "box-support"))
    parsed["soundcheck"] = split_nonempty_lines(extract_box(soundcheck_section, "box-soundcheck"))

    facts, trivia_notes = parse_trivia(trivia_section)
    parsed["facts_map"] = facts
    parsed["trivia_notes"] = trivia_notes

    banter, banter_note = parse_banter(announcements_section)
    parsed["stage_banter"] = banter
    parsed["stage_banter_note"] = banter_note

    parsed["ticket_images"] = parse_image_urls(ticket_section, page_url, img_id="scan")
    parsed["photo_images"] = parse_image_urls(photo_section, page_url)
    parsed["video_links"] = parse_media_links(video_section)
    parsed["audio_links"] = parse_audio_links(audio_section, page_url)
    parsed["recordings"] = parse_recordings(recordings_section)

    ticket_credit = parse_credit(ticket_section, page_url)
    photo_credit = parse_credit(photo_section, page_url)
    parsed["ticket_credit"] = ticket_credit
    parsed["photo_credit"] = photo_credit

    additional_links = []
    for href, text in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', additional_section, re.IGNORECASE | re.DOTALL):
        url = urllib.parse.urljoin(page_url, href)
        label = clean_text(text)
        if url:
            item = {"url": url}
            if label:
                item["label"] = label
            additional_links.append(item)
    parsed["additional_links"] = unique_preserve_order(additional_links)

    return parsed


def fetch_text(http: HTTPClient, url: str) -> tuple[int, str]:
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
    status, payload = http.request("GET", url, headers=headers, expect_json=False)
    if isinstance(payload, bytes):
        text = payload.decode("utf-8", "ignore")
    else:
        text = str(payload)
    return status, text


def fetch_bytes(http: HTTPClient, url: str) -> tuple[int, bytes]:
    headers = {"User-Agent": USER_AGENT}
    status, payload = http.request("GET", url, headers=headers, expect_json=False)
    if isinstance(payload, bytes):
        return status, payload
    return status, str(payload).encode("utf-8", "ignore")


def infer_file_name(source_url: str, media_kind: str) -> str:
    parsed = urllib.parse.urlparse(source_url)
    basename = os.path.basename(parsed.path) or f"{media_kind}.bin"
    basename = re.sub(r"[^A-Za-z0-9._-]", "-", basename)
    digest = sha8(source_url)
    return f"cure-concerts-{media_kind}-{digest}-{basename}"


def determine_mime(filename: str, data: bytes) -> str:
    mime = mimetypes.guess_type(filename)[0]
    if mime:
        return mime

    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG"):
        return "image/png"
    if data.startswith(b"GIF8"):
        return "image/gif"

    return "application/octet-stream"


def build_facts_text(facts_map: dict[str, str], trivia_notes: list[str]) -> str:
    lines = [f"{k}: {v}" for k, v in facts_map.items() if v]
    if trivia_notes:
        for item in trivia_notes:
            lines.append(f"Note: {item}")
    return "\n".join(lines).strip()


def build_credits_text(page_url: str, ticket_credit: dict[str, str], photo_credit: dict[str, str], stage_banter_note: str | None) -> str:
    lines = [f"Primary source: {page_url}"]

    if ticket_credit.get("name"):
        if ticket_credit.get("url"):
            lines.append(f"Ticket credit: {ticket_credit['name']} ({ticket_credit['url']})")
        else:
            lines.append(f"Ticket credit: {ticket_credit['name']}")

    if photo_credit.get("name"):
        if photo_credit.get("url"):
            lines.append(f"Photo credit: {photo_credit['name']} ({photo_credit['url']})")
        else:
            lines.append(f"Photo credit: {photo_credit['name']}")

    if stage_banter_note:
        lines.append(f"Stage banter note: {stage_banter_note}")

    return "\n".join(unique_preserve_order(lines))


def match_score(setlist: dict[str, Any], parsed: dict[str, Any]) -> int:
    title = normalize((parsed.get("title_info") or {}).get("title", ""))
    venue = normalize(setlist.get("venue", ""))
    city = normalize(setlist.get("city", ""))
    country = normalize(setlist.get("country", ""))

    score = 0
    if venue and venue in title:
        score += 4
    if city and city in title:
        score += 3
    if country and country in title:
        score += 2

    parsed_venue = normalize((parsed.get("title_info") or {}).get("venue", ""))
    parsed_city = normalize((parsed.get("title_info") or {}).get("city", ""))
    if venue and parsed_venue and venue in parsed_venue:
        score += 3
    if city and parsed_city and city in parsed_city:
        score += 2

    return score


def ensure_schema(client: DirectusClient, dry_run: bool) -> None:
    print("Ensuring schema fields...")

    setlist_fields = [
        ("cure_concerts_url", "string", {"interface": "input", "note": "Source page on cure-concerts.de"}, {"max_length": 500}),
        ("facts", "text", {"interface": "input-multiline", "note": "Structured concert facts/trivia"}, None),
        ("credits", "text", {"interface": "input-multiline", "note": "Credits and source attribution"}, None),
        ("performing_musicians", "json", {"interface": "input-code", "note": "Lineup per concert"}, None),
        ("support_acts", "json", {"interface": "input-code", "note": "Support acts"}, None),
        ("soundcheck", "json", {"interface": "input-code", "note": "Soundcheck songs"}, None),
        ("stage_banter", "json", {"interface": "input-code", "note": "Stage banter excerpts"}, None),
        ("ticket_assets", "json", {"interface": "input-code", "note": "Ticket image assets"}, None),
        ("photo_assets", "json", {"interface": "input-code", "note": "Concert photo assets"}, None),
        ("video_links", "json", {"interface": "input-code", "note": "Video links"}, None),
        ("audio_links", "json", {"interface": "input-code", "note": "Audio links"}, None),
        ("recordings", "json", {"interface": "input-code", "note": "Known recording metadata"}, None),
        ("additional_links", "json", {"interface": "input-code", "note": "Additional external links"}, None),
        ("last_enriched_at", "timestamp", {"interface": "datetime", "note": "Last automated enrichment timestamp"}, None),
    ]

    for field, ftype, meta, schema in setlist_fields:
        client.ensure_field("setlists", field, ftype, meta=meta, schema=schema, dry_run=dry_run)

    client.ensure_field(
        "photos",
        "setlist",
        "integer",
        meta={"interface": "select-dropdown-m2o", "width": "half", "note": "Related setlist"},
        schema=None,
        dry_run=dry_run,
    )
    client.ensure_relation("photos", "setlist", "setlists", dry_run=dry_run)

    client.ensure_field(
        "members",
        "aliases",
        "json",
        meta={"interface": "tags", "note": "Known aliases / spelling variants"},
        schema=None,
        dry_run=dry_run,
    )


def build_member_lookup(members: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for m in members:
        name = (m.get("name") or "").strip()
        if not name:
            continue
        lookup[normalize(name)] = m

        aliases = m.get("aliases")
        if isinstance(aliases, list):
            for alias in aliases:
                if isinstance(alias, str) and alias.strip():
                    lookup[normalize(alias)] = m

    # Common lineup name variants
    hard_aliases = {
        "laurencetolhurst": "lol tolhurst",
        "pearlthompson": "porl thompson",
        "simongallup": "simon gallup",
        "rogerodonnell": "roger o'donnell",
        "mattheuhartley": "matthieu hartley",
    }

    for alias_norm, canonical in hard_aliases.items():
        target = lookup.get(normalize(canonical))
        if target:
            lookup[alias_norm] = target

    return lookup


def upsert_member(
    client: DirectusClient,
    member_name: str,
    member_lookup: dict[str, dict[str, Any]],
    supports_aliases: bool,
    dry_run: bool,
) -> dict[str, Any]:
    key = normalize(member_name)
    existing = member_lookup.get(key)
    if existing:
        return existing

    payload = {
        "name": member_name,
        "slug": slugify(member_name),
        "bio": "Auto-created from Cure concert lineup import.",
        "is_current_member": False,
    }
    if supports_aliases:
        payload["aliases"] = []

    if dry_run:
        created = {"id": -1, "name": member_name, "slug": payload["slug"]}
        if supports_aliases:
            created["aliases"] = []
        member_lookup[key] = created
        return created

    status, res = client.create_item("members", payload)
    if status >= 400:
        message = res.get("errors", [{}])[0].get("message", "unknown error")
        print(f"  ! member create failed: {member_name}: HTTP {status} {message}")
        fallback = {"id": None, "name": member_name, "aliases": []}
        member_lookup[key] = fallback
        return fallback

    data = res.get("data") or {}
    member_lookup[key] = data
    print(f"  + member: {member_name} (id={data.get('id')})")
    return data


def should_skip_setlist(setlist: dict[str, Any], force: bool) -> bool:
    if force:
        return False
    return bool(setlist.get("last_enriched_at") and setlist.get("cure_concerts_url"))


def build_asset_entry(source_url: str, file_id: str | None, credit: dict[str, str] | None = None) -> dict[str, Any]:
    entry: dict[str, Any] = {"source_url": source_url}
    if file_id:
        entry["file_id"] = file_id
    if credit:
        if credit.get("name"):
            entry["credit_name"] = credit["name"]
        if credit.get("url"):
            entry["credit_url"] = credit["url"]
    return entry


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich setlists from cure-concerts.de")
    parser.add_argument("--token", default=os.getenv("DIRECTUS_TOKEN"), help="Directus API token")
    parser.add_argument("--base", default=os.getenv("DIRECTUS_BASE", DIRECTUS_BASE_DEFAULT), help="Directus base URL")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of setlists to process (0 = all)")
    parser.add_argument("--start-date", default="", help="Process setlists from date (YYYY-MM-DD)")
    parser.add_argument("--force", action="store_true", help="Re-enrich even if already enriched")
    parser.add_argument("--dry-run", action="store_true", help="Preview actions without writing")
    parser.add_argument("--max-photos-per-show", type=int, default=0, help="Cap photo uploads per concert (0 = all)")
    parser.add_argument("--no-upload-images", action="store_true", help="Do not upload ticket/photo images to Directus files")
    parser.add_argument(
        "--create-members",
        action="store_true",
        help="Create missing members from lineup names (disabled by default to avoid bad member rows)",
    )
    parser.add_argument("--sleep-ms", type=int, default=120, help="Delay between external page requests")
    parser.add_argument("--http-timeout", type=int, default=20, help="HTTP timeout in seconds")
    parser.add_argument("--http-retries", type=int, default=2, help="HTTP retry attempts")
    parser.add_argument("--skip-schema", action="store_true", help="Skip schema checks/changes")

    args = parser.parse_args()

    if not args.token:
        print("Missing token. Provide --token or DIRECTUS_TOKEN.", file=sys.stderr)
        sys.exit(1)

    http = HTTPClient(retries=max(1, args.http_retries), timeout=max(5, args.http_timeout))
    client = DirectusClient(args.base, args.token, http)

    if not args.skip_schema:
        ensure_schema(client, dry_run=args.dry_run)

    print("Loading setlists...")
    try:
        setlists = client.fetch_all_items(
            "setlists",
            fields=(
                "id,date,venue,city,country,tour_name,slug,notes,venue_image,"
                "cure_concerts_url,last_enriched_at"
            ),
            sort="date",
            page_size=500,
        )
    except RuntimeError as exc:
        if args.dry_run:
            setlists = client.fetch_all_items(
                "setlists",
                fields="id,date,venue,city,country,tour_name,slug,notes,venue_image",
                sort="date",
                page_size=500,
            )
        else:
            raise exc
    print(f"  loaded {len(setlists)} setlists")

    if args.start_date:
        setlists = [s for s in setlists if (s.get("date") or "")[:10] >= args.start_date]
        print(f"  after start-date filter: {len(setlists)}")

    if args.limit > 0:
        setlists = setlists[: args.limit]

    try:
        members = client.fetch_all_items("members", fields="id,name,slug,aliases", sort="name", page_size=500)
    except RuntimeError as exc:
        if args.dry_run:
            members = client.fetch_all_items("members", fields="id,name,slug", sort="name", page_size=500)
        else:
            raise exc
    members_support_aliases = any("aliases" in m for m in members)
    member_lookup = build_member_lookup(members)
    print(f"Loaded {len(members)} members")

    file_by_name: dict[str, str] = {}
    print("File listing not used (token has no directus_files read access)")

    try:
        existing_photos = client.fetch_all_items(
            "photos",
            fields="id,source_url,setlist,image_file,title",
            page_size=500,
        )
    except RuntimeError as exc:
        if args.dry_run:
            existing_photos = client.fetch_all_items(
                "photos",
                fields="id,source_url,image_file,title",
                page_size=500,
            )
        else:
            raise exc
    photo_by_source_url = {
        p.get("source_url"): p
        for p in existing_photos
        if p.get("source_url")
    }
    print(f"Loaded {len(photo_by_source_url)} existing photos with source_url")

    page_cache: dict[str, dict[str, Any] | None] = {}

    total = 0
    enriched = 0
    skipped = 0
    missing_pages = 0
    failed = 0
    uploaded_files = 0
    created_photos = 0

    for setlist in setlists:
        total += 1

        if should_skip_setlist(setlist, args.force):
            skipped += 1
            continue

        raw_date = (setlist.get("date") or "")[:10]
        if not raw_date or len(raw_date) != 10:
            skipped += 1
            continue

        page_url = f"{CURE_CONCERTS_BASE}/concerts/{raw_date}.php"

        parsed = page_cache.get(raw_date)
        if raw_date not in page_cache:
            status, page_html = fetch_text(http, page_url)
            if status >= 400 or "The Cure live concert" not in page_html:
                page_cache[raw_date] = None
                parsed = None
            else:
                parsed = parse_cure_concert_page(page_url, page_html)
                page_cache[raw_date] = parsed

            # Respect source site with a small delay
            time.sleep(max(0, args.sleep_ms) / 1000.0)

        if not parsed:
            missing_pages += 1
            continue

        if match_score(setlist, parsed) <= 0:
            # Conservative guard to avoid wrong date/page mapping
            skipped += 1
            continue

        lineup_names: list[str] = []
        for raw_name in parsed.get("lineup", []):
            extracted = extract_lineup_names(raw_name)
            if extracted:
                lineup_names.extend(extracted)
            else:
                cleaned = raw_name.strip()
                if cleaned:
                    lineup_names.append(cleaned)
        lineup_names = unique_preserve_order(lineup_names)

        lineup_entries = []
        for name in lineup_names:
            member = member_lookup.get(normalize(name))
            if not member and args.create_members:
                member = upsert_member(
                    client,
                    name,
                    member_lookup,
                    supports_aliases=members_support_aliases,
                    dry_run=args.dry_run,
                )
            lineup_entries.append({"name": name, "member_id": (member or {}).get("id")})

        ticket_assets = []
        photo_assets = []

        upload_images = not args.no_upload_images

        def ensure_uploaded(source_url: str, media_kind: str) -> str | None:
            nonlocal uploaded_files

            existing_photo = photo_by_source_url.get(source_url)
            if isinstance(existing_photo, dict) and existing_photo.get("image_file"):
                return existing_photo.get("image_file")

            file_name = infer_file_name(source_url, media_kind)
            existing_file_id = file_by_name.get(file_name)
            if existing_file_id:
                return existing_file_id

            if not upload_images:
                return None

            status, blob = fetch_bytes(http, source_url)
            if status >= 400:
                return None

            mime = determine_mime(file_name, blob)
            file_id = client.upload_file(file_name, blob, mime, title=file_name, dry_run=args.dry_run)
            if file_id:
                file_by_name[file_name] = file_id
                uploaded_files += 1
            return file_id

        def ensure_photo_item(
            source_url: str,
            file_id: str | None,
            media_kind: str,
            credit: dict[str, str] | None,
            index: int,
        ) -> None:
            nonlocal created_photos
            existing = photo_by_source_url.get(source_url)
            if existing:
                if (
                    isinstance(existing, dict)
                    and existing.get("id")
                    and existing.get("setlist") in (None, "")
                    and setlist.get("id")
                    and not args.dry_run
                ):
                    patch_status, _ = client.patch_item("photos", existing.get("id"), {"setlist": setlist.get("id")})
                    if patch_status < 400:
                        existing["setlist"] = setlist.get("id")
                return

            title_prefix = "Ticket" if media_kind == "ticket" else "Concert Photo"
            title = f"{title_prefix}: {setlist.get('venue') or 'Unknown Venue'} ({raw_date})"
            if index > 1:
                title += f" #{index}"

            tags = ["fan"] if media_kind == "ticket" else ["live"]
            description = f"Imported from cure-concerts.de ({media_kind})."
            if credit and credit.get("name"):
                description += f" Credit: {credit['name']}."

            payload: dict[str, Any] = {
                "title": title,
                "description": description,
                "source_url": source_url,
                "setlist": setlist.get("id"),
                "date_taken": raw_date,
                "formatted_date": raw_date,
                "location": ", ".join(
                    [x for x in [setlist.get("city"), setlist.get("country")] if x]
                )
                or None,
                "tour": setlist.get("tour_name") or None,
                "tags": tags,
                "is_fan_submitted": True,
            }
            if file_id:
                payload["image_file"] = file_id
                payload["image_url"] = f"{args.base.rstrip('/')}/assets/{file_id}"
            else:
                payload["image_url"] = source_url

            if args.dry_run:
                print(f"[DRY] create photo item: {title}")
                photo_by_source_url[source_url] = {"id": f"dry-{sha8(source_url)}", "source_url": source_url}
                created_photos += 1
                return

            status, res = client.create_item("photos", payload)
            if status >= 400 and "setlist" in payload:
                # Fallback in case the relation field cannot be written for this token.
                payload.pop("setlist", None)
                status, res = client.create_item("photos", payload)
            if status >= 400:
                message = res.get("errors", [{}])[0].get("message", "unknown error")
                print(f"  ! photo create failed ({source_url}): HTTP {status} {message}")
                return

            data = res.get("data") or {}
            photo_by_source_url[source_url] = data
            created_photos += 1

        ticket_credit = parsed.get("ticket_credit") or {}
        for idx, source_url in enumerate(parsed.get("ticket_images", []), start=1):
            file_id = ensure_uploaded(source_url, "ticket")
            ticket_assets.append(build_asset_entry(source_url, file_id, ticket_credit))
            ensure_photo_item(source_url, file_id, "ticket", ticket_credit, idx)

        photo_credit = parsed.get("photo_credit") or {}
        photo_urls = parsed.get("photo_images", [])
        if args.max_photos_per_show > 0:
            photo_urls = photo_urls[: args.max_photos_per_show]

        for idx, source_url in enumerate(photo_urls, start=1):
            file_id = ensure_uploaded(source_url, "photo")
            photo_assets.append(build_asset_entry(source_url, file_id, photo_credit))
            ensure_photo_item(source_url, file_id, "photo", photo_credit, idx)

        facts_text = build_facts_text(parsed.get("facts_map", {}), parsed.get("trivia_notes", []))
        credits_text = build_credits_text(
            page_url,
            parsed.get("ticket_credit") or {},
            parsed.get("photo_credit") or {},
            parsed.get("stage_banter_note"),
        )

        payload_all = {
            "cure_concerts_url": page_url,
            "facts": facts_text or None,
            "credits": credits_text or None,
            "performing_musicians": lineup_entries or None,
            "support_acts": parsed.get("support") or None,
            "soundcheck": parsed.get("soundcheck") or None,
            "stage_banter": parsed.get("stage_banter") or None,
            "ticket_assets": ticket_assets or None,
            "photo_assets": photo_assets or None,
            "video_links": parsed.get("video_links") or None,
            "audio_links": parsed.get("audio_links") or None,
            "recordings": parsed.get("recordings") or None,
            "additional_links": parsed.get("additional_links") or None,
            "last_enriched_at": now_iso(),
        }
        payload = payload_all

        if args.dry_run:
            print(
                f"[DRY] setlist {setlist.get('id')} {raw_date} -> "
                f"lineup={len(lineup_entries)} support={len(parsed.get('support', []))} "
                f"soundcheck={len(parsed.get('soundcheck', []))} photos={len(photo_assets)} "
                f"tickets={len(ticket_assets)} videos={len(parsed.get('video_links', []))} "
                f"recordings={len(parsed.get('recordings', []))}"
            )
            enriched += 1
            continue

        status, res = client.patch_item("setlists", setlist.get("id"), payload)
        if status >= 400:
            message = res.get("errors", [{}])[0].get("message", "unknown error")
            print(f"  ! setlist patch failed id={setlist.get('id')}: HTTP {status} {message}")
            failed += 1
            continue

        enriched += 1

        if enriched % 25 == 0:
            print(
                f"Progress: enriched={enriched} skipped={skipped} missing_pages={missing_pages} "
                f"failed={failed} uploaded_files={uploaded_files} created_photos={created_photos}"
            )

    print("\n=== Done ===")
    print(f"Processed: {total}")
    print(f"Enriched: {enriched}")
    print(f"Skipped: {skipped}")
    print(f"Missing pages: {missing_pages}")
    print(f"Failed patches: {failed}")
    print(f"Uploaded files: {uploaded_files}")
    print(f"Created photos: {created_photos}")


if __name__ == "__main__":
    main()
