# USP India website

Website and content editor for USP India (Urban Suburban Perspectives).

- **backend/** — FastAPI (Python) API, admin, server-rendered pages, photo storage
- **frontend/** — React site and admin panel (Create React App + craco + Tailwind)
- **deploy/** — example `systemd` service and `nginx` config for a VPS
- Database: **MongoDB**. Photos are plain files in `backend/storage/`.

Nothing depends on Emergent or any other hosting platform — it runs anywhere you can run Python, Node and MongoDB.

## What happens on first start

1. The first admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (only if the database has no users).
2. All pages, Field Notes, menus, settings and the media library are imported from `backend/content_release.json`.
   The photos it refers to are already in `backend/storage/uspindia/`.
3. After that, edits made in the admin or the live editor are saved in MongoDB and are never overwritten on restart.

## Run it on your computer

Requirements: Python 3.11+, Node 20+ with Yarn 1.x, MongoDB 6 or 7 running locally.

```bash
# 1. Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set SITE_URL=http://localhost:8001, CORS_ORIGINS=http://localhost:8001,http://localhost:3000
uvicorn server:app --port 8001

# 2a. Quickest: the backend serves the whole site on http://localhost:8001 from frontend/build.
#     A ready-made build is included, so this step is only needed after changing frontend code:
cd ../frontend
yarn install
yarn build

# 2b. Or, while changing frontend code (hot reload on http://localhost:3000)
cp .env.example .env
yarn start
```

Admin: `/admin` (log in with the admin account). The **Live editor** button appears on every page once you are logged in.

## Host it on a VPS (Ubuntu example)

```bash
# Packages
sudo apt install -y python3-venv nginx certbot python3-certbot-nginx
# Install MongoDB 7 (see mongodb.com/docs/manual/administration/install-on-linux) and Node 20 + yarn

# Code
sudo mkdir -p /var/www/uspindia && sudo chown $USER /var/www/uspindia
# copy this project into /var/www/uspindia

cd /var/www/uspindia/backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env && nano .env      # real SITE_URL, CORS_ORIGINS, JWT_SECRET, admin login

cd ../frontend && yarn install && yarn build   # required when the code comes from GitHub (the zip already contains frontend/build)

# Service + web server
sudo chown -R www-data /var/www/uspindia/backend/storage
sudo cp ../deploy/uspindia.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now uspindia
sudo cp ../deploy/nginx.conf /etc/nginx/sites-available/uspindia
sudo ln -s /etc/nginx/sites-available/uspindia /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d uspindia.org -d www.uspindia.org
```

HTTPS is required in production (login cookies are marked secure).

**Before going live:** in Admin → Settings, turn on search-engine indexing. Until then every page sends `noindex` and `robots.txt` blocks crawlers.

**Updating the site:** copy the new code, `yarn build` in `frontend/`, then `sudo systemctl restart uspindia`.
The page shell is never cached and the built CSS/JS files have new names on every build, so visitors get the new design straight away (no old CSS left in browsers).

**Fresh install vs. moving the old database:** a new, empty MongoDB gets exactly the content in `backend/content_release.json` (this version's pages, fonts, colours and photos).
If you restore the database of the old site instead, its saved edits (texts, font sizes, colours, photos) are kept, and the positions/sizes that the old live editor saved
are cleared once on the first start (they were measured on another layout and made text and photos overlap). A full backup is taken first (restorable under Admin → Import / Export → Content backups).

**Backups:** back up the MongoDB database (`mongodump --db uspindia`) and the `backend/storage/` folder — together they are the whole site.

## Page grid

Every page uses one grid (`frontend/src/styles/layout-grid.css`): all sections start and end on the same two lines, so text, photos and divider lines stay lined up and centred on any screen. On tablets and phones text inside and outside the coloured bands starts on the same edge.

On desktop, each page follows the owner's approved page designs section by section (`frontend/src/styles/design-1440.css`: positions, column widths and spacing for Home, Who We Are, Theatre, Craft & Livelihood, Workshops & Learning, Field Notes and Connect). Those rules only apply to the desktop design; sizes typed in the live editor still win.

## Responsive layout (how sizes and positions work)

- **Text is never scaled.** A font size typed in the live editor (or set in the stylesheet) is the size shown on every desktop and laptop screen — exactly as on the original site.
- Sizes and positions set in the live editor (dragging, resizing, "Move X/Y") are saved for a **1440px-wide desktop design**. Screens wider than 1200px show that design: below 1440px the spacing, column widths and saved positions shrink with the page (so nothing overlaps or runs off the screen); wider screens show it at full size, centred. The header and footer stay full width.
- **Tablets and phones (1200px and narrower)** ignore saved positions and sizes: every section uses its own responsive layout (columns stack, photos fill the width). Text styles, colours, backgrounds and photo crops still apply. Only large headings (24px and up) get a little smaller on narrow phones so they fit; body text stays as typed.
- Check tablet/phone views with the tablet and phone buttons in the editor panel.
- If items end up on top of each other, the editor warns straight after the move (with Undo). Click any section → **Tidy this section** to put its texts and photos back in their standard places.

## Live editor

- **Edit Header** (bottom toolbar, or point at the header and click “Edit header colours & layout”): five one-click colour schemes (Original, Clean white, Warm sand, Charcoal, USP red), then brand & logo, navigation, and *Style & spacing* — header background, the line under the header, brand and subtitle colours, menu-bar background, menu text, hover/current colour, the lines between menu items, hover background, current-page underline, dropdown (and dropdown hover) and mobile-menu colours, a shadow, fonts, letter case and spacing, header height and the space below it. Sizes have sliders; every colour field offers the site colours and your recently used colours, and × returns it to the default. Changes show immediately; **Save header** publishes them on every page.
- The editor panels open beside the page. Drag the title to move a panel, drag its left/right/bottom edges or corners to resize it; it never leaves the screen and remembers where you put it. The dock button puts it back on the right.
- Click text on the page and type. Click a photo to replace it, or to **crop** it: pick a shape (Original, Square, 4:3, 3:2, 16:9, 3:4, 4:5), zoom with the slider, and drag the photo to choose what shows.
- Drag the dark grip to move an element, the red handles to resize it; arrow keys nudge (Shift = 10px).
- **Lines:** select any text, photo or section. The toolbar has *add line above* and *add line below*; the **Lines** panel chooses a short red line or a thin line across, and sets its length, thickness, space from the text and colour (or deletes it). The red lines that are part of the design can be made longer, shorter, thicker, recoloured or removed for one text or a whole section, and a section's thin grey dividers can be hidden. Site-wide red-line defaults are in Edit Header → *Red lines*.
- **Logo:** Edit Header → *Brand & logo* — replace the logo, set its height, and choose whether the name shows next to it (hidden automatically when a logo is set). The official 2026 logo files (horizontal, stacked, and the USP mark used as the browser-tab icon) are in Media.
- **Footer colours:** point at the footer and click *Edit footer colours* (or Edit Header → *Style & spacing* → Colours → Footer): the footer background (default `#E4CDAE`) and the strip along its bottom with © and Privacy Policy (default `#e5dad4`).
- `Ctrl/⌘+S` saves and publishes, `Ctrl/⌘+Z` undoes, `Esc` deselects.

## Enquiry form and email

Every message sent through the Connect form is saved under **Admin → Enquiries** (spam protection: hidden honeypot field, minimum fill time, 5 messages per hour per connection).
To also receive each enquiry by email, open **Enquiries → Form settings**:

1. Tick “Email me every new enquiry” and enter one or more addresses.
2. Choose your email provider (Gmail / Google Workspace, Zoho, Microsoft 365, Hostinger, GoDaddy/Titan, Amazon SES, Brevo) — the server, port and security are filled in — then enter the mailbox username and password. For Gmail use an **App Password**.
3. Save, then **Send test**. If it fails, the page shows the reason in plain words.
4. Optional: an automatic thank-you email to the visitor.

The notification email's *Reply-To* is the visitor, so pressing Reply answers them directly. Each enquiry shows whether its email was sent or failed (and why).
The same mailbox is used for password-reset and invitation emails; if it is not set up, those links are written to the server log and shown in Admin → Users.

## Traffic

**Admin → Traffic** shows visitors, page views, pages per visit, enquiries, a daily chart, most-viewed pages, where visitors came from (search, social, AI assistants, `utm_source` campaigns), countries, devices and browsers for 7 days / 30 days / 90 days / 12 months, with the change against the previous period. It is counted on your own server: no cookies, no Google Analytics, no personal data (a visitor is a daily-changing anonymous hash). Admins and bots are not counted. Raw data is deleted automatically after 400 days. The Dashboard shows the last 7 days.

## SEO and GEO (AI answers)

- Every page and Field Note has a *Search & AI visibility* section: search title and description (with Google preview), keywords, share image, canonical / noindex, plus GEO fields — an “In brief” summary, the place it is about, and questions & answers.
- Server-rendered HTML with schema.org data: Organization, WebSite, WebPage, BlogPosting (Field Notes), FAQPage, Place, BreadcrumbList; Open Graph and Twitter cards; sitemap.xml.
- **Admin → SEO & Sharing** lists issues per page, GEO tips, redirects, and *AI answers (GEO)* settings: an organisation description, area served, year founded, whether AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…) may read the site, and extra facts. These feed `/llms.txt`, a plain summary written for AI assistants.
- Field Notes: **New Field Note** asks only for a title; the address is made from it. The editor has a readiness checklist (title, main photo, category, length, description, summary, questions).

## Notes

- `backend/scripts/prepare_content_release.py` rebuilds `content_release.json` from a database you have marked as the content source (`--initialize`). Only needed when moving content between installations.
