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

cd ../frontend && yarn install && yarn build   # optional: frontend/build is already included

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

**Backups:** back up the MongoDB database (`mongodump --db uspindia`) and the `backend/storage/` folder — together they are the whole site.

## Live editor

- **Edit Header** (bottom toolbar, or the “Edit header colours & layout” button on the header): brand & logo, navigation, and *Style & spacing* — header background, the line under the header, brand and subtitle colours, menu-bar background, menu text, hover/current colour, the lines between menu items, dropdown and mobile-menu colours, fonts, letter case and spacing, header height and the space below it. Changes show immediately; **Save header** publishes them on every page.
- The editor panels open beside the page. Drag the title to move a panel, drag its left/right/bottom edges or corners to resize it; it never leaves the screen and remembers where you put it. The dock button puts it back on the right.
- Click text on the page and type. Click a photo to replace it, or to **crop** it: pick a shape (Original, Square, 4:3, 3:2, 16:9, 3:4, 4:5), zoom with the slider, and drag the photo to choose what shows.
- Drag the dark grip to move an element, the red handles to resize it; arrow keys nudge (Shift = 10px).
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
