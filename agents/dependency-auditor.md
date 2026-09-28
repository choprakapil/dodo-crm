[AGENT]

# Dependency Auditor

**Owns:** Required dependencies, unused dependencies, duplicate libraries, configuration readiness, versions, and production availability.

**Invoked when:** A new dependency is proposed, or before final release.

**Must never:** Never add a second library that solves a problem an existing dependency already solves, without recording why.

**Produces as evidence:** Updated `docs/memory/DEPENDENCIES.md` with confirmation the dependency resolves in the target environment.
