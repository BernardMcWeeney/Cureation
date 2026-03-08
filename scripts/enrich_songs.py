#!/usr/bin/env python3
"""
Enrich existing songs in Directus with writer credits, single status, etc.
Also adds country codes to setlists, and links tours to albums.
"""

import json
import urllib.request
import time
import sys

TOKEN = "dW1LA2KLXEBOYdHhofxBHcNZfgOUdsll"
BASE = "https://dash.cureation.net"

def api(endpoint, method="GET", data=None, retries=3):
    for i in range(retries):
        try:
            headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
            url = f"{BASE}{endpoint}"
            body = json.dumps(data).encode() if data else None
            req = urllib.request.Request(url, data=body, method=method, headers=headers)
            resp = urllib.request.urlopen(req)
            if method == "DELETE":
                return True
            return json.loads(resp.read())
        except Exception as e:
            if i < retries - 1:
                time.sleep(2)
            else:
                print(f"  FAILED {method} {endpoint}: {e}")
                return None

def patch_song(song_id, updates):
    r = api(f"/items/songs/{song_id}", method="PATCH", data=updates)
    return r is not None

# ============================================================
# SONG ENRICHMENT DATA
# Writer credits and singles status per album
# ============================================================

# Album 8: Three Imaginary Boys (1979)
# Writers: Robert Smith, Michael Dempsey, Lol Tolhurst (except Foxy Lady)
TIB_WRITER = "Robert Smith, Michael Dempsey, Lol Tolhurst"
ALBUM_8_SINGLES = ["10:15 Saturday Night", "Boys Don't Cry", "Killing an Arab", "Fire in Cairo"]

# Album 9: Seventeen Seconds (1980)
SS_WRITER = "Robert Smith, Simon Gallup, Lol Tolhurst, Matthieu Hartley"
ALBUM_9_SINGLES = ["A Forest", "Play for Today"]

# Album 10: Faith (1981)
FAITH_WRITER = "Robert Smith, Simon Gallup, Lol Tolhurst"
ALBUM_10_SINGLES = ["Primary", "Charlotte Sometimes"]  # Charlotte is separate single but associated

# Album 11: Pornography (1982)
PORN_WRITER = "Robert Smith, Simon Gallup, Lol Tolhurst"
ALBUM_11_SINGLES = ["The Hanging Garden"]

# Album 12: The Top (1984)
TOP_WRITER = "Robert Smith, Lol Tolhurst, Andy Anderson, Phil Thornalley, Porl Thompson"
ALBUM_12_SINGLES = ["The Caterpillar", "The Lovecats"]  # Lovecats was pre-album single

# Album 13: The Head on the Door (1985)
HOTD_WRITER = "Robert Smith"
ALBUM_13_SINGLES = ["In Between Days", "Close to Me", "A Night Like This"]

# Album 14: Kiss Me, Kiss Me, Kiss Me (1987)
KMKMKM_WRITER = "Robert Smith, Simon Gallup, Porl Thompson, Boris Williams, Lol Tolhurst"
ALBUM_14_SINGLES = ["Why Can't I Be You?", "Catch", "Just Like Heaven", "Hot Hot Hot!!!"]

# Album 6: Wish (1992) - already has some data, but enrich writers
WISH_WRITER = "Robert Smith, Simon Gallup, Porl Thompson, Boris Williams, Perry Bamonte"
ALBUM_6_SINGLES = ["High", "Friday I'm in Love", "A Letter to Elise"]

# Album 7: Disintegration (1989)
DISINT_WRITER = "Robert Smith, Simon Gallup, Porl Thompson, Boris Williams, Lol Tolhurst, Roger O'Donnell"
ALBUM_7_SINGLES = ["Lullaby", "Lovesong", "Fascination Street", "Pictures of You"]

# Album 15: Wild Mood Swings (1996)
WMS_WRITER = "Robert Smith, Simon Gallup, Roger O'Donnell, Jason Cooper, Perry Bamonte"
ALBUM_15_SINGLES = ["The 13th", "Mint Car", "Strange Attraction", "Gone!"]

