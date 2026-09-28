[RULE]

# End-to-End Definition of Done

A feature is COMPLETE only when all applicable layers are working together.

## Layer 1 — Product
- user outcome works;
- requirements satisfied;
- edge cases defined.

## Layer 2 — Design
- final composition;
- responsive states;
- interaction states;
- reduced-motion;
- empty/loading/error states.

## Layer 3 — Frontend
- route;
- components;
- state management;
- validation;
- API integration;
- error handling.

## Layer 4 — Backend
- endpoint/action;
- validation;
- authorization;
- business logic;
- errors;
- rate limiting;
- observability.

## Layer 5 — Database
- schema;
- migration;
- constraints;
- indexes;
- transaction behavior;
- rollback strategy.

## Layer 6 — Admin
If the feature is administrable:
- create;
- view;
- edit;
- delete/archive;
- search;
- filter;
- permissions;
- audit;
- failure states.

## Layer 7 — Mobile
If applicable:
- Android;
- iOS;
- push/deep link;
- offline/network;
- device-specific behavior.

## Layer 8 — SEO
If public/indexable:
- route metadata;
- canonical;
- headings;
- sitemap;
- robots;
- structured data;
- internal links.

## Layer 9 — Accessibility
- keyboard;
- screen reader;
- focus;
- labels;
- contrast;
- reduced motion.

## Layer 10 — Performance
- route budget;
- image budget;
- JS budget;
- network behavior;
- cache behavior.

## Layer 11 — Security
- auth;
- authorization;
- validation;
- safe errors;
- secrets;
- headers where applicable.

## Layer 12 — QA
- unit tests where useful;
- integration tests;
- E2E critical flow;
- device/browser testing;
- regression;
- production build.

## Layer 13 — Operations
- logging;
- monitoring;
- health checks;
- alertability;
- rollback;
- documentation.

If a layer is not applicable, explicitly mark it N/A with a reason.
