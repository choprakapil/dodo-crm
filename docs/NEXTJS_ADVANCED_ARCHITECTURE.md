[RULE]

# Next.js Advanced Architecture

Use modern Next.js capabilities deliberately rather than for novelty.

## Rendering

For every route/component decide:
- static generation;
- dynamic server rendering;
- streaming;
- client rendering;
- cached data;
- revalidated data;
- uncached request.

Default toward server-first architecture when it improves:
- performance;
- SEO;
- security;
- initial rendering.

Use Client Components only when interactivity/browser APIs/state require them.

## App Router

Use:
- route groups;
- layouts;
- nested layouts;
- loading UI;
- error boundaries;
- not-found boundaries;
- route-level metadata;
- parallel routes/intercepting routes when they solve real UX requirements.

Do not add advanced routing merely because it exists.

## Data & Cache

Define per request:
- source;
- freshness;
- cacheability;
- invalidation;
- revalidation;
- authorization;
- failure behavior.

Avoid accidental stale data and accidental cache leaks between users.

## Server Actions / Mutations

When using server-side mutations:
- validate inputs;
- authorize on the server;
- use idempotency where needed;
- return typed safe results;
- handle errors;
- revalidate affected data;
- prevent duplicate submissions;
- never trust client authorization.

## Route Handlers / API

Use explicit contracts:
- request schema;
- response schema;
- error codes;
- status codes;
- authentication;
- authorization;
- rate limits;
- observability.

## Streaming & Suspense

Use Suspense boundaries where slow independent sections should not block useful page content.

Never use skeletons merely as decoration. They should correspond to actual async boundaries.

## Images

Use the framework image optimization strategy where appropriate:
- responsive sizing;
- explicit dimensions;
- priority decisions;
- correct formats;
- art direction;
- accessible alt.

## Fonts

Load only required families/weights. Avoid shipping a font family with dozens of unused weights.

## Metadata

Use route-aware metadata. Ensure canonical, robots, Open Graph, and structured data reflect the actual route.

## Security

Never expose secrets through client bundles or public environment variables.

## Performance

Audit:
- client component size;
- hydration;
- third-party scripts;
- bundle duplication;
- dynamic imports;
- image payload;
- font payload;
- long tasks.

## Next.js Upgrade Rule

Before using a framework feature, verify the exact installed Next.js version and consult current project-compatible documentation. Do not write APIs based on memory if the project version may differ.
