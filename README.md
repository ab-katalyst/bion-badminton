# 🏆 Bion SportsFest

Static site for Bollineni Bion sporting events, hosted on **Cloudflare Pages**. No build step.

## Site map

| URL | What it is |
|-----|------------|
| `/` | SportsFest '26 results — tabs per age category, volunteers and financials |
| `/past-events.html` | Archive index |
| `/past/badminton-0626/` | Friendly Badminton 06/26 scoreboard (archived, still live) |
| `/past/badminton-0626/admin.html` | Its admin panel |

## SportsFest '26

All results live in **`data/sportsfest26.json`** — no database, no backend. Each event:

```json
{
  "id": "kids-badminton-singles-male",
  "category": "kids", "sport": "Badminton", "format": "Singles",
  "gender": "male", "phase": 1,
  "photo": "img/finalists/kids-badminton-singles-male.webp",
  "winners": [
    { "place": 1, "players": [{ "name": "Afash", "flat": "" }] },
    { "place": 2, "players": [{ "name": "Vihaan G", "flat": "B-2107" }] }
  ]
}
```

- `place` is a list, so champion-only events (the basketball teams) just omit place 2.
- `players` is a list, so singles, doubles and 5-a-side teams all use one shape.
- Drop `photo` entirely and the card renders as a court-green band instead. Add the key when the photo arrives.
- A category with no events gets no tab — that is why Fun Events is currently hidden.
- The "medals by tower" tally on the home page is derived from the leading letter of each `flat`.

### Adding results

1. Add the event object to `data/sportsfest26.json`.
2. If there is a photo, save it as `img/finalists/<id>.webp` and set the `photo` key.

Compress new photos the same way the existing ones were:

```bash
convert "raw.jpeg" -auto-orient -resize '1400x1400>' -strip \
        -quality 76 -define webp:method=6 "img/finalists/<id>.webp"
```

Admin mode (editing winners and flat numbers in the browser) is not built yet. It will reuse
the Apps Script backend below, writing to a second cell.

---

# 🏸 Archived: Badminton Tournament (June 2026)

A mobile-first badminton tournament app backed by **Google Sheets**. Lives at
`/past/badminton-0626/` and still reads from the deployed Apps Script.

## Features

**Public Scoreboard (`index.html`)**
- 🔴 **Live Matches** — prominently shows matches currently in progress
- 📊 **Group Standings** — auto-calculated from match results
- 📅 **Full Schedule** — all matches with scores and status
- 🏆 **Knockout Bracket** — auto-resolves semi-final and final teams from group standings
- Auto-refreshes every 10 seconds

**Admin Panel (`admin.html`)**
- 👥 **Teams** — add/remove teams, assign to groups
- 📅 **Matches** — add matches manually or auto-generate round-robin
- 🏸 **Scores** — enter game-by-game scores, mark matches as Scheduled / Live / Completed
- ⚙️ **Config** — tournament name, points per game, teams advancing
- One-click **Setup Knockout Stage** — creates semi-finals and final from standings

## Quick Setup (5 minutes)

### Step 1: Create the Google Sheet Backend

1. Go to [Google Sheets](https://sheets.new) and create a blank spreadsheet
2. Rename the first sheet tab to exactly: `Data`
3. Click **Extensions → Apps Script**
4. Delete any code in the editor, then **paste the entire contents of `code.gs`** from this repo
5. Press **Ctrl+S** (or Cmd+S) to save the project
6. Click **Deploy → New deployment**
7. Select type: **Web app**
8. Set **Execute as:** Me
9. Set **Who has access:** Anyone
10. Click **Deploy** and then **Authorize** the script (click through any permission prompts)
11. **Copy the Web app URL** (looks like `https://script.google.com/macros/s/.../exec`)

### Step 2: Configure the App

1. Open `js/config.js`
2. Paste your Web app URL into `APPS_SCRIPT_URL`
3. Change the admin password if you want (default: `badmin2024`)

### Step 3: Deploy to Cloudflare Pages

1. Push this code to a GitHub repo
2. Go to [Cloudflare Pages](https://dash.cloudflare.com) → Create a project
3. Connect your GitHub repo
4. Framework preset: **None**
5. Build command: *(leave empty)*
6. Build output directory: `/`
7. Deploy!

### Step 4: Use It

- **Public link:** `https://your-project.pages.dev/past/badminton-0626/` — share this with everyone
- **Admin link:** `https://your-project.pages.dev/past/badminton-0626/admin.html` — use this to run the tournament

## How to Run the Tournament

### Before the Event
1. Open the **Admin panel**
2. Go to **Teams** tab and add all teams with their groups
3. Go to **Matches** tab and click **🔄 Generate Round Robin** — this auto-creates all group matches
4. Go to **Scores** tab and add scheduled times/courts if you want

### During the Event
1. When a match starts, go to **Scores** tab, change its status to **Live**, and enter scores as they happen
2. When the match ends, set status to **Completed** and save
3. The public scoreboard updates automatically within 10 seconds

### After Group Stage
1. Go to **Matches** tab and click **🏆 Setup Knockout Stage**
2. This auto-creates:
   - **Semi-Final 1:** Group A #1 vs Group B #2
   - **Semi-Final 2:** Group B #1 vs Group A #2
   - **Final:** placeholder (resolves automatically when semis are scored)
   - **3rd Place:** placeholder (resolves automatically)
3. Score the semi-finals, then the final and 3rd place match

## Tournament Rules

| Stage | Format | Points per Game |
|-------|--------|-----------------|
| Group Stage | Best of 3 | 15 |
| Semi-Finals | Best of 3 | 21 |
| Final / 3rd Place | Best of 3 | 21 |

Standings are sorted by: **Points → Game Difference → Games Won**

## Files

```text
├── index.html                     # SportsFest '26 results
├── past-events.html               # Archive index
├── data/sportsfest26.json         # All SportsFest results
├── css/sportsfest.css             # SportsFest styling
├── js/sportsfest.js               # SportsFest rendering
├── img/finalists/*.webp           # Finalist photos, named after event id
├── past/badminton-0626/
│   ├── index.html                 # Archived scoreboard
│   └── admin.html                 # Archived admin panel
├── css/styles.css                 # Badminton styling
├── js/config.js                   # Apps Script URL + admin password
├── js/app.js                      # Badminton public logic
├── js/admin.js                    # Badminton admin logic
├── code.gs                        # Google Apps Script backend
└── README.md
```

## Notes

- The entire tournament state is stored as one JSON blob in a single Google Sheet cell. The Apps Script is just a read/write API for that cell.
- If two admins edit at the exact same time, last-write-wins. For a one-day event this is usually fine.
- The public site is fully static — it just polls the Apps Script URL every 10 seconds.
- You can customize colors in `css/styles.css` by editing the CSS variables at the top.