# Album 16: Bloodflowers (2000)
BF_WRITER = "Robert Smith, Simon Gallup, Roger O'Donnell, Jason Cooper, Perry Bamonte"
ALBUM_16_SINGLES = ["Maybe Someday"]

# Album 17: The Cure (2004)
CURE_WRITER = "Robert Smith, Simon Gallup, Jason Cooper, Perry Bamonte, Roger O'Donnell"
ALBUM_17_SINGLES = ["The End of the World", "Taking Off", "alt.end"]

# Album 18: 4:13 Dream (2008)
DREAM_WRITER = "Robert Smith, Simon Gallup, Jason Cooper, Porl Thompson"
ALBUM_18_SINGLES = ["The Only One", "Freakshow", "Sleep When I'm Dead", "The Perfect Boy"]

# Album 19: Songs of a Lost World (2024)
SOLW_WRITER = "Robert Smith"
ALBUM_19_SINGLES = ["Alone", "A Fragile Thing", "And Nothing Is Forever"]


def enrich_all_songs():
    """Fetch all songs and update them with writer credits and single status."""
    print("Fetching all songs...")
    result = api("/items/songs?limit=-1&fields=id,title,album,track_number,writer&sort=album,track_number")
    if not result:
        print("Failed to fetch songs")
        return

    songs = result["data"]
    print(f"Found {len(songs)} songs")

    # Map album ID -> writer and singles list
    album_data = {
        8:  {"writer": TIB_WRITER, "singles": ALBUM_8_SINGLES},
        9:  {"writer": SS_WRITER, "singles": ALBUM_9_SINGLES},
        10: {"writer": FAITH_WRITER, "singles": ALBUM_10_SINGLES},
        11: {"writer": PORN_WRITER, "singles": ALBUM_11_SINGLES},
        12: {"writer": TOP_WRITER, "singles": ALBUM_12_SINGLES},
        13: {"writer": HOTD_WRITER, "singles": ALBUM_13_SINGLES},
        14: {"writer": KMKMKM_WRITER, "singles": ALBUM_14_SINGLES},
        6:  {"writer": WISH_WRITER, "singles": ALBUM_6_SINGLES},
        7:  {"writer": DISINT_WRITER, "singles": ALBUM_7_SINGLES},
        15: {"writer": WMS_WRITER, "singles": ALBUM_15_SINGLES},
        16: {"writer": BF_WRITER, "singles": ALBUM_16_SINGLES},
        17: {"writer": CURE_WRITER, "singles": ALBUM_17_SINGLES},
        18: {"writer": DREAM_WRITER, "singles": ALBUM_18_SINGLES},
        19: {"writer": SOLW_WRITER, "singles": ALBUM_19_SINGLES},
    }

    # Special writer overrides
    special_writers = {
        "Foxy Lady": "Jimi Hendrix",
        "Hello Sunshine": "Robert Smith",  # Some WMS tracks are Smith only
    }

    updated = 0
    for song in songs:
        album_id = song["album"]
        title = song["title"]
        song_id = song["id"]

        if album_id not in album_data:
            continue

        ad = album_data[album_id]
        updates = {}

        # Add writer if not already set
        if not song.get("writer"):
            writer = special_writers.get(title, ad["writer"])
            updates["writer"] = writer

        # Set is_single
        is_single = title in ad["singles"]
        updates["is_single"] = is_single

        if updates:
            ok = patch_song(song_id, updates)
            if ok:
                updated += 1
                status = " [SINGLE]" if is_single else ""
                print(f"  Updated: {title}{status}")
            time.sleep(0.1)  # Rate limit

    print(f"\nEnriched {updated} songs total")


