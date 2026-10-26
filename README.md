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

Browsers: current Chrome, Safari (Safari 16 / iOS 16 and newer), Firefox and Edge, on computers, tablets and phones. The site avoids JavaScript that older Safari versions cannot read, so it never shows a blank page there.

**Before going live:** in Admin → Settings, turn on search-engine indexing. Until then every page sends `noindex` and `robots.txt` blocks crawlers.

**Updating the site:** copy the new code, run `.venv/bin/pip install -r requirements.txt` in `backend/` (new versions can add a package, e.g. iPhone photo support), `yarn build` in `frontend/`, then `sudo systemctl restart uspindia`.
The page shell is never cached and the built CSS/JS files have new names on every build, so visitors get the new design straight away (no old CSS left in browsers).
Everything edited on the server is kept when a new version is deployed — texts, colours, fonts, photos, sizes, positions, section spacing and added photos. On start the new version's content (`backend/content_release.json`) is merged in; where the server and the new version changed the same thing, the server's edit wins. A full backup is taken first (Admin → Import / Export → Content backups).

**Fresh install vs. moving the old database:** a new, empty MongoDB gets exactly the content in `backend/content_release.json` (this version's pages, fonts, colours and photos).
If you restore the database of the old site instead, its saved edits (texts, font sizes, colours, photos) are kept, and the positions/sizes that the old live editor saved
are cleared once on the first start (they were measured on another layout and made text and photos overlap). A full backup is taken first (restorable under Admin → Import / Export → Content backups).

**Backups:** back up the MongoDB database (`mongodump --db uspindia`) and the `backend/storage/` folder — together they are the whole site.

## Page grid

Every page uses one grid (`frontend/src/styles/layout-grid.css`): all sections start and end on the same two lines, so text, photos and divider lines stay lined up and centred on any screen. On tablets and phones text inside and outside the coloured bands starts on the same edge.

On desktop, each page follows the owner's approved page designs section by section (`frontend/src/styles/design-1440.css`: positions, column widths and spacing for Home, Who We Are, Theatre, Craft & Livelihood, Workshops & Learning, Field Notes and Connect). Those rules only apply to the desktop design; sizes typed in the live editor still win.
The Theatre page's top section follows the October 2026 design (`frontend/src/styles/theatre-collage.css`): two overlapping rehearsal photos, the title at the bottom left with a short orange line, and the introduction in a light band. Both photos, the texts and the line can be changed, cropped, resized and moved in the live editor.

## Responsive layout (how sizes and positions work)

- **Text is never scaled.** A font size typed in the live editor (or set in the stylesheet) is the size shown on every desktop and laptop screen — exactly as on the original site.
- Sizes and positions set in the live editor (dragging, resizing, "Move X/Y") are saved for a **1440px-wide desktop design**. Screens wider than 1200px show that design: below 1440px the spacing, column widths and saved positions shrink with the page (so nothing overlaps or runs off the screen); wider screens show it at full size, centred. The header and footer stay full width.
- **Tablets and phones (1200px and narrower)** ignore saved positions and sizes: every section uses its own responsive layout (columns stack, photos fill the width). Text styles, colours, backgrounds and photo crops still apply. Only large headings (24px and up) get a little smaller on narrow phones so they fit; body text stays as typed.
- Check tablet/phone views with the tablet and phone buttons in the editor panel.
- If items end up on top of each other, the editor warns straight after the move (with Undo). Click any section → **Tidy this section** to put the section and its texts and photos back in their standard places and sizes.

## Live editor

- **Edit Header** (bottom toolbar, or point at the header and click “Edit header colours & layout”): five one-click colour schemes (Original, Clean white, Warm sand, Charcoal, USP red), then brand & logo, navigation, and *Style & spacing* — header background, the line under the header, brand and subtitle colours, menu-bar background, menu text, hover/current colour, the lines between menu items, hover background, current-page underline, dropdown (and dropdown hover) and mobile-menu colours, a shadow, fonts, letter case and spacing, header height and the space below it. Sizes have sliders; every colour field offers the site colours and your recently used colours, and × returns it to the default. Changes show immediately; **Save header** publishes them on every page.
- The editor panels open beside the page. Drag the title to move a panel, drag its left/right/bottom edges or corners to resize it; it never leaves the screen and remembers where you put it. The dock button puts it back on the right.
- Click text on the page and type. Click a photo to replace it, or to **crop** it: pick a shape (Original, Square, 4:3, 3:2, 16:9, 3:4, 4:5), zoom with the slider, and drag the photo to choose what shows.
- Drag the dark grip to move an element, the red handles to resize it; arrow keys nudge (Shift = 10px). Every text and photo on every page can be resized and moved this way (or with *Size & position* in the panel), and every text's size, weight, colour and spacing can be changed. Photos keep filling their new size.
- **Section height:** select a section (click an empty part of it, or the grid button in the toolbar). Drag its **bottom** handle up to make it shorter or down to make it taller; drag its **top** handle to change the space above its content. The sections below always move up or down with it — no gaps, no overlaps — and a section never gets smaller than its content. *Space above / below* in the panel shows the empty space in pixels and can be typed; the ↺ button returns to the standard spacing. These spacings apply to the desktop design; tablets and phones keep their own.
- **Section width:** drag a selected section's **left** or **right** handle, or use *Width of the section* (slider or number) in the panel. The edge you drag follows the mouse and the other edge stays put. Everything inside stays inside the narrower section: its columns and spacing shrink with it and the text wraps to fit (text keeps its size). *Left / Centre / Right* place a narrower section on the page (against the edges the header, footer and coloured bands line up on), and its dark grip can be dragged sideways (← → keys nudge it). A section never leaves the page or gets wider than it, and never covers the section below. **↺ Standard** puts it back. The right handle is never hidden under the editor panel: the outline stops just before the panel, and the panel turns see-through while you drag. Widths apply to the desktop design; tablets and phones always show sections full width.
- **Moving a section:** drag a selected section's dark grip up or down to put it before or after another section (the page scrolls when you reach the top or bottom of the window); the arrows in the toolbar move it one place.
- **Colours:** every section has *Background* under *Section background colour, width & spacing*. Nothing in the section moves when it gets a colour: a hero panel takes the colour, other sections get a coloured band behind them (as wide as the site's other coloured bands). The coloured bands that are part of the page designs keep their own layout. Boxes inside a section — the Theatre page's light band, the *Our principles* box, the Connect title box and the white contact card — have their own *Box colour* and corner radius (click the box, or pick it in *All page fields*). Any text can also get a background colour (*Line spacing & highlight*).
- **Links:** select a button or linked text; the **Link** group shows *Where it goes* — a page of this site (e.g. `/connect`, suggestions are offered), a full `https://` address, `mailto:` or `tel:`. Unsafe addresses are refused. In the footer, click the Facebook or Instagram icon to set its page address.
- **Site-wide texts** — the footer (email, ©, privacy text), contact details, the contact form's labels, the grey example texts inside its boxes, its error messages and button, Field Notes labels and the "page not found" page: click them in the live editor to change the words, size and colour (*Text & typography* panel).
- **New sections:** *Add a new section* (panel) or the + in a section's toolbar: text, image + text, big image, gallery, quote, call to action or hero banner (a heading with a full-width photo). A photo is chosen straight away; the new section can then be moved up or down the page like any other.
- **Hidden sections:** the eye button in a section's toolbar hides it; with nothing selected the editor panel lists *Hidden sections* with a *Show* button for each.
- **Adding a photo to a section:** select anything in the section and click the photo-with-plus button in the toolbar (or *Add a photo* in the section panel), then upload a photo or choose one from the library. It appears inside that section, selected: drag it where you want it, resize it with the red handles, crop or zoom it, or delete it with the bin. On tablets and phones added photos are shown one after another under the section's text.
- **Field Notes page:** the list of notes is a section of the page. Its titles, summaries, captions and photos can be resized, moved, cropped and restyled like any other element; the words and photos themselves come from each note, so they are changed with *Edit story & image* under the note. On a Field Note's own page the related-notes photos can be resized too.
- Elements hidden behind others can be picked from *All page fields* in the panel. If the panel covers what you want to click, use *Panel left/right*.
- **Lines:** select any text, photo or section. The toolbar has *add line above* and *add line below*; the **Lines** panel chooses a short red line or a thin line across, and sets its length, thickness, space from the text and colour (or deletes it). The red lines that are part of the design can be made longer, shorter, thicker, recoloured or removed for one text or a whole section, and a section's thin grey dividers can be hidden. Site-wide red-line defaults are in Edit Header → *Red lines*.
- **Logo:** Edit Header → *Brand & logo* — replace the logo, set its height, and choose whether the name shows next to it (hidden automatically when a logo is set). The official 2026 logo files (horizontal, stacked, and the USP mark used as the browser-tab icon) are in Media.
- **Footer colours:** point at the footer and click *Edit footer colours* (or Edit Header → *Style & spacing* → Colours → Footer): the footer background (default `#E4CDAE`) and the strip along its bottom with © and Privacy Policy (default `#e5dad4`).
- `Ctrl/⌘+S` saves and publishes, `Ctrl/⌘+Z` undoes, `Esc` deselects.

## Photos

Photos can be uploaded in the live editor and under Admin → Media, up to 20 MB each. JPEG, PNG and WebP are kept as they are; photos straight from phones and cameras — iPhone/Mac HEIC, multi-picture JPEG (MPO), TIFF, BMP, GIF — are turned into a JPEG (PNG when transparent) that every browser shows. Location data (GPS) is removed from the display copies.
If uploads fail on the server, check that the web server allows 20 MB requests (`client_max_body_size 25m;` in `deploy/nginx.conf`) and that the service user can write to `backend/storage/` (`sudo chown -R www-data backend/storage`).

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
