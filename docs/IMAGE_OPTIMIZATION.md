[RULE]

# Image & Media Quality System

## Every Image Must Have Intent

Classify each image:
- informative content → meaningful alt;
- functional image → action-oriented accessible name when needed;
- decorative image → empty alt;
- complex image/chart → adjacent text description;
- linked image → accessible link name.

Never use filenames as alt text.

## Image Performance

For each important image define:
- intrinsic dimensions;
- responsive source sizes;
- modern format strategy;
- compression;
- loading priority;
- lazy/eager decision;
- decoding strategy;
- crop/aspect ratio;
- placeholder strategy.

Never lazy-load the primary above-the-fold image without a measured reason.

## Layout Stability

Reserve media space using dimensions or aspect-ratio. No image should cause avoidable layout shift after load.

## Art Direction

Use responsive image crops where the composition genuinely changes between mobile and desktop. Do not simply shrink a desktop hero into a mobile slot.

## Media Failure

Broken image behavior must have:
- meaningful fallback;
- preserved layout;
- accessible status where necessary.
