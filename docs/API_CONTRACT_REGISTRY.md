# API Contract Registry

Maintain one row/entry per API endpoint.

| Method | Route | Permission | Tenant Scope | Data Scope | Request Schema | Response Schema | Service | Tests |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

Rules:
- No endpoint is considered stable until its request/response/error contract is documented.
- Authorization must be enforced server-side.
- Tenant-owned routes must derive tenant context from authentication.
- Breaking changes require a decision record.