def add_country_codes_to_setlists():
    """Add ISO country codes to all setlists based on country name."""
    print("\n" + "="*60)
    print("ADDING COUNTRY CODES TO SETLISTS")
    print("="*60)

    country_map = {
        "United States": "US", "USA": "US", "US": "US",
        "United Kingdom": "GB", "UK": "GB", "England": "GB", "Scotland": "GB", "Wales": "GB",
        "Germany": "DE", "France": "FR", "Italy": "IT", "Spain": "ES",
        "Netherlands": "NL", "Belgium": "BE", "Switzerland": "CH",
        "Austria": "AT", "Sweden": "SE", "Norway": "NO", "Denmark": "DK",
        "Finland": "FI", "Ireland": "IE", "Portugal": "PT",
        "Poland": "PL", "Czech Republic": "CZ", "Czechia": "CZ",
        "Hungary": "HU", "Romania": "RO", "Bulgaria": "BG",
        "Croatia": "HR", "Serbia": "RS", "Slovenia": "SI",
        "Greece": "GR", "Turkey": "TR", "Russia": "RU",
        "Canada": "CA", "Mexico": "MX", "Brazil": "BR",
        "Argentina": "AR", "Chile": "CL", "Colombia": "CO",
        "Australia": "AU", "New Zealand": "NZ", "Japan": "JP",
        "South Korea": "KR", "China": "CN", "India": "IN",
        "Singapore": "SG", "Malaysia": "MY", "Thailand": "TH",
        "Indonesia": "ID", "Philippines": "PH",
        "South Africa": "ZA", "Israel": "IL",
        "Latvia": "LV", "Lithuania": "LT", "Estonia": "EE",
        "Luxembourg": "LU", "Iceland": "IS", "Malta": "MT",
        "Slovakia": "SK", "Ukraine": "UA", "Belarus": "BY",
        "Georgia": "GE", "Armenia": "AM",
        "Peru": "PE", "Ecuador": "EC", "Uruguay": "UY", "Paraguay": "PY",
        "Costa Rica": "CR", "Panama": "PA", "Puerto Rico": "PR",
        "Dominican Republic": "DO", "Jamaica": "JM",
        "Taiwan": "TW", "Hong Kong": "HK",
        "United Arab Emirates": "AE", "Saudi Arabia": "SA",
        "Morocco": "MA", "Egypt": "EG", "Tunisia": "TN",
        "Northern Ireland": "GB",
    }

    result = api("/items/setlists?limit=-1&fields=id,country,country_code&sort=date")
    if not result:
        print("Failed to fetch setlists")
        return

    setlists = result["data"]
    print(f"Found {len(setlists)} setlists")

    updated = 0
    unknown = set()
    for sl in setlists:
        if sl.get("country_code"):
            continue  # Already has code

        country = (sl.get("country") or "").strip()
        code = country_map.get(country)

        if not code:
            # Try case-insensitive
            for k, v in country_map.items():
                if k.lower() == country.lower():
                    code = v
                    break

        if code:
            ok = api(f"/items/setlists/{sl['id']}", method="PATCH", data={"country_code": code})
            if ok:
                updated += 1
                print(f"  {sl['id']}: {country} -> {code}")
            time.sleep(0.1)
        elif country:
            unknown.add(country)

    if unknown:
        print(f"\nUnknown countries: {unknown}")
    print(f"Updated {updated} setlists with country codes")


