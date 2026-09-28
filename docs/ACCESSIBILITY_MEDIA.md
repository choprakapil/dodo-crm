[RULE]

# Accessibility & Inclusive Interaction

## Required

- semantic landmarks;
- keyboard access;
- visible focus;
- logical tab order;
- accessible names;
- labels and errors connected to inputs;
- sufficient contrast;
- touch targets appropriate to the device;
- reduced-motion support;
- no color-only meaning;
- no hover-only critical information;
- meaningful screen-reader order.

## Motion

Respect `prefers-reduced-motion`. The reduced-motion experience must remain complete, not merely disable everything and leave the user confused.

## Forms

Every field needs:
- visible or programmatically associated label;
- instructions where needed;
- validation message;
- error association;
- safe preservation of input.

## Modals / Drawers

- focus moves intentionally;
- escape behavior is defined;
- background interaction is blocked only when appropriate;
- focus returns to the triggering control.

## Accessibility QA

Test keyboard-only navigation and a screen-reader pass for critical flows. Record actual evidence.
