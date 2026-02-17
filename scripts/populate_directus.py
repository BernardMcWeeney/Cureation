#!/usr/bin/env python3
"""
Populate Cureation Directus backend with complete The Cure discography data.
- Updates all 14 albums with descriptions, labels, producers, type
- Creates songs for all 12 albums currently missing them
"""

import json
import time
import urllib.request
import urllib.error

BASE = "https://dash.cureation.net"
TOKEN = "Akcr1K1ZjI6BgJnt9kUw2HJT-_8oljun"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}


def req(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()[:200]}")
        return None


def patch_album(album_id, payload):
    result = req("PATCH", f"/items/discography/{album_id}", payload)
    if result and "data" in result:
        print(f"  ✓ Updated album {album_id}: {result['data'].get('title')}")
    return result


def create_song(payload):
    result = req("POST", "/items/songs", payload)
    if result and "data" in result:
        d = result["data"]
        print(f"    + Song {d.get('track_number', '?'):>2}. {d.get('title')}")
    return result


# =============================================================================
# ALBUM METADATA UPDATES
# =============================================================================

ALBUM_UPDATES = {
    8: {  # Three Imaginary Boys
        "type": "studio",
        "label": "Fiction Records",
        "producer": "Chris Parry",
        "description": (
            "The Cure's debut album — a raw, post-punk record largely shaped by producer "
            "Chris Parry. Robert Smith has since distanced himself from it, feeling it "
            "misrepresented the band's vision, but it contains the seeds of their future "
            "sound and features early fan favourites including 'Killing an Arab' and "
            "'10:15 Saturday Night.'"
        ),
    },
    9: {  # Seventeen Seconds
        "type": "studio",
        "label": "Fiction Records",
        "producer": "Mike Hedges and The Cure",
        "description": (
            "The Cure's second album — a minimalist, reverb-soaked step into pure "
            "atmosphere and dread. Shedding much of the debut's post-punk energy, it "
            "established their signature introspective sound and contains the timeless "
            "classic 'A Forest.'"
        ),
    },
    10: {  # Faith
        "type": "studio",
        "label": "Fiction Records",
        "producer": "Mike Hedges and The Cure",
        "description": (
            "The second part of The Cure's celebrated 'dark trilogy' — a bleak, gothic "
            "meditation on spiritual emptiness and disillusionment. Steeped in mournful "
            "atmosphere, Faith deepened the sonic palette of Seventeen Seconds and "
            "earned the band a devoted cult following."
        ),
    },
    11: {  # Pornography
        "type": "studio",
        "label": "Fiction Records",
        "producer": "Phil Thornalley and The Cure",
        "description": (
            "The harrowing conclusion to The Cure's 'dark trilogy' — a claustrophobic, "
            "overwhelming descent into noise and despair, recorded at a time of intense "
            "personal and band crisis. Pornography stands as one of the darkest, most "
            "visceral albums in rock history and is a landmark of gothic and post-punk."
        ),
    },
    12: {  # The Top
        "type": "studio",
        "label": "Fiction Records",
        "producer": "David M. Allen and The Cure",
        "description": (
            "The Cure's fifth studio album — a transitional, psychedelic record largely "
            "recorded by Robert Smith alone following the near-dissolution of the band "
            "after Pornography. Eclectic and unique, it bridges the darkness of the "
            "trilogy and the commercial pop breakthrough to come."
        ),
    },
    13: {  # The Head on the Door
        "type": "studio",
        "label": "Fiction Records (UK) / Elektra (US)",
        "producer": "David M. Allen and The Cure",
        "description": (
            "The Cure's sixth studio album and their first major commercial breakthrough "
            "— a tightly crafted collection of varied, atmospheric pop songs. 'In Between "
            "Days,' 'Close to Me,' and 'A Night Like This' became career-defining "
            "anthems, cementing the band as one of the defining acts of the 1980s."
        ),
    },
    14: {  # Kiss Me, Kiss Me, Kiss Me
        "type": "studio",
        "label": "Fiction Records (UK) / Elektra (US)",
        "producer": "David M. Allen and The Cure",
        "description": (
            "The Cure's ambitious double album — an 18-track odyssey swinging between "
            "romantic pop ('Just Like Heaven'), driving rock ('Why Can't I Be You?') and "
            "dark atmosphere. It brought the band global superstardom and remains one of "
            "the most beloved and varied albums in their catalogue."
        ),
    },
    15: {  # Wild Mood Swings
        "type": "studio",
        "label": "Fiction Records (UK) / Elektra (US)",
        "producer": "Robert Smith and Steve Lyon",
        "description": (
            "The Cure's tenth studio album — a deliberately eclectic, stylistically "
            "restless record following the massive success of Wish. Underrated on release, "
            "its playful range, orchestral flourishes, and darker undercurrents have "
            "earned it a devoted cult following over the years."
        ),
    },
    16: {  # Bloodflowers
        "type": "studio",
        "label": "Fiction Records (UK) / Elektra (US)",
        "producer": "Robert Smith and Paul Corkett",
        "description": (
            "The Cure's eleventh studio album and, in Robert Smith's own words, the "
            "conclusion to the trilogy begun with Seventeen Seconds. A hushed, slow-"
            "burning return to pure atmosphere and melancholy, Bloodflowers is deeply "
            "moving and one of their most underappreciated works."
        ),
    },
    17: {  # The Cure (self-titled)
        "type": "studio",
        "label": "I AM / Geffen Records",
        "producer": "Ross Robinson",
        "description": (
            "The Cure's self-titled twelfth album — an unexpected and bold collaboration "
            "with producer Ross Robinson (known for his raw, visceral work with nu-metal "
            "acts). Heavier and more abrasive than anything before it, the record divided "
            "opinion but stands as a genuine artistic risk."
        ),
    },
    18: {  # 4:13 Dream
        "type": "studio",
        "label": "Geffen Records / Fiction Records",
        "producer": "Robert Smith and Tim Palmer",
        "description": (
            "The Cure's thirteenth studio album — originally planned as a double record, "
            "the released version presents eleven melodic, guitar-driven tracks. More "
            "accessible than its predecessor, 4:13 Dream was warmly received by fans "
            "and features some of Robert Smith's most direct songwriting."
        ),
    },
    19: {  # Songs of a Lost World
        "type": "studio",
        "label": "Fiction Records",
        "producer": "Robert Smith and Paul Corkett",
        "description": (
            "The Cure's fourteenth studio album and first in sixteen years — widely "
            "hailed on release as one of their greatest works. A sweeping eight-track "
            "meditation on grief, mortality, and loss, Songs of a Lost World arrived to "
            "near-universal critical acclaim, with many calling it a masterpiece equal "
            "to Disintegration."
        ),
    },
}

