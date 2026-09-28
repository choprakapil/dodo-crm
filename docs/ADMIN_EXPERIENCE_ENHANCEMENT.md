[RULE]

# Admin Experience Enhancement

## Added

- `agents/admin-experience-architect.md` — specialist agent for operational admin product experience.
- `skills/admin-experience-first/SKILL.md` — mandatory pre-implementation procedure for admin/internal work.
- `docs/design/ADMIN_EXPERIENCE_SYSTEM.md` — governing principles for workspace-first admin UX.

## Governance change

`AGENTS.md` now requires the Admin Experience layer before significant admin/internal UI work. This is intentional: the design-system layer governs visual consistency, while this layer governs the operational experience and interaction architecture.

## Main anti-pattern prevented

The AI must not default to a generic: sidebar + tabs + cards + table + modal structure without first validating the administrator workflow.
