[RULE]

# Project Execution Order

The exact feature order must be generated from the actual project after discovery. Use this default dependency-aware sequence:

1. Project discovery and audit
2. Complete product/feature inventory
3. Route/platform inventory
4. Architecture decisions
5. Design system
6. Database/domain model
7. API contracts
8. Authentication/authorization foundation
9. Infrastructure/environment foundation
10. Shared frontend foundations
11. Shared mobile foundations
12. Public web vertical slices
13. Admin vertical slices
14. Android vertical slices
15. iOS vertical slices
16. Integrations/notifications
17. Analytics/observability
18. SEO/content migration
19. Performance hardening
20. Security hardening
21. Full cross-platform regression
22. Production readiness
23. Deployment
24. Post-deployment verification

## Important

Do not blindly follow this order if dependency analysis shows a better sequence.

The orchestrator must explain:
- what is ready;
- what is blocked;
- what is highest priority;
- why the next slice is next.

## One-Slice Rule

At any moment, there should be one clearly active vertical slice unless parallel execution is explicitly safe and documented.

Parallel work must not create conflicting schema, API, design, or dependency decisions.
