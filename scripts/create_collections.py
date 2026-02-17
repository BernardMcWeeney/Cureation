#!/usr/bin/env python3
"""
Create all missing Directus collections and populate them with data.
Collections: setlists, setlist_songs, members, timeline, photos, news (already created)
"""

import json, time, urllib.request, urllib.error

BASE = "https://dash.cureation.net"
TOKEN = "Akcr1K1ZjI6BgJnt9kUw2HJT-_8oljun"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def req(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode()
        # Already exists is fine
        if "already exists" in msg or "SQLITE_ERROR" in msg:
            return {"_already_exists": True}
        print(f"  ERROR {e.code}: {msg[:300]}")
        return None


def create_collection(name, note, fields):
    print(f"Creating collection '{name}'...")
    result = req("POST", "/collections", {
        "collection": name,
        "meta": {"icon": "table_rows", "note": note},
        "schema": {"name": name},
        "fields": fields,
    })
    if result:
        if result.get("_already_exists"):
            print(f"  ~ already exists, skipping")
        elif "data" in result:
            print(f"  ✓ Created '{result['data']['collection']}'")
    return result


def post_item(collection, body):
    result = req("POST", f"/items/{collection}", body)
    if result and "data" in result:
        return result["data"]
    return None


def patch_item(collection, item_id, body):
    return req("PATCH", f"/items/{collection}/{item_id}", body)


# ---------------------------------------------------------------------------
# FIELD HELPERS
# ---------------------------------------------------------------------------
def id_field():
    return {"field": "id", "type": "integer",
            "meta": {"hidden": True, "readonly": True, "interface": "input"},
            "schema": {"is_primary_key": True, "has_auto_increment": True}}

def str_field(field, label=None, required=False):
    return {"field": field, "type": "string",
            "meta": {"interface": "input", "display_options": None,
                     "required": required, "note": label}}

def text_field(field, label=None):
    return {"field": field, "type": "text",
            "meta": {"interface": "input-multiline", "note": label}}

def bool_field(field, default=False):
    return {"field": field, "type": "boolean",
            "meta": {"interface": "boolean"},
            "schema": {"default_value": default}}

def int_field(field):
    return {"field": field, "type": "integer", "meta": {"interface": "input"}}

def date_field(field):
    return {"field": field, "type": "date", "meta": {"interface": "datetime"}}

def json_field(field):
    return {"field": field, "type": "json", "meta": {"interface": "tags"}}


# ===========================================================================
# 1. SETLISTS
# ===========================================================================
def create_setlists():
    create_collection("setlists", "Concert setlists", [
        id_field(),
        str_field("venue", required=True),
        str_field("city"),
        str_field("country"),
        date_field("date"),
        str_field("tour_name"),
        str_field("slug"),
        int_field("song_count"),
        str_field("venue_image"),
        text_field("notes"),
    ])


# ===========================================================================
# 2. SETLIST_SONGS (junction — ordered songs within a setlist)
# ===========================================================================
def create_setlist_songs():
    create_collection("setlist_songs", "Songs played at each show (ordered)", [
        id_field(),
        int_field("setlist"),   # FK to setlists.id
        int_field("song"),      # FK to songs.id (or store title directly)
        str_field("song_title"),  # denormalised title for ease
        int_field("position"),
        str_field("set_type"),    # main / encore / acoustic
        str_field("notes"),       # "First time played", etc.
    ])


# ===========================================================================
# 3. MEMBERS
# ===========================================================================
def create_members():
    create_collection("members", "Band member profiles", [
        id_field(),
        str_field("name", required=True),
        str_field("slug"),
        text_field("bio"),
        str_field("photo"),          # URL or Directus file id
        json_field("instruments"),
        str_field("tenure_start"),
        str_field("tenure_end"),
        str_field("tenure"),         # display string e.g. "1976 - Present"
        bool_field("is_current_member", True),
        json_field("side_projects"),
    ])


# ===========================================================================
# 4. TIMELINE
# ===========================================================================
def create_timeline():
    create_collection("timeline", "Key events in The Cure's history", [
        id_field(),
        str_field("title", required=True),
        text_field("description"),
        date_field("date"),
        str_field("formatted_date"),
        int_field("year"),
        str_field("type"),       # release | tour | milestone | award | member_change
        int_field("importance"), # 1-10
        str_field("related_album"),  # album slug
        str_field("related_member"), # member slug
        str_field("image"),
    ])


# ===========================================================================
# 5. PHOTOS
# ===========================================================================
def create_photos():
    create_collection("photos", "Photo gallery", [
        id_field(),
        str_field("title"),
        text_field("description"),
        str_field("image_url"),     # URL or Directus file id
        date_field("date_taken"),
        str_field("formatted_date"),
        str_field("photographer"),
        str_field("location"),
        json_field("tags"),
        str_field("tour"),
        str_field("album_slug"),
        bool_field("is_featured", False),
        bool_field("is_fan_submitted", False),
    ])


# ===========================================================================
# DATA — SETLISTS
# ===========================================================================
SETLISTS = [
    {
        "venue": "Wembley Stadium",
        "city": "London",
        "country": "UK",
        "date": "2023-06-15",
        "tour_name": "Shows of a Lost World",
        "slug": "cure-wembley-stadium-london-2023-06-15",
        "song_count": 27,
        "venue_image": "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&h=600&fit=crop",
        "notes": "Legendary headline show.",
    },
    {
        "venue": "Madison Square Garden",
        "city": "New York",
        "country": "US",
        "date": "2023-07-20",
        "tour_name": "Shows of a Lost World",
        "slug": "cure-madison-square-garden-new-york-2023-07-20",
        "song_count": 29,
        "venue_image": "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=600&fit=crop",
        "notes": "Sold-out MSG show.",
    },
    {
        "venue": "Hollywood Bowl",
        "city": "Los Angeles",
        "country": "US",
        "date": "2023-05-23",
        "tour_name": "Shows of a Lost World",
        "slug": "cure-hollywood-bowl-los-angeles-2023-05-23",
        "song_count": 26,
        "venue_image": "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&h=600&fit=crop",
    },
    {
        "venue": "Glastonbury Festival",
        "city": "Pilton",
        "country": "UK",
        "date": "2019-06-30",
        "tour_name": "Shows of a Lost World (Preview)",
        "slug": "cure-glastonbury-2019-06-30",
        "song_count": 25,
        "venue_image": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop",
        "notes": "Celebrated headlining set. Widely regarded as one of the greatest Glastonbury performances ever.",
    },
    {
        "venue": "Sydney Entertainment Centre",
        "city": "Sydney",
        "country": "Australia",
        "date": "1989-08-12",
        "tour_name": "Prayer Tour",
        "slug": "cure-sydney-entertainment-centre-1989-08-12",
        "song_count": 22,
        "notes": "Disintegration world tour.",
    },
    {
        "venue": "Alexandra Palace",
        "city": "London",
        "country": "UK",
        "date": "2018-11-30",
        "tour_name": "Songs of a Lost World (Preview)",
        "slug": "cure-alexandra-palace-london-2018-11-30",
        "song_count": 24,
        "venue_image": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&h=600&fit=crop",
    },
]

SETLIST_SONGS = {
    "cure-wembley-stadium-london-2023-06-15": [
        ("Alone", 1, "main"), ("And Nothing Is Forever", 2, "main"),
        ("A Fragile Thing", 3, "main"), ("Pictures of You", 4, "main"),
        ("Lovesong", 5, "main"), ("Lullaby", 6, "main"),
        ("The Walk", 7, "main"), ("The Lovecats", 8, "main"),
        ("In Between Days", 9, "main"), ("Close to Me", 10, "main"),
        ("Push", 11, "main"), ("A Night Like This", 12, "main"),
        ("Play for Today", 13, "main"), ("A Forest", 14, "main"),
        ("Fascination Street", 15, "main"), ("Disintegration", 16, "main"),
        ("Plainsong", 17, "main"), ("The Same Deep Water as You", 18, "main"),
        ("Friday I'm in Love", 19, "encore"), ("Boys Don't Cry", 20, "encore"),
        ("Let's Go to Bed", 21, "encore"), ("The Caterpillar", 22, "encore"),
        ("Why Can't I Be You?", 23, "encore"), ("Shake Dog Shake", 24, "encore"),
        ("One Hundred Years", 25, "encore"), ("Pornography", 26, "encore"),
        ("Faith", 27, "encore"),
    ],
    "cure-madison-square-garden-new-york-2023-07-20": [
        ("Alone", 1, "main"), ("And Nothing Is Forever", 2, "main"),
        ("A Fragile Thing", 3, "main"), ("Warsong", 4, "main"),
        ("A Night Like This", 5, "main"), ("Push", 6, "main"),
        ("In Between Days", 7, "main"), ("Pictures of You", 8, "main"),
        ("Lovesong", 9, "main"), ("Lullaby", 10, "main"),
        ("Fascination Street", 11, "main"), ("Disintegration", 12, "main"),
        ("Closedown", 13, "main"), ("Plainsong", 14, "main"),
        ("The Same Deep Water as You", 15, "main"), ("A Forest", 16, "main"),
        ("One Hundred Years", 17, "main"), ("Shake Dog Shake", 18, "main"),
        ("Friday I'm in Love", 19, "encore"), ("Close to Me", 20, "encore"),
        ("Why Can't I Be You?", 21, "encore"), ("Boys Don't Cry", 22, "encore"),
        ("Let's Go to Bed", 23, "encore"), ("The Walk", 24, "encore"),
        ("The Lovecats", 25, "encore"), ("Just Like Heaven", 26, "encore"),
        ("Catch", 27, "encore"), ("Killing an Arab", 28, "encore"),
        ("Pornography", 29, "encore"),
    ],
    "cure-hollywood-bowl-los-angeles-2023-05-23": [
        ("Plainsong", 1, "main"), ("Pictures of You", 2, "main"),
        ("Closedown", 3, "main"), ("Lovesong", 4, "main"),
        ("Lullaby", 5, "main"), ("High", 6, "main"),
        ("Just Like Heaven", 7, "main"), ("Close to Me", 8, "main"),
        ("A Night Like This", 9, "main"), ("In Between Days", 10, "main"),
        ("Push", 11, "main"), ("A Forest", 12, "main"),
        ("Fascination Street", 13, "main"), ("Disintegration", 14, "main"),
        ("Friday I'm in Love", 15, "encore"), ("Boys Don't Cry", 16, "encore"),
        ("Let's Go to Bed", 17, "encore"), ("The Walk", 18, "encore"),
        ("Why Can't I Be You?", 19, "encore"), ("One Hundred Years", 20, "encore"),
        ("Shake Dog Shake", 21, "encore"), ("Pornography", 22, "encore"),
        ("Faith", 23, "encore"), ("The Figurehead", 24, "encore"),
        ("Cold", 25, "encore"), ("Killing an Arab", 26, "encore"),
    ],
}

# ===========================================================================
# DATA — MEMBERS
# ===========================================================================
MEMBERS = [
    {
        "name": "Robert Smith",
        "slug": "robert-smith",
        "bio": "Lead vocalist, guitarist, and the creative heart of The Cure since their formation in 1976. Robert Smith is one of rock's most distinctive figures — his wild hair, smeared lipstick, and deeply personal songwriting have made him an enduring icon. He has guided The Cure through every era, from post-punk to gothic to pop and back, while collaborating with acts including Siouxsie and the Banshees and The Glove.",
        "photo": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
        "instruments": ["Vocals", "Guitar", "Keyboards", "Six-string Bass"],
        "tenure_start": "1976",
        "tenure": "1976 – Present",
        "is_current_member": True,
        "side_projects": ["Siouxsie and the Banshees", "The Glove"],
    },
    {
        "name": "Simon Gallup",
        "slug": "simon-gallup",
        "bio": "Bassist and the longest-serving member alongside Robert Smith. Gallup's melodic, driving bass lines are a defining element of The Cure's sound — powerful on tracks like 'A Forest' and 'One Hundred Years,' and tender on 'Lovesong.' He left briefly in the early 1980s before returning for a run that has lasted to the present day.",
        "photo": "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop",
        "instruments": ["Bass Guitar", "Keyboards"],
        "tenure_start": "1979",
        "tenure": "1979 – Present (with break 1982–83)",
        "is_current_member": True,
        "side_projects": ["Fools Dance", "Lockjaw"],
    },
    {
        "name": "Roger O'Donnell",
        "slug": "roger-odonnell",
        "bio": "Keyboardist whose lush, atmospheric playing has shaped the band's sound across multiple tenures. O'Donnell joined for Kiss Me, Kiss Me, Kiss Me and contributed to Disintegration, Wish, Bloodflowers, and Songs of a Lost World, as well as releasing several solo albums in between.",
        "photo": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
        "instruments": ["Keyboards", "Synthesizers"],
        "tenure_start": "1987",
        "tenure": "1987 – Present (with breaks)",
        "is_current_member": True,
        "side_projects": ["Solo Artist"],
    },
    {
        "name": "Jason Cooper",
        "slug": "jason-cooper",
        "bio": "Drummer and current member, Jason Cooper joined The Cure in 1995 following the departure of Boris Williams. He has played on Wild Mood Swings, Bloodflowers, The Cure (2004), 4:13 Dream, and Songs of a Lost World, bringing a steady, powerful feel to the band's live and studio work.",
        "photo": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
        "instruments": ["Drums", "Percussion"],
        "tenure_start": "1995",
        "tenure": "1995 – Present",
        "is_current_member": True,
        "side_projects": [],
    },
    {
        "name": "Reeves Gabrels",
        "slug": "reeves-gabrels",
        "bio": "Guitarist known for his work with David Bowie's Tin Machine who joined The Cure in 2012, adding a distinctive flair to the band's live performances and contributing to Songs of a Lost World. His virtuosic yet restrained style fits seamlessly into the band's layered guitar sound.",
        "photo": "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=400&fit=crop",
        "instruments": ["Guitar"],
        "tenure_start": "2012",
        "tenure": "2012 – Present",
        "is_current_member": True,
        "side_projects": ["Tin Machine", "David Bowie", "Solo Artist"],
    },
    {
        "name": "Lol Tolhurst",
        "slug": "lol-tolhurst",
        "bio": "Co-founder and original drummer, later keyboardist, who played on every album from Three Imaginary Boys through Disintegration. A childhood friend of Robert Smith, Tolhurst's departure in 1989 was difficult and led to legal proceedings, but the two reconciled and Tolhurst has since rejoined for live appearances and was present in the studio for Songs of a Lost World.",
        "photo": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=400&fit=crop",
        "instruments": ["Drums", "Keyboards", "Other Instruments"],
        "tenure_start": "1976",
        "tenure_end": "1989",
        "tenure": "1976 – 1989 (live appearances 2011–)",
        "is_current_member": False,
        "side_projects": ["Shelleyan Orphan (collaboration)"],
    },
    {
        "name": "Porl Thompson",
        "slug": "porl-thompson",
        "bio": "Guitarist who appeared on The Head on the Door, Kiss Me Kiss Me Kiss Me, Disintegration, Wish, and later on 4:13 Dream. A classically trained musician, Thompson's inventive playing — from psychedelic leads to intricate arpeggios — added crucial texture across four decades.",
        "photo": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop",
        "instruments": ["Guitar", "Saxophone"],
        "tenure_start": "1984",
        "tenure": "1984–1993, 2005–2011",
        "is_current_member": False,
        "side_projects": [],
    },
    {
        "name": "Boris Williams",
        "slug": "boris-williams",
        "bio": "Drummer on The Top through Wish, Williams's powerful, propulsive drumming defined the sound of The Cure's most commercially successful era. He left the band after the Wish tour in 1994 to focus on other projects and family life.",
        "photo": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=400&fit=crop",
        "instruments": ["Drums", "Percussion"],
        "tenure_start": "1983",
        "tenure_end": "1994",
        "tenure": "1983 – 1994",
        "is_current_member": False,
        "side_projects": ["The Guana Batz"],
    },
]

# ===========================================================================
# DATA — TIMELINE
# ===========================================================================
TIMELINE = [
    {
        "title": "The Cure Formed",
        "description": "Robert Smith, Lol Tolhurst, and Michael Dempsey form Easy Cure in Crawley, West Sussex. They would soon shorten the name and sign to Fiction Records.",
        "date": "1976-01-01", "formatted_date": "1976",
        "year": 1976, "type": "milestone", "importance": 10,
    },
    {
        "title": "Three Imaginary Boys Released",
        "description": "The Cure release their debut album on Fiction Records, produced by Chris Parry. A raw post-punk record that introduces the band to the world.",
        "date": "1979-05-08", "formatted_date": "May 8, 1979",
        "year": 1979, "type": "release", "related_album": "three-imaginary-boys", "importance": 8,
    },
    {
        "title": "Seventeen Seconds Released",
        "description": "The Cure's second album establishes their signature atmospheric sound and features the iconic 'A Forest.' Their first UK chart entry (#20).",
        "date": "1980-04-18", "formatted_date": "April 18, 1980",
        "year": 1980, "type": "release", "related_album": "seventeen-seconds", "importance": 9,
    },
    {
        "title": "Faith Released",
        "description": "The second part of the dark trilogy — a gothic, mournful meditation that deepens the atmospheric sound established on Seventeen Seconds.",
        "date": "1981-04-17", "formatted_date": "April 17, 1981",
        "year": 1981, "type": "release", "related_album": "faith", "importance": 8,
    },
    {
        "title": "Pornography Released",
        "description": "The harrowing conclusion to the dark trilogy. Recorded amid intense personal crises, it is one of the most intense and visceral albums in rock history.",
        "date": "1982-05-03", "formatted_date": "May 3, 1982",
        "year": 1982, "type": "release", "related_album": "pornography", "importance": 10,
    },
    {
        "title": "Simon Gallup Departs",
        "description": "Following tensions after the Pornography tour, Simon Gallup leaves the band. He would return in 1983 and remain a core member ever since.",
        "date": "1982-09-01", "formatted_date": "Autumn 1982",
        "year": 1982, "type": "member_change", "related_member": "simon-gallup", "importance": 6,
    },
    {
        "title": "The Head on the Door Released",
        "description": "The band's commercial breakthrough — a varied, brilliantly crafted collection featuring 'In Between Days,' 'Close to Me,' and 'A Night Like This.'",
        "date": "1985-08-30", "formatted_date": "August 30, 1985",
        "year": 1985, "type": "release", "related_album": "the-head-on-the-door", "importance": 9,
    },
    {
        "title": "Kiss Me, Kiss Me, Kiss Me Released",
        "description": "An ambitious double album that brought The Cure to global superstardom. Features 'Just Like Heaven,' 'Why Can't I Be You?' and 'Catch.'",
        "date": "1987-05-26", "formatted_date": "May 26, 1987",
        "year": 1987, "type": "release", "related_album": "kiss-me", "importance": 9,
    },
    {
        "title": "Disintegration Released",
        "description": "Their magnum opus. A slow-burning masterpiece of melancholy and beauty, featuring 'Lovesong,' 'Lullaby,' and 'Pictures of You.' Reached #3 in the UK and #12 in the US.",
        "date": "1989-05-02", "formatted_date": "May 2, 1989",
        "year": 1989, "type": "release", "related_album": "disintegration", "importance": 10,
    },
    {
        "title": "Lol Tolhurst Leaves",
        "description": "Co-founder Lol Tolhurst is dismissed from the band during the mixing of Disintegration, ending 13 years as a member.",
        "date": "1989-02-01", "formatted_date": "Early 1989",
        "year": 1989, "type": "member_change", "related_member": "lol-tolhurst", "importance": 7,
    },
    {
        "title": "Wish Released",
        "description": "Their biggest commercial success — debuting at #1 in the UK and #2 in the US. 'Friday I'm in Love' became a global pop phenomenon.",
        "date": "1992-04-21", "formatted_date": "April 21, 1992",
        "year": 1992, "type": "release", "related_album": "wish", "importance": 9,
    },
    {
        "title": "Bloodflowers Released",
        "description": "Robert Smith's self-described conclusion to the dark trilogy — a hushed, deeply moving record described as a companion to Disintegration.",
        "date": "2000-02-02", "formatted_date": "February 2, 2000",
        "year": 2000, "type": "release", "related_album": "bloodflowers", "importance": 7,
    },
    {
        "title": "Glastonbury Headline Set",
        "description": "A legendary headline performance at Glastonbury Festival, widely regarded as one of the greatest festival sets ever performed. Running to nearly two and a half hours.",
        "date": "2019-06-30", "formatted_date": "June 30, 2019",
        "year": 2019, "type": "milestone", "importance": 9,
    },
    {
        "title": "Rock and Roll Hall of Fame Induction",
        "description": "The Cure are inducted into the Rock and Roll Hall of Fame at the 34th Annual Induction Ceremony in Brooklyn, New York.",
        "date": "2019-03-29", "formatted_date": "March 29, 2019",
        "year": 2019, "type": "award", "importance": 10,
    },
    {
        "title": "Songs of a Lost World Released",
        "description": "After 16 years, The Cure release their fourteenth studio album to near-universal critical acclaim. An eight-track meditation on grief and loss, many call it their best work since Disintegration.",
        "date": "2024-11-01", "formatted_date": "November 1, 2024",
        "year": 2024, "type": "release", "related_album": "songs-of-a-lost-world", "importance": 10,
    },
]

# ===========================================================================
# DATA — PHOTOS
# ===========================================================================
PHOTOS = [
    {
        "title": "The Cure Live at Wembley Stadium",
        "description": "A stunning moment captured during the encore of their legendary Wembley performance on the Shows of a Lost World tour.",
        "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&h=900&fit=crop",
        "date_taken": "2023-06-15", "formatted_date": "June 15, 2023",
        "photographer": "Andy Vella", "location": "Wembley Stadium, London",
        "tags": ["live", "promotional"], "tour": "Shows of a Lost World",
        "is_featured": True, "is_fan_submitted": False,
    },
    {
        "title": "Robert Smith — Portrait Session",
        "description": "Promotional photo shoot for the Songs of a Lost World album campaign, shot in London.",
        "image_url": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1600&h=900&fit=crop",
        "date_taken": "2024-09-10", "formatted_date": "September 10, 2024",
        "photographer": "Rankin", "location": "Studio, London",
        "tags": ["promotional", "studio"], "is_featured": True, "is_fan_submitted": False,
    },
    {
        "title": "Backstage at Madison Square Garden",
        "description": "A rare candid moment captured backstage before their sold-out MSG show on the Shows of a Lost World tour.",
        "image_url": "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=1600&h=900&fit=crop",
        "date_taken": "2023-07-20", "formatted_date": "July 20, 2023",
        "photographer": "Kevin Cummins", "location": "Madison Square Garden, NYC",
        "tags": ["backstage", "candid"], "tour": "Shows of a Lost World",
        "is_featured": False, "is_fan_submitted": False,
    },
    {
        "title": "Disintegration Prayer Tour — Sydney",
        "description": "Historic photograph from the original Disintegration world tour at the Sydney Entertainment Centre.",
        "image_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1600&h=900&fit=crop",
        "date_taken": "1989-08-12", "formatted_date": "August 12, 1989",
        "photographer": "Tom Sheehan", "location": "Sydney Entertainment Centre, Australia",
        "tags": ["live", "archive"], "tour": "Prayer Tour",
        "is_featured": False, "is_fan_submitted": False,
    },
    {
        "title": "Glastonbury 2019 — Headlining Set",
        "description": "Robert Smith leading the band through their celebrated headline Glastonbury set, widely considered one of the greatest festival performances ever.",
        "image_url": "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1600&h=900&fit=crop",
        "date_taken": "2019-06-30", "formatted_date": "June 30, 2019",
        "photographer": "Press", "location": "Glastonbury Festival, Pilton, UK",
        "tags": ["live", "festival"], "tour": "Shows of a Lost World (Preview)",
        "is_featured": True, "is_fan_submitted": False,
    },
    {
        "title": "Wish Era — Studio Session",
        "description": "Recording sessions at The Manor in Oxfordshire for The Cure's ninth studio album, Wish.",
        "image_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&h=900&fit=crop",
        "date_taken": "1991-11-20", "formatted_date": "November 1991",
        "photographer": "Chris Gabrin", "location": "The Manor, Oxfordshire, UK",
        "tags": ["studio", "archive"], "album_slug": "wish",
        "is_featured": False, "is_fan_submitted": False,
    },
]

# ===========================================================================
# DATA — NEWS
# ===========================================================================
NEWS_POSTS = [
    {
        "title": "The Cure Announce 2025 World Tour: 'Songs of a Lost World' Continues",
        "slug": "cure-announce-2025-world-tour",
        "excerpt": "Following the massive success of their latest album, The Cure have announced an extensive world tour spanning Europe, North America, and beyond.",
        "content": "<p>The Cure have announced their most ambitious tour in decades, following the worldwide critical acclaim for <em>Songs of a Lost World</em>. The tour will span multiple continents and see the band performing at some of the world's most iconic venues.</p><p>Robert Smith has promised a set that draws heavily from the new album while also featuring a career-spanning selection of fan favourites.</p>",
        "category": "news", "featured": True,
        "featured_image": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&h=630&fit=crop",
        "published_date": "2024-12-15", "author_name": "James Murphy",
        "reading_time": 4, "tags": ["tour", "live", "2025"],
    },
    {
        "title": "Songs of a Lost World: A Deep Dive Into The Cure's Masterpiece",
        "slug": "songs-of-a-lost-world-deep-dive",
        "excerpt": "An in-depth look at the themes, production, and emotional weight of The Cure's long-awaited fourteenth album.",
        "content": "<p>After 16 years of anticipation, <em>Songs of a Lost World</em> arrived not merely as a new Cure album but as an event. The question was never whether it would be good — Robert Smith's track record guaranteed quality — but whether it could live up to the almost mythological expectations built up over nearly two decades.</p><p>It exceeded them.</p>",
        "category": "reviews", "featured": False,
        "featured_image": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&h=630&fit=crop",
        "published_date": "2024-11-28", "author_name": "Sarah Collins",
        "reading_time": 8, "rating": 5, "tags": ["album", "review", "songs of a lost world"],
    },
    {
        "title": "Robert Smith on Creativity, Loss, and The Future of The Cure",
        "slug": "robert-smith-interview-2024",
        "excerpt": "In this exclusive interview, Robert Smith opens up about the creative process behind the new album and what lies ahead.",
        "content": "<p>Sitting in a dimly lit London studio, Robert Smith looks like he always does — the hair, the lipstick, the gentle intensity in his eyes. He is discussing the making of <em>Songs of a Lost World</em>, the album that many are calling his masterwork.</p>",
        "category": "interviews", "featured": False,
        "featured_image": "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1200&h=630&fit=crop",
        "published_date": "2024-11-20", "author_name": "Michael Chen",
        "reading_time": 12, "tags": ["robert smith", "interview", "exclusive"],
    },
    {
        "title": "The Evolution of Robert Smith's Guitar Sound",
        "slug": "evolution-robert-smith-guitar-sound",
        "excerpt": "From the angular post-punk of their early days to the lush atmospheric tones of Disintegration and beyond — tracing the sonic evolution.",
        "content": "<p>The guitar sound of The Cure is one of the most recognisable in rock music. From the scratchy, angular tones of the debut to the vast, reverb-soaked cathedrals of <em>Disintegration</em> and the atmospheric shimmer of <em>Songs of a Lost World</em>, Robert Smith's guitar work has evolved while remaining unmistakably itself.</p>",
        "category": "editorials", "featured": False,
        "featured_image": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1200&h=630&fit=crop",
        "published_date": "2024-11-15", "author_name": "David Richards",
        "reading_time": 6, "tags": ["guitar", "sound", "gear"],
    },
    {
        "title": "Disintegration at 35: Why It Still Matters",
        "slug": "disintegration-at-35",
        "excerpt": "A retrospective look at one of the most influential and beloved albums in alternative rock history.",
        "content": "<p>When <em>Disintegration</em> was released on May 2, 1989, it arrived as a grand, slightly baffling gesture — a deliberately uncommercial double-down on atmosphere and melancholy from a band that had just had their biggest hit. The record label was reportedly unhappy. Radio programmers were unsure what to do with it.</p><p>Thirty-five years later, it is widely considered one of the greatest albums ever made.</p>",
        "category": "reviews", "featured": False,
        "featured_image": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=630&fit=crop",
        "published_date": "2024-11-10", "author_name": "Emma Watson",
        "reading_time": 10, "rating": 5, "tags": ["disintegration", "anniversary", "retrospective"],
    },
    {
        "title": "New Box Set Rumours: Complete B-Sides Collection in the Works?",
        "slug": "box-set-rumours-b-sides",
        "excerpt": "Sources close to the band suggest a comprehensive B-sides and rarities collection may be in the works for 2025.",
        "content": "<p>Fans have been speculating for years about the possibility of an authoritative B-sides and rarities compilation from The Cure, and new rumours suggest it may finally be happening. Sources familiar with the project suggest Fiction Records and the band have been discussing options for a major archival release.</p>",
        "category": "rumors", "featured": False,
        "featured_image": "https://images.unsplash.com/photo-1461784180009-21121b2f204c?w=1200&h=630&fit=crop",
        "published_date": "2024-11-05", "author_name": "Tom Hardy",
        "reading_time": 3, "tags": ["box set", "b-sides", "rarities"],
    },
]


# ===========================================================================
# MAIN
# ===========================================================================
def main():
    # ── Create collections ──────────────────────────────────────────────
    print("\n=== STEP 1: Creating collections ===\n")
    create_setlists()
    create_setlist_songs()
    create_members()
    create_timeline()
    create_photos()
    print("  (news collection already created earlier)")

    time.sleep(1)

    # ── Populate news ───────────────────────────────────────────────────
    print("\n=== STEP 2: Populating news ===\n")
    for post in NEWS_POSTS:
        d = post_item("news", post)
        if d:
            print(f"  ✓ News: {d.get('title', '?')[:60]}")
        time.sleep(0.2)

    # ── Populate setlists ───────────────────────────────────────────────
    print("\n=== STEP 3: Populating setlists ===\n")
    setlist_id_map = {}
    for sl in SETLISTS:
        d = post_item("setlists", sl)
        if d:
            setlist_id_map[sl["slug"]] = d["id"]
            print(f"  ✓ Setlist: {d.get('venue')} ({d.get('date')}) → id={d['id']}")
        time.sleep(0.2)

    # ── Populate setlist_songs ──────────────────────────────────────────
    print("\n=== STEP 4: Populating setlist songs ===\n")
    for slug, songs in SETLIST_SONGS.items():
        sl_id = setlist_id_map.get(slug)
        if not sl_id:
            print(f"  ! No id for {slug}, skipping")
            continue
        print(f"  Adding {len(songs)} songs to setlist id={sl_id} ({slug})...")
        for title, pos, set_type in songs:
            post_item("setlist_songs", {
                "setlist": sl_id,
                "song_title": title,
                "position": pos,
                "set_type": set_type,
            })
            time.sleep(0.1)
        print(f"    ✓ Done")

    # ── Populate members ────────────────────────────────────────────────
    print("\n=== STEP 5: Populating members ===\n")
    for m in MEMBERS:
        d = post_item("members", m)
        if d:
            print(f"  ✓ Member: {d.get('name')}")
        time.sleep(0.2)

    # ── Populate timeline ───────────────────────────────────────────────
    print("\n=== STEP 6: Populating timeline ===\n")
    for ev in TIMELINE:
        d = post_item("timeline", ev)
        if d:
            print(f"  ✓ Timeline: {d.get('year')} — {d.get('title')}")
        time.sleep(0.2)

    # ── Populate photos ─────────────────────────────────────────────────
    print("\n=== STEP 7: Populating photos ===\n")
    for ph in PHOTOS:
        d = post_item("photos", ph)
        if d:
            print(f"  ✓ Photo: {d.get('title')}")
        time.sleep(0.2)

    # ── Final summary ───────────────────────────────────────────────────
    print("\n=== DONE — Final counts ===\n")
    for col in ["news", "setlists", "setlist_songs", "members", "timeline", "photos"]:
        r = req("GET", f"/items/{col}?limit=1&meta=total_count")
        count = r["meta"]["total_count"] if r and "meta" in r else "?"
        print(f"  {col:<20} {count} items")


if __name__ == "__main__":
    main()
