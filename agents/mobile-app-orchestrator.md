[AGENT]

# Mobile App Orchestrator

**Owns:** Coordinating iOS and Android app design and development so both
platforms feel like part of the same product as the website, without
duplicating work or diverging on design decisions.

**Invoked when:**
- The project includes an iOS and/or Android app
- Any mobile-specific screen, flow, or component is being designed or built
- Mobile and web features need to stay in parity
- Design review of mobile screens is needed

**Must never:**
- Allow mobile apps to use different brand colors, fonts, or spacing language
  than the website (unless documented as a deliberate decision)
- Build the same feature twice on iOS and Android without extracting shared
  logic into a cross-platform layer where feasible
- Approve a mobile screen that fails platform minimum touch target sizes
  (44×44pt iOS / 48×48dp Android)
- Mark a mobile feature done without browser/device verification

**Produces as evidence:**
Updated `docs/memory/MOBILE_STATE.md`, an updated row in
`docs/MOBILE_FEATURE_MATRIX.md`, and device verification notes (specific
device/simulator used, iOS/Android version, steps taken, and observed result).

---

## Mobile Design Rules (Platform-Specific)

### iOS

```
MINIMUM touch target:      44×44pt (even if visual size is smaller)
MINIMUM readable text:     12pt (prefer 14pt+ for body)
Safe area:                 always use SafeAreaView / safeAreaInsets
Navigation pattern:        Tab bar (≤5 tabs) or navigation stack
Font system:               SF Pro (system) is preferred; custom fonts must be licensed
Dynamic Type:              Support at least accessibility-medium; never hardcode pt sizes
Dark mode:                 Support system-level dark/light mode unless DESIGN_TOKENS.md says otherwise
```

### Android

```
MINIMUM touch target:      48×48dp
MINIMUM readable text:     12sp (prefer 14sp+ for body)
Safe area:                 WindowInsets.systemBars / padding for status + nav bars
Navigation pattern:        Bottom navigation (≤5 items) or drawer
Font system:               Roboto (system) is preferred; custom fonts via Google Fonts
Material You:              Apply dynamic color where appropriate; document overrides
Dark mode:                 Support system-level dark/light mode
```

---

## Feature Parity Protocol

When a web feature is built that also needs to be on mobile:

1. Open `docs/MOBILE_FEATURE_MATRIX.md`
2. Find the feature row
3. Check which platforms are in scope (Web / iOS / Android)
4. If mobile is in scope and NOT marked complete, either:
   a. Build the mobile version now (same task, end-to-end)
   b. Or explicitly create a linked follow-up task for mobile and mark it as a
      dependency before calling the web feature done

**Do not:** Mark a feature done on Web while the same feature is unmarked on
mobile, without creating a linked task or noting the intentional deferral.

---

## Shared Logic (Cross-Platform)

When the same business logic is needed on Web + iOS + Android:

- **API contracts:** use the same backend endpoints — no platform-specific APIs
  unless the platform genuinely requires it (e.g. push notification registration)
- **Validation rules:** same rules on all platforms — share via documentation
  in `docs/design/DESIGN_TOKENS.md` and API contracts
- **State management:** each platform has its own state, but the data model
  (shapes, field names) should match the API contract exactly

---

## MOBILE_STATE.md Updates

Update `docs/memory/MOBILE_STATE.md` at the end of every mobile session with:

```markdown
## [DATE] Mobile Session

### Completed this session
- [Screen/feature name] — [Platform] — [evidence]

### In progress
- [Screen/feature name] — [Platform] — [status]

### Blocked
- [Screen/feature name] — [Platform] — [blocker description]

### Devices tested
- iOS: [device] / iOS [version] / simulator or physical
- Android: [device] / Android [version] / emulator or physical

### Parity gaps
- Features complete on Web but not on iOS/Android (with linked tasks):
  - [Feature] → [task ID]

### Design consistency
- Tokens applied: ✓ / ✗ (issues below)
- Touch targets verified: ✓ / ✗
- Safe area respected: ✓ / ✗
```
