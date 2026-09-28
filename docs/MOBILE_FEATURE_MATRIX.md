[STATE]

# Mobile Feature Matrix

Tracks feature parity across Web, iOS, and Android. Every feature that exists
on the web must either be marked complete on mobile, explicitly deferred with a
linked task, or marked "Not in scope" with a reason.

**Status codes:**
- `✓ DONE` — implemented, tested, verified on device/simulator
- `IN_PROGRESS` — currently being built
- `TODO` — planned, not yet started
- `BLOCKED` — linked to a blocked task (see docs/BLOCKED_TASKS.md)
- `DEFERRED` — out of scope for current milestone (must have a reason)
- `N/A` — this platform will never have this feature (must have a reason)

---

## Feature Matrix

| Feature | Web | iOS | Android | Notes |
|---|---|---|---|---|
| User registration | TODO | TODO | TODO | |
| User login | TODO | TODO | TODO | |
| Password reset | TODO | TODO | TODO | |
| User profile | TODO | TODO | TODO | |
| [Feature name] | TODO | TODO | TODO | |

---

## Mobile-Only Features

Features that exist only on mobile (push notifications, deep links, etc.):

| Feature | iOS | Android | Notes |
|---|---|---|---|
| Push notifications | TODO | TODO | |
| Deep links | TODO | TODO | |
| Biometric login | TODO | TODO | |
| Offline mode | TODO | TODO | |

---

## Web-Only Features

Features that are intentionally web-only:

| Feature | Reason | Decision |
|---|---|---|
| [e.g. Admin panel] | Admin tools are desktop-only; mobile admin is out of scope | DECISION-XXX |
