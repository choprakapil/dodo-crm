[RULE]

# SEO & Information Architecture System

SEO is part of product architecture.

## Route SEO Record

Every indexable route must define:

| Field | Required |
|---|---|
| URL/path | Yes |
| Search intent | Yes |
| Primary topic | Yes |
| H1 | Exactly one intentional H1 |
| H2/H3 structure | Yes |
| Title | Yes |
| Description | Yes |
| Canonical | Yes |
| Index/follow | Yes |
| Breadcrumb strategy | When useful |
| Internal links | Yes |
| Structured data | Eligibility decision |
| Primary image | Yes where relevant |
| Image alt | Yes |
| Sitemap inclusion | Explicit decision |

## Heading Hierarchy

Rules:
- one intentional H1 per page;
- headings describe content, not styling;
- never choose H2 merely because it "looks smaller";
- do not skip levels without a documented reason;
- visual size is controlled by CSS, semantic level by HTML.

## Internal Linking

Links should help users and search engines understand relationships:
- parent → child;
- category → detail;
- related content;
- conversion route;
- breadcrumb;
- contextual references.

Avoid artificial keyword stuffing.

## Technical SEO

Verify:
- canonical;
- robots directives;
- `robots.txt`;
- XML sitemap;
- clean URLs;
- redirects;
- 404 handling;
- trailing slash policy;
- duplicate-content controls;
- pagination strategy;
- Open Graph;
- social cards;
- structured data;
- language/locale strategy where applicable.

## Structured Data

Use only schemas that accurately describe visible/real content. Validate generated JSON-LD and do not fabricate reviews, prices, ratings, events, organizations, or other claims.

## SEO & JavaScript

Critical indexable content must not depend on fragile client-only rendering when server/static rendering is practical.

## SEO QA

Run a route-by-route crawl before release and record:
- status;
- canonical;
- title;
- description;
- H1;
- indexability;
- internal links;
- image alt;
- structured data;
- sitemap inclusion.
