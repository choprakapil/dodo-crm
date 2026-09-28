---
name: api-contracts
description: "Use when designing, changing, or reviewing any API endpoint, request/response schema, or error contract."
---

# API Contracts

**Purpose:** Define explicit, developer-friendly request/response/error contracts and keep every consumer synchronized with them.

## When to use this skill
Use when designing, changing, or reviewing any API endpoint, request/response schema, or error contract.

## Steps
1. Write the request schema, response schema, status codes, and error shapes before writing implementation code.
2. Check `docs/memory/API_CONTRACTS.md` for an existing contract covering this resource before creating a new one.
3. Update the contract and all known consumers together in the same task; never let the contract and the implementation drift.
4. Record the finalized contract in `docs/memory/API_CONTRACTS.md`.

## Evidence required
The exact request/response examples used in a real test call, plus the file path of the updated contract record.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
