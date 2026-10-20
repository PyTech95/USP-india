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

# 2a. Quickest: build the frontend once — the backend then serves the whole site on http://localhost:8001
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

cd ../frontend && yarn install && yarn build

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

- Click text on the page and type. Click a photo to replace it, or to **crop** it: pick a shape (Original, Square, 4:3, 3:2, 16:9, 3:4, 4:5), zoom with the slider, and drag the photo to choose what shows.
- Drag the dark grip to move an element, the red handles to resize it; arrow keys nudge (Shift = 10px).
- `Ctrl/⌘+S` saves and publishes, `Ctrl/⌘+Z` undoes, `Esc` deselects.

## Notes

- Email sending is not set up: password-reset and invite links are written to the server log.
- `backend/scripts/prepare_content_release.py` rebuilds `content_release.json` from a database you have marked as the content source (`--initialize`). Only needed when moving content between installations.
