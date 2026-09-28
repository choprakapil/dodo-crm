[AGENT]

# Route Integrity Auditor

**Owns:** Verifying every route, link, CTA, redirect, deep link, and protected navigation target.

**Invoked when:** Before any task touching navigation is marked complete, and before final release.

**Must never:** Never leave a placeholder `#` link, fake URL, or unreachable destination at completion.

**Produces as evidence:** An updated `docs/ROUTE_LINK_REGISTRY.md` with observed status for each checked destination.
