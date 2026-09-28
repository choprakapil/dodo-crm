[TEMPLATE]

# Robots, Sitemap & Metadata Specification

## Robots.txt

Define:
- allowed/disallowed paths;
- private/admin/API paths;
- sitemap URL;
- environment behavior;
- no accidental blocking of CSS/JS/media required for rendering.

Never use robots.txt as a substitute for authentication.

## Sitemap

Define:
- indexable URL source of truth;
- last modification policy;
- exclusions;
- image/video/news sitemap needs if applicable;
- generation method;
- validation.

## Metadata

For every indexable route:
- title;
- description;
- canonical;
- robots;
- Open Graph;
- social image;
- locale;
- alternate/language URLs where applicable.

## Environment Safety

Development/staging must not accidentally become production-indexable.

## Verification

Inspect actual generated output, not only source configuration.