# =============================================================================
# SONGS DATA — keyed by album_id
# =============================================================================

SONGS = {
    8: [  # Three Imaginary Boys
        ("10:15 Saturday Night", 1, "2:39"),
        ("Accuracy", 2, "2:46"),
        ("Grinding Halt", 3, "2:20"),
        ("Another Day", 4, "2:55"),
        ("Object", 5, "2:28"),
        ("Subway Song", 6, "2:17"),
        ("Foxy Lady", 7, "3:17"),
        ("Meathook", 8, "2:39"),
        ("So What", 9, "3:36"),
        ("World in My Eyes", 10, "2:34"),
        ("It's Not You", 11, "2:38"),
        ("Three Imaginary Boys", 12, "3:28"),
    ],
    9: [  # Seventeen Seconds
        ("A Reflection", 1, "2:11"),
        ("Play for Today", 2, "3:27"),
        ("Secrets", 3, "3:32"),
        ("In Your House", 4, "3:44"),
        ("Three", 5, "3:06"),
        ("The Final Sound", 6, "1:12"),
        ("A Forest", 7, "5:55"),
        ("M", 8, "3:18"),
        ("At Night", 9, "4:38"),
        ("Seventeen Seconds", 10, "3:27"),
    ],
    10: [  # Faith
        ("The Holy Hour", 1, "4:56"),
        ("Primary", 2, "3:43"),
        ("Other Voices", 3, "5:06"),
        ("All Cats Are Grey", 4, "4:26"),
        ("The Funeral Party", 5, "4:12"),
        ("Doubt", 6, "3:47"),
        ("The Drowning Man", 7, "5:39"),
        ("Faith", 8, "6:09"),
    ],
    11: [  # Pornography
        ("One Hundred Years", 1, "6:38"),
        ("A Short Term Effect", 2, "4:22"),
        ("The Hanging Garden", 3, "4:33"),
        ("Siamese Twins", 4, "5:29"),
        ("The Figurehead", 5, "6:13"),
        ("A Strange Day", 6, "5:00"),
        ("Cold", 7, "5:14"),
        ("Pornography", 8, "6:30"),
    ],
    12: [  # The Top
        ("Shake Dog Shake", 1, "4:16"),
        ("Bird Mad Girl", 2, "2:51"),
        ("Wailing Wall", 3, "4:35"),
        ("Give Me It", 4, "3:20"),
        ("Dressing Up", 5, "3:36"),
        ("The Caterpillar", 6, "3:58"),
        ("Piggy in the Mirror", 7, "4:15"),
        ("The Empty World", 8, "4:40"),
        ("Bananafishbones", 9, "3:29"),
        ("The Top", 10, "4:05"),
    ],
    13: [  # The Head on the Door
        ("In Between Days", 1, "2:57"),
        ("Kyoto Song", 2, "3:56"),
        ("The Blood", 3, "3:22"),
        ("Six Different Ways", 4, "3:05"),
        ("Push", 5, "5:03"),
        ("The Baby Screams", 6, "3:03"),
        ("Close to Me", 7, "3:47"),
        ("A Night Like This", 8, "3:52"),
        ("Screw", 9, "3:36"),
        ("Sinking", 10, "6:45"),
    ],
    14: [  # Kiss Me, Kiss Me, Kiss Me
        ("The Kiss", 1, "6:04"),
        ("Catch", 2, "2:47"),
        ("Torture", 3, "4:24"),
        ("If Only Tonight We Could Sleep", 4, "4:39"),
        ("Why Can't I Be You?", 5, "3:13"),
        ("How Beautiful You Are...", 6, "5:06"),
        ("The Snakepit", 7, "5:10"),
        ("Hey You!!!", 8, "4:02"),
        ("Just Like Heaven", 9, "3:31"),
        ("All I Want", 10, "4:57"),
        ("Hot Hot Hot!!!", 11, "3:33"),
        ("One More Time", 12, "3:19"),
        ("Like Cockatoos", 13, "3:50"),
        ("Icing Sugar", 14, "4:00"),
        ("The Perfect Girl", 15, "2:57"),
        ("A Thousand Hours", 16, "3:36"),
        ("Shiver and Shake", 17, "4:05"),
        ("Fight", 18, "4:49"),
    ],
    15: [  # Wild Mood Swings
        ("Want", 1, "4:41"),
        ("Club America", 2, "4:40"),
        ("This Is a Lie", 3, "4:51"),
        ("The 13th", 4, "4:18"),
        ("Strange Attraction", 5, "4:19"),
        ("Mint Car", 6, "3:27"),
        ("Jupiter Crash", 7, "4:18"),
        ("Round & Round & Round", 8, "3:04"),
        ("Gone!", 9, "4:33"),
        ("Numb", 10, "4:12"),
        ("Return", 11, "4:48"),
        ("Trap", 12, "4:12"),
        ("Treasure", 13, "5:18"),
        ("bare", 14, "5:16"),
    ],
    16: [  # Bloodflowers
        ("Out of This World", 1, "6:41"),
        ("Watching Me Fall", 2, "11:12"),
        ("Where the Birds Always Sing", 3, "5:52"),
        ("Maybe Someday", 4, "4:45"),
        ("The Last Day of Summer", 5, "5:41"),
        ("There Is No If...", 6, "4:02"),
        ("The Loudest Sound", 7, "4:02"),
        ("39", 8, "5:47"),
        ("Bloodflowers", 9, "7:16"),
    ],
    17: [  # The Cure
        ("Lost", 1, "4:01"),
        ("Labyrinth", 2, "4:13"),
        ("Before Three", 3, "4:39"),
        ("The End of the World", 4, "3:57"),
        ("Anniversary", 5, "4:22"),
        ("Us or Them", 6, "5:03"),
        ("Alt.end", 7, "4:40"),
        ("(I Don't Know What's Going) On", 8, "3:40"),
        ("Taking Off", 9, "4:12"),
        ("Never", 10, "5:17"),
        ("The Promise", 11, "6:41"),
        ("Going Nowhere", 12, "5:40"),
    ],
    18: [  # 4:13 Dream
        ("Underneath the Stars", 1, "4:13"),
        ("The Reasons Why", 2, "3:53"),
        ("Freakshow", 3, "3:20"),
        ("Falling Apart", 4, "3:59"),
        ("The Hungry Ghost", 5, "4:52"),
        ("Switch", 6, "4:06"),
        ("The Perfect Boy", 7, "3:37"),
        ("This. Here and Now. With You.", 8, "4:48"),
        ("Sleep When I'm Dead", 9, "3:57"),
        ("The Scream", 10, "4:48"),
        ("It's Over", 11, "7:31"),
    ],
    19: [  # Songs of a Lost World
        ("Alone", 1, "7:38"),
        ("And Nothing Is Forever", 2, "7:29"),
        ("A Fragile Thing", 3, "5:49"),
        ("Warsong", 4, "6:16"),
        ("Drone:Nodrone", 5, "7:13"),
        ("I Can Never Say Goodbye", 6, "8:26"),
        ("All I Ever Am", 7, "6:05"),
        ("Endsong", 8, "10:23"),
    ],
}


