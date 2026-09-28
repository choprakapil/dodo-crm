[RULE]

# Error, Empty, Loading & Recovery System

## Required State Matrix

Every route and important interaction must define applicable states:

| State | Required behavior |
|---|---|
| Loading | Preserve layout; communicate progress without fake precision |
| Slow | Continue useful work; avoid premature failure |
| Empty | Explain why it is empty and what to do next |
| No results | Distinguish from empty dataset |
| Validation error | Point to exact field/action |
| Unauthorized | Explain access boundary safely |
| Forbidden | Explain lack of permission without leaking data |
| Not found | Useful 404 with navigation/search |
| Rate limited | Explain temporary limit and retry timing if known |
| Timeout | Offer retry and safe continuation |
| Offline | Preserve state; explain connection issue |
| Server error | Human message + retry/support path |
| Maintenance | Explain temporary unavailability |
| Session expired | Preserve safe context and provide sign-in path |

## Error Pages

Create bespoke versions of:
- 404 Not Found
- 403 Forbidden
- 429 Too Many Requests
- 500 Internal Server Error
- maintenance
- offline
- generic route failure

Each should fit the brand's visual language rather than using a framework default.

## Error Copy Rules

Good:
- says what happened;
- avoids blame;
- gives the next action;
- does not expose internals.

Bad:
- "Something went wrong!!!"
- raw HTTP/SQL/stack-trace output;
- "undefined";
- dead-end pages;
- retry buttons that cannot succeed.

## Recovery Rules

Retry only operations that are safe to retry. Use idempotency for write operations where duplicate execution is possible.

Preserve:
- unsaved form input where safe;
- navigation context;
- filters/search where appropriate.

Never repeatedly retry a failed write without an idempotency strategy.

## Browser/Runtime Boundaries

Define error boundaries at sensible route/component boundaries. A single widget failure should not unnecessarily blank the entire site.
