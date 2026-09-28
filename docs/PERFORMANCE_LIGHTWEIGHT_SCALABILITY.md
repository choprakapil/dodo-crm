[RULE]

# Lightweight, Fast & Scalable Web Architecture

## Principle

The project should be lightweight by default and scalable by architecture, not by installing a large framework for every problem.

## Performance Budget Template

Freeze project-specific budgets before implementation:

| Resource | Budget |
|---|---|
| First-view JS | Define per route |
| CSS | Define per route |
| Images | Define above-fold + total |
| Fonts | Define families/weights |
| Third-party JS | Explicit allow-list |
| Critical requests | Define |
| LCP | Target |
| INP | Target |
| CLS | Target |
| API latency | Define p95 |
| Route JS chunks | Define |

Budgets must be measurable, not adjectives like "fast".

## JavaScript Rules

- Prefer server-rendered/static output where appropriate.
- Ship client JavaScript only for interactive behavior.
- Split route-level and feature-level code.
- Lazy-load expensive libraries.
- Avoid duplicate libraries solving the same problem.
- Avoid global state unless justified.
- Remove dead code and unused exports.
- Do not ship admin/editor functionality to public routes.

## CSS Rules

- Use design tokens.
- Avoid duplicated component styles.
- Avoid unnecessary utility-library expansion.
- Keep critical styling small.
- Avoid layout-triggering animation.

## Scalability Rules

Define:
- caching;
- pagination;
- query limits;
- rate limits;
- database indexes;
- connection pooling;
- CDN/media strategy;
- background jobs where needed;
- observability;
- graceful degradation.

Do not optimize imaginary scale. Record the expected traffic and bottlenecks.

## Production Checks

Before release:
- production build;
- bundle analysis where applicable;
- network waterfall review;
- image payload review;
- third-party review;
- console error review;
- mobile performance review;
- cache behavior review.
