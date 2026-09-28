[RULE]

# Slow Network, Offline & Unreliable Connection Strategy

The website must remain usable on:
- fast broadband;
- average mobile data;
- high-latency connections;
- packet loss;
- temporary offline periods;
- slow third-party resources.

## Loading Strategy

1. Send useful HTML early where architecture permits.
2. Render critical content before non-critical enhancement.
3. Reserve image dimensions to prevent layout shifts.
4. Lazy-load below-the-fold media.
5. Defer non-essential JavaScript.
6. Delay third-party scripts until justified.
7. Use responsive image sources.
8. Avoid blocking the page on analytics, chat, maps, or decorative effects.

## Slow Connection Behavior

When a request is slow:
- keep the page responsive;
- show an intentional loading state;
- do not flicker between loading and error;
- allow cancellation where useful;
- avoid starting duplicate requests;
- show retry only after a meaningful failure.

## Offline Behavior

Where the application benefits from it:
- detect offline state;
- preserve unsent user work locally when safe;
- show an offline banner/status;
- queue safe idempotent actions only if explicitly designed;
- reconcile when connection returns;
- never silently discard user input.

## Third-Party Failure

A broken analytics, chat, font, map, or external media service must not break the primary experience.

## Performance Verification

Test at least:
- throttled slow mobile connection;
- high latency;
- cache disabled;
- cold load;
- repeat load;
- JavaScript disabled where the route is expected to remain meaningfully usable.

Record observed evidence.
