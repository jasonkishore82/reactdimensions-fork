# 3D Credit Card

A black credit card rendered in 3D with React and Three.js (via `@react-three/fiber` and `@react-three/drei`).

## Run

```bash
npm install
npm run dev
```

## Features

- **Physically based materials**: `MeshPhysicalMaterial` with a clear-coat layer, a slight iridescent sheen, foil-like metallic text (via roughness/metalness maps) and raised lettering (bump map).
- **Reflections**: a studio environment built from light panels that slowly rotates, so reflections move across the card. No HDR download needed.
- **Moving highlight**: a point light follows the cursor so the specular hotspot sweeps across the surface.
- **Gold EMV chip** with engraved contact pads.
- **Spring physics**: drag to spin, flick to flip with momentum, double-click to turn over. The card settles onto the nearest face with a damped spring and leans toward the cursor on hover.
- Card proportions follow the ISO ID-1 standard (85.6 × 53.98 mm). All artwork is drawn at runtime on canvas, so there are no image assets.

## Files

- `src/App.jsx` – canvas, lights, environment, shadow
- `src/Card.jsx` – card geometry, materials and drag/spring physics
- `src/textures.js` – canvas drawing for the front, back and chip