def main():
    print("\n=== STEP 1: Updating album metadata ===\n")
    for album_id, updates in ALBUM_UPDATES.items():
        print(f"Updating album id={album_id}…")
        patch_album(album_id, updates)
        time.sleep(0.2)

    # Also mark Wish and Disintegration as featured if not already
    print("\nEnsuring featured albums are marked…")
    patch_album(7, {"featured": True})   # Disintegration
    patch_album(6, {"featured": False})  # Wish
    time.sleep(0.2)

    print("\n=== STEP 2: Creating songs for all missing albums ===\n")
    for album_id, songs in SONGS.items():
        print(f"\nAlbum id={album_id} — adding {len(songs)} songs:")
        for title, track_num, duration in songs:
            create_song({
                "title": title,
                "track_number": track_num,
                "duration": duration,
                "album": album_id,
            })
            time.sleep(0.15)

    print("\n=== Done! ===")
    print("\nVerifying final counts:")
    result = req("GET", "/items/discography?limit=100&fields=id,title,type")
    if result:
        albums = result["data"]
        studio = [a for a in albums if a.get("type") == "studio"]
        print(f"  Albums total: {len(albums)} ({len(studio)} typed as 'studio')")

    result = req("GET", "/items/songs?limit=1&meta=total_count")
    if result and "meta" in result:
        print(f"  Songs total: {result['meta'].get('total_count', '?')}")


if __name__ == "__main__":
    main()
