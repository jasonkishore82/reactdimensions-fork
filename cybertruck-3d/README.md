# 3D Electric Pickup

An angular stainless-steel electric pickup modelled in React + Three.js (`@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`). Everything is built from code: no model files or image assets.

## Run

```bash
npm install
npm run dev
```

## Features

**Model**
- Faceted body built from flat panels: a side profile with angular wheel arches, plus a cabin made from cross-sections (nose → roof peak → tailgate).
- Tinted glass windshield, roof and side windows, inset so a steel frame shows around each one. Slatted tonneau cover over the bed.
- Dark wheel wells, chamfered bumpers, fender flares, side mirrors, a single long wiper, shoulder crease and panel seams.
- Off-road tyres with tread and angular aero wheel covers.

**Lighting**
- Brushed stainless steel: metallic `MeshPhysicalMaterial` with anisotropic, streaked roughness.
- Studio reflections from strip lights and softboxes that slowly drift, so reflections slide along the panels. No HDR download.
- Glossy studio floor with blurred real-time reflections, fading into the backdrop with fog.
- Soft shadows (PCSS) and screen-space ambient occlusion (N8AO) for contact shading.
- Real headlights: the front light bar casts a spotlight onto the floor and the tail bar throws a red glow. Toggle with **Lights** (they fade like LEDs).
- AgX filmic tone mapping, so bright reflections roll off smoothly instead of clipping. Bloom glows only the light bars.
- Phones and tablets get lighter settings automatically (add `?lite` to the URL to force them).

**Driving**
- Keyboard: **W A S D** or arrow keys to drive and steer, **Space** to brake, **R** to reset, **L** for lights.
- Phones and tablets get on-screen buttons: steer left/right, accelerate, reverse and brake.
- Bicycle-model vehicle physics: acceleration that fades toward top speed (~80 km/h), drag and rolling resistance, brake-then-reverse, and less steering lock at speed.
- Front wheels steer, all wheels roll by distance travelled, and brake lights flare when slowing.
- Suspension: the body rolls out of corners, squats when accelerating and dives when braking, on damped springs. **Bounce** or double-tap to compress it.
- Traffic cones (a slalom and a ring) get pushed, spun and tipped over when hit.
- Chase camera swings behind the truck when driving. Drag to look around; when parked it eases into a turntable (**Auto-spin**).

## Files

- `src/geometry.js`: body, cabin, glass panels, flares and tyre geometry
- `src/textures.js`: canvas-drawn steel, tread, wheel cover, slats
- `src/Truck.jsx`: materials, assembly, driving physics and camera
- `src/Cones.jsx`: traffic cones and collisions
- `src/controls.js`: shared keyboard/touch input and vehicle state
- `src/App.jsx`: lighting, environment, shadow and bloom