def add_country_codes_to_venues():
    """Add ISO country codes to all venues."""
    print("\n" + "="*60)
    print("ADDING COUNTRY CODES TO VENUES")
    print("="*60)

    country_map = {
        "United States": "US", "USA": "US", "US": "US",
        "United Kingdom": "GB", "UK": "GB", "England": "GB", "Scotland": "GB", "Wales": "GB",
        "Germany": "DE", "France": "FR", "Italy": "IT", "Spain": "ES",
        "Netherlands": "NL", "Belgium": "BE", "Switzerland": "CH",
        "Austria": "AT", "Sweden": "SE", "Norway": "NO", "Denmark": "DK",
        "Finland": "FI", "Ireland": "IE", "Portugal": "PT",
        "Poland": "PL", "Czech Republic": "CZ", "Czechia": "CZ",
        "Hungary": "HU", "Romania": "RO", "Bulgaria": "BG",
        "Croatia": "HR", "Serbia": "RS", "Slovenia": "SI",
        "Greece": "GR", "Turkey": "TR", "Russia": "RU",
        "Canada": "CA", "Mexico": "MX", "Brazil": "BR",
        "Argentina": "AR", "Chile": "CL", "Colombia": "CO",
        "Australia": "AU", "New Zealand": "NZ", "Japan": "JP",
        "South Korea": "KR", "China": "CN", "India": "IN",
        "Singapore": "SG", "Malaysia": "MY", "Thailand": "TH",
        "Indonesia": "ID", "Philippines": "PH",
        "South Africa": "ZA", "Israel": "IL",
        "Latvia": "LV", "Lithuania": "LT", "Estonia": "EE",
        "Luxembourg": "LU", "Iceland": "IS", "Malta": "MT",
        "Slovakia": "SK", "Ukraine": "UA", "Belarus": "BY",
        "Northern Ireland": "GB",
    }

    result = api("/items/venues?limit=-1&fields=id,name,country,country_code")
    if not result:
        print("Failed to fetch venues")
        return

    venues = result["data"]
    print(f"Found {len(venues)} venues")

    updated = 0
    unknown = set()
    for v in venues:
        if v.get("country_code"):
            continue

        country = (v.get("country") or "").strip()
        code = country_map.get(country)
        if not code:
            for k, cv in country_map.items():
                if k.lower() == country.lower():
                    code = cv
                    break

        if code:
            ok = api(f"/items/venues/{v['id']}", method="PATCH", data={"country_code": code})
            if ok:
                updated += 1
            time.sleep(0.1)
        elif country:
            unknown.add(country)

    if unknown:
        print(f"Unknown countries: {unknown}")
    print(f"Updated {updated} venues with country codes")


def link_tours_to_albums():
    """Link tours to their associated albums."""
    print("\n" + "="*60)
    print("LINKING TOURS TO ALBUMS")
    print("="*60)

    # Tour name -> album ID mapping
    tour_album_map = {
        "Three Imaginary Boys Tour": 8,
        "Seventeen Seconds Tour": 9,
        "Faith Tour": 10,
        "Pornography Tour": 11,
        "The Top Tour": 12,
        "The Head on the Door Tour": 13,
        "Kiss Me Kiss Me Kiss Me Tour": 14,
        "The Prayer Tour": 7,  # Disintegration
        "Disintegration Tour": 7,
        "Wish Tour": 6,
        "Wild Mood Swings Tour": 15,
        "Swing Tour": 15,
        "Bloodflowers Tour": 16,
        "Dream Tour": 16,
        "Curiosa Festival": 17,
        "The Cure Tour 2004": 17,
        "4:13 Dream Tour": 18,
        "Shows of a Lost World": 19,
    }

    result = api("/items/tours?limit=-1&fields=id,name,associated_album")
    if not result:
        print("Failed to fetch tours")
        return

    tours = result["data"]
    print(f"Found {len(tours)} tours")

    updated = 0
    for tour in tours:
        if tour.get("associated_album"):
            continue

        name = tour["name"]
        album_id = tour_album_map.get(name)

        if not album_id:
            # Fuzzy match
            name_lower = name.lower()
            for pattern, aid in tour_album_map.items():
                if pattern.lower() in name_lower or name_lower in pattern.lower():
                    album_id = aid
                    break

        if album_id:
            ok = api(f"/items/tours/{tour['id']}", method="PATCH", data={"associated_album": album_id})
            if ok:
                updated += 1
                print(f"  {name} -> album {album_id}")
            time.sleep(0.1)

    print(f"Linked {updated} tours to albums")


if __name__ == "__main__":
    print("="*60)
    print("CUREATION DATABASE ENRICHMENT")
    print("="*60)

    enrich_all_songs()
    add_country_codes_to_setlists()
    add_country_codes_to_venues()
    link_tours_to_albums()

    print("\n" + "="*60)
    print("ALL DONE!")
    print("="*60)