[RULE]

# Multi-Platform Completeness Model

## Platforms

Treat these as separate delivery surfaces:

### Public Web
- desktop;
- tablet;
- mobile;
- slow network;
- accessibility;
- SEO;
- share/social previews;
- installability/PWA if required.

### Admin Web
- desktop-first;
- tablet fallback;
- role-based access;
- audit trail;
- bulk operations;
- search/filter;
- permissions;
- exports;
- error/recovery;
- responsive critical actions.

### Android
- authentication/session;
- deep links;
- push notifications;
- permissions;
- offline/cache behavior;
- background restrictions;
- file/media handling;
- network failure;
- device/back-button behavior;
- accessibility;
- release configuration.

### iOS
- authentication/session;
- universal links;
- push notifications;
- permissions;
- offline/cache behavior;
- background restrictions;
- file/media handling;
- network failure;
- navigation gestures;
- accessibility;
- release configuration.

### Backend/API
- contract;
- validation;
- authorization;
- idempotency;
- pagination;
- filtering;
- rate limiting;
- caching;
- observability;
- migrations;
- backup/recovery;
- error contract.

### Infrastructure
- development;
- staging;
- production;
- secrets;
- CI/CD;
- health checks;
- logging;
- monitoring;
- backups;
- rollback;
- CDN/cache;
- database;
- object storage;
- DNS/SSL.

## Cross-Platform Feature Rule

A feature is not complete until every platform marked applicable in the Feature Completion Matrix is complete.

Example:

`User Profile`
- Web: complete
- Admin: complete
- Android: complete
- iOS: complete
- API: complete
- Notifications: complete if applicable
- Analytics: complete if applicable

Do not mark the product feature "complete" merely because the web UI works.

## Platform-Specific Quality

Do not force identical UX across platforms. Share:
- domain rules;
- API contracts;
- design tokens where practical;
- validation rules;
- analytics taxonomy.

Allow platform-native interaction patterns where they improve usability.
