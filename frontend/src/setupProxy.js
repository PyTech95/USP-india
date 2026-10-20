const http = require("http");

// Serves server-rendered HTML (real status codes, metadata, JSON-LD) for public routes.
const SKIP = /^\/(admin|api|static|sockjs-node|ws|__|favicon|manifest|asset-manifest|logo)/;

module.exports = function (app) {
  const backend = process.env.SSR_BACKEND_ORIGIN;
  if (!backend) return;
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const p = req.path;
    const meta = p === "/sitemap.xml" || p === "/robots.txt";
    if (!meta) {
      if (SKIP.test(p) || /\.[a-z0-9]+$/i.test(p) || p.includes("hot-update")) return next();
      if (!(req.headers.accept || "").includes("text/html")) return next();
    }
    const target = backend + (meta ? `/api${p}` : `/api/ssr?path=${encodeURIComponent(req.originalUrl)}`);
    const up = http.get(target, { timeout: 8000 }, (r) => {
      const headers = { "content-type": r.headers["content-type"] || "text/html", "cache-control": "no-cache" };
      if (r.headers.location) headers.location = r.headers.location;
      res.writeHead(r.statusCode, headers);
      r.pipe(res);
    });
    up.on("error", () => next());
    up.on("timeout", () => { up.destroy(); });
  });
};
