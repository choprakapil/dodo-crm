---
name: workflow-state-design
description: "Use for workflows with statuses, approvals, bookings, KYC, payments, handover, publishing, availability, permissions, or other state transitions."
---

# Workflow State Design

Create a state table:

| State | Allowed transitions | Actor/permission | Preconditions | UI actions | Success | Failure | Recovery |
|---|---|---|---|---|---|---|---|

Derive UI actions from state + permission + precondition. Do not expose impossible transitions. Define loading, success, failure, retry, and domain-specific states.
