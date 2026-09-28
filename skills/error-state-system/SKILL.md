---
name: error-state-system
description: Use when implementing or auditing loading, empty, offline, timeout, 404, 403, 429, 500, validation, or server-error experiences.
---

# Error State System

1. Enumerate applicable states.
2. Define user-safe copy and recovery action.
3. Define whether retry is safe.
4. Preserve user context where safe.
5. Implement route/component boundaries.
6. Test actual failures, not simulated success.
7. Verify no secrets/internal errors leak.
8. Verify mobile and keyboard behavior.
9. Record observed evidence.
