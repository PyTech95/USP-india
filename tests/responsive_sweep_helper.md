Responsive sweep (iteration_27 baseline)
- probe: /app/tests/responsive_probe.js (page.evaluate(open(...).read()))
- fixtures of public GET data: /app/test_reports/responsive_fixtures/{preview,prod}/ (page_<key>.json, site.json, notes.json)
- replay mode "prod": route /api/public/* and /api/media/* to https://launch-pad-462.emergent.host via route.continue_(url=...) (GET only; all non-GET aborted)
- reduced_motion="reduce" emulated so reveal animations never hide content
- ignore offenders with left < -5000 (skip link / sr-only / honeypot)
