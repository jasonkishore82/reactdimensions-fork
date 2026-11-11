import TiltCard from '../lib/TiltCard.jsx'
import SpringButton from '../lib/SpringButton.jsx'
import MagneticButton from '../lib/MagneticButton.jsx'
import MeasureText from '../lib/MeasureText.jsx'
import DecodeText from '../lib/DecodeText.jsx'
import DraftingGrid from '../lib/DraftingGrid.jsx'
import LightSweep from '../lib/LightSweep.jsx'
import Cyclorama from '../lib/Cyclorama.jsx'
import GradientSweep from '../lib/GradientSweep.jsx'
import SoftHorizon from '../lib/SoftHorizon.jsx'
import ClearcoatCard from '../lib/ClearcoatCard.jsx'
import PickupModel from '../lib/PickupModel.jsx'
import SnakeModel from '../lib/SnakeModel.jsx'
import TurntableModel from '../lib/TurntableModel.jsx'
import VinylRecord from '../lib/VinylRecord.jsx'
import SunglassesModel from '../lib/SunglassesModel.jsx'
import WatchModel from '../lib/WatchModel.jsx'
import LaptopModel from '../lib/LaptopModel.jsx'
import BottleModel from '../lib/BottleModel.jsx'
import TvModel from '../lib/TvModel.jsx'
import PhoneModel from '../lib/PhoneModel.jsx'
import HeadphonesModel from '../lib/HeadphonesModel.jsx'
import IpadModel from '../lib/IpadModel.jsx'
import TabletModel from '../lib/TabletModel.jsx'
import CradleModel from '../lib/CradleModel.jsx'

// Raw source of every component, for the Code tab.
const SOURCES = import.meta.glob(['../lib/*.jsx', '../Card.jsx', '../Hero3D.jsx', '../pickup/*.{js,jsx}', '../snake/*.{js,jsx}', '../turntable/*.{js,jsx}', '../vinyl/*.{js,jsx}', '../sunglasses/*.{js,jsx}', '../watch/*.{js,jsx}', '../laptop/*.{js,jsx}', '../bottle/*.{js,jsx}', '../tv/*.{js,jsx}', '../phone/*.{js,jsx}', '../headphones/*.{js,jsx}', '../ipad/*.{js,jsx}', '../tablet/*.{js,jsx}', '../cradle/*.{js,jsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
})
// Files are named 'X.jsx' (in lib/ or src/) or 'pickup/X.jsx'.
const src = (file) => SOURCES[`../lib/${file}`] ?? SOURCES[`../${file}`] ?? ''

export const CATEGORIES = ['Text', 'Interactions', 'UI', '3D & Materials', 'Backgrounds']

// Controls: range | toggle | select | text | color
export const COMPONENTS = [
  {
    slug: 'measure-text',
    name: 'Measure Text',
    category: 'Text',
    isNew: true,
    description: 'Text that rises in and measures its own width.',
    controls: [
      { name: 'text', type: 'text', default: 'Measured.' },
      { name: 'stagger', type: 'range', min: 10, max: 150, step: 5, default: 45, unit: 'ms' },
      { name: 'duration', type: 'range', min: 300, max: 2000, step: 50, default: 900, unit: 'ms' },
      { name: 'showDimension', type: 'toggle', default: true },
      { name: 'lineColor', type: 'color', default: '#ff4d1a' },
    ],
    replay: true,
    preview: (p) => <MeasureText {...p} style={{ font: '400 clamp(56px, 9vw, 110px)/1 var(--serif)' }} />,
    files: ['MeasureText.jsx'],
    deps: [],
  },
  {
    slug: 'decode-text',
    name: 'Decode Text',
    category: 'Text',
    description: 'Text that scrambles, then resolves letter by letter.',
    controls: [
      { name: 'text', type: 'text', default: 'REACT DIMENSIONS' },
      { name: 'speed', type: 'range', min: 15, max: 120, step: 5, default: 40, unit: 'ms' },
      { name: 'scrambles', type: 'range', min: 1, max: 15, step: 1, default: 6 },
      { name: 'trigger', type: 'select', options: ['mount', 'hover'], default: 'mount' },
    ],
    replay: true,
    preview: (p) => <DecodeText {...p} style={{ fontSize: 'clamp(28px, 5vw, 56px)' }} />,
    files: ['DecodeText.jsx'],
    deps: [],
  },
  {
    slug: 'tilt-card',
    name: 'Tilt Card',
    category: 'Interactions',
    description: 'A card that tilts toward the pointer with moving glare.',
    controls: [
      { name: 'maxTilt', type: 'range', min: 2, max: 30, step: 1, default: 14, unit: 'Â°' },
      { name: 'scale', type: 'range', min: 1, max: 1.15, step: 0.01, default: 1.04 },
      { name: 'stiffness', type: 'range', min: 40, max: 400, step: 10, default: 170 },
      { name: 'damping', type: 'range', min: 4, max: 40, step: 1, default: 16 },
      { name: 'glare', type: 'toggle', default: true },
      { name: 'glareOpacity', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
    ],
    preview: (p) => (
      <TiltCard {...p} style={{ borderRadius: 18 }}>
        <div className="demo-tilt">
          <span className="demo-tilt-tag">PLATE 07</span>
          <span className="demo-tilt-title">
            Tilt <em>me</em>
          </span>
          <span className="demo-tilt-foot">240 Ã— 320 px Â· spring</span>
        </div>
      </TiltCard>
    ),
    files: ['TiltCard.jsx'],
    deps: [],
  },
  {
    slug: 'spring-button',
    name: 'Spring Button',
    category: 'Interactions',
    isNew: true,
    description: 'A button that presses in and springs back.',
    controls: [
      { name: 'depth', type: 'range', min: 2, max: 14, step: 1, default: 6, unit: 'px' },
      { name: 'stiffness', type: 'range', min: 100, max: 900, step: 20, default: 420 },
      { name: 'damping', type: 'range', min: 4, max: 40, step: 1, default: 14 },
      { name: 'color', type: 'color', default: '#15171a' },
    ],
    preview: (p) => <SpringButton {...p}>Press me</SpringButton>,
    files: ['SpringButton.jsx'],
    deps: [],
  },
  {
    slug: 'magnetic-button',
    name: 'Magnetic Button',
    category: 'Interactions',
    description: 'A button that pulls toward the cursor when it gets close.',
    controls: [
      { name: 'strength', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.4 },
      { name: 'radius', type: 'range', min: 40, max: 300, step: 10, default: 140, unit: 'px' },
      { name: 'stiffness', type: 'range', min: 40, max: 400, step: 10, default: 160 },
      { name: 'damping', type: 'range', min: 4, max: 40, step: 1, default: 14 },
    ],
    preview: (p) => <MagneticButton {...p}>Come closer</MagneticButton>,
    files: ['MagneticButton.jsx'],
    deps: [],
  },
  {
    slug: 'clearcoat-card',
    name: 'Clear-coat Card',
    category: '3D & Materials',
    isNew: true,
    description: 'A glossy 3D card you can drag, flip and customize.',
    controls: [
      { name: 'stiffness', type: 'range', min: 10, max: 200, step: 5, default: 55 },
      { name: 'damping', type: 'range', min: 1, max: 30, step: 0.5, default: 7.5 },
      { name: 'gloss', type: 'range', min: 0, max: 1, step: 0.02, default: 0.94 },
      { name: 'iridescence', type: 'range', min: 0, max: 1, step: 0.05, default: 0.25 },
      { name: 'color', type: 'color', default: '#34363b' },
      { name: 'brand', type: 'text', default: 'DIMENSIONS' },
      { name: 'tier', type: 'text', default: 'Studio Pass' },
      { name: 'number', type: 'text', default: '8560 5398 0003 2026' },
      { name: 'version', type: 'text', default: 'v1.0' },
      { name: 'expiresTop', type: 'text', default: 'EXPIRES' },
      { name: 'expiresBottom', type: 'text', default: 'END' },
      { name: 'expiry', type: 'text', default: '00-00' },
      { name: 'holder', type: 'text', default: 'FOUNDING MEMBER' },
      { name: 'cvv', type: 'text', default: '123' },
      { name: 'signatureNote', type: 'text', default: 'AUTHORIZED SIGNATURE â€” NOT VALID UNLESS SIGNED' },
      { name: 'backLine1', type: 'text', default: 'Rendered in real time. No image assets were used to make this card.' },
      { name: 'backLine2', type: 'text', default: '85.60 x 53.98 mm  /  clear-coat PBR  /  spring physics' },
      { name: 'backName', type: 'text', default: 'react-dimensions' },
    ],
    preview: (p) => <ClearcoatCard {...p} height="100%" />,
    fill: true,
    files: ['ClearcoatCard.jsx', 'Hero3D.jsx', 'Card.jsx'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'pickup',
    name: 'Pickup',
    category: '3D & Materials',
    isNew: true,
    description: 'An angular electric pickup you can orbit and drive.',
    controls: [
      { name: 'drivable', type: 'toggle', default: false },
      { name: 'lightsOn', type: 'toggle', default: true },
      { name: 'autoRotate', type: 'toggle', default: true },
      { name: 'roughness', type: 'range', min: 0.1, max: 0.8, step: 0.02, default: 0.36 },
      { name: 'color', type: 'color', default: '#d4d7da' },
    ],
    preview: (p) => <PickupModel {...p} height="100%" />,
    fill: true,
    files: ['PickupModel.jsx', 'pickup/PickupScene.jsx', 'pickup/Pickup.jsx', 'pickup/geometry.js', 'pickup/textures.js', 'pickup/controls.js', 'pickup/Cones.jsx'],
    deps: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'],
  },
  {
    slug: 'snake',
    name: 'Snake',
    category: '3D & Materials',
    isNew: true,
    description: 'A coiled 3D snake whose head follows the pointer.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Golden', values: { back: '#b9861c', belly: '#ecd38c', pattern: '#f0c449', eye: '#d4a72c', tongueColor: '#5a2228' } },
          { name: 'Obsidian', values: { back: '#171b2b', belly: '#d9c9a6', pattern: '#8a93ad', eye: '#6b3d18', tongueColor: '#e0627a' } },
          { name: 'Coral', values: { back: '#b83a22', belly: '#f3e7cc', pattern: '#1b1411', eye: '#e8c25a', tongueColor: '#c94a5a' } },
          { name: 'Viper', values: { back: '#3c5a2a', belly: '#d8d29a', pattern: '#1c2a14', eye: '#d9a521', tongueColor: '#d6455a' } },
          { name: 'Sapphire', values: { back: '#16408f', belly: '#cfe0f4', pattern: '#7fb4ff', eye: '#101a30', tongueColor: '#f06a8c' } },
          { name: 'Desert', values: { back: '#8a6a3f', belly: '#eadcc0', pattern: '#3a2814', eye: '#c79a2e', tongueColor: '#c9505e' } },
          { name: 'Albino', values: { back: '#e9d9a8', belly: '#fbf3dd', pattern: '#e7a04a', eye: '#c4303a', tongueColor: '#ef7a8d' } },
        ],
      },
      { name: 'mode', type: 'select', options: ['rear', 'slither'], default: 'rear' },
      { name: 'followPointer', type: 'toggle', default: true },
      { name: 'tongue', type: 'toggle', default: true },
      { name: 'back', type: 'color', default: '#b9861c' },
      { name: 'belly', type: 'color', default: '#ecd38c' },
      { name: 'pattern', type: 'color', default: '#f0c449' },
      { name: 'eye', type: 'color', default: '#d4a72c' },
      { name: 'tongueColor', type: 'color', default: '#5a2228' },
      { name: 'patternAmount', type: 'range', min: 0, max: 1, step: 0.05, default: 0.65 },
      { name: 'scales', type: 'range', min: 12, max: 36, step: 1, default: 18 },
      { name: 'gloss', type: 'range', min: 0, max: 1, step: 0.02, default: 0.7 },
    ],
    preview: (p) => <SnakeModel {...p} height="100%" />,
    fill: true,
    files: ['SnakeModel.jsx', 'snake/SnakeScene.jsx', 'snake/Snake.jsx', 'snake/body.js', 'snake/pose.js', 'snake/profile.js', 'snake/textures.js'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'turntable',
    name: 'Turntable',
    category: '3D & Materials',
    isNew: true,
    description: 'A record player you can power on, cue and scratch.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Walnut', values: { wood: '#7a4524', vinyl: '#0b0b0d', label: '#e3302b' } },
          { name: 'Oak', values: { wood: '#b98b55', vinyl: '#111114', label: '#2b5fd9' } },
          { name: 'Ebony', values: { wood: '#2b2019', vinyl: '#0b0b0d', label: '#d4a73a' } },
          { name: 'Cherry', values: { wood: '#8f3a24', vinyl: '#14110f', label: '#f2ead8' } },
          { name: 'Maple', values: { wood: '#d7ae74', vinyl: '#7a1d2a', label: '#f2ead8' } },
          { name: 'Studio', values: { wood: '#e6e2d8', vinyl: '#1a3a8a', label: '#f4b400' } },
        ],
      },
      { name: 'playing', type: 'toggle', default: true },
      { name: 'speed', type: 'select', options: ['33', '45'], default: '33' },
      { name: 'sound', type: 'toggle', default: false },
      { name: 'volume', type: 'range', min: 0, max: 1, step: 0.05, default: 0.7 },
      { name: 'wood', type: 'color', default: '#7a4524' },
      { name: 'finish', type: 'select', options: ['solid', 'marble', 'splatter'], default: 'solid' },
      { name: 'vinyl', type: 'color', default: '#0b0b0d' },
      { name: 'accent', type: 'color', default: '#ffffff' },
      { name: 'label', type: 'color', default: '#e3302b' },
      { name: 'labelText', type: 'text', default: 'SIDE A' },
      { name: 'grain', type: 'range', min: 0, max: 1, step: 0.05, default: 0.65 },
      { name: 'gloss', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
    ],
    // `set` lets the scene update the controls (pressing power in 3D, say).
    preview: (p, set) => <TurntableModel {...p} onChange={set} height="100%" />,
    fill: true,
    files: [
      'TurntableModel.jsx',
      'turntable/TurntableScene.jsx',
      'turntable/Turntable.jsx',
      'turntable/arm.js',
      'turntable/textures.js',
      'turntable/audio.js',
      'vinyl/textures.js',
    ],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'vinyl-record',
    name: 'Vinyl Record',
    category: '3D & Materials',
    isNew: true,
    description: 'A spinning vinyl record with a printed label and sleeve.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Classic', values: { vinyl: '#0b0b0d', finish: 'solid', label: '#e3302b', sleeveColor: '#e9e1d0' } },
          { name: 'Oxblood', values: { vinyl: '#6b1220', accent: '#e8c9a0', finish: 'marble', label: '#f2ead8', sleeveColor: '#2a2220' } },
          { name: 'Blue splatter', values: { vinyl: '#e9e4d6', accent: '#2c63d8', finish: 'splatter', label: '#2c63d8', sleeveColor: '#d8e4f7' } },
          { name: 'Mint', values: { vinyl: '#2f9e83', accent: '#ffffff', finish: 'marble', label: '#14201c', sleeveColor: '#14201c' } },
          { name: 'Gold', values: { vinyl: '#c79a2e', accent: '#5a3a0a', finish: 'marble', label: '#111111', sleeveColor: '#1a1a1a' } },
        ],
      },
      { name: 'spin', type: 'toggle', default: true },
      { name: 'rpm', type: 'range', min: 0, max: 78, step: 1, default: 33 },
      { name: 'tilt', type: 'toggle', default: true },
      { name: 'finish', type: 'select', options: ['solid', 'marble', 'splatter'], default: 'solid' },
      { name: 'vinyl', type: 'color', default: '#0b0b0d' },
      { name: 'accent', type: 'color', default: '#ffffff' },
      { name: 'label', type: 'color', default: '#e3302b' },
      { name: 'labelText', type: 'text', default: 'SIDE A' },
      { name: 'shine', type: 'range', min: 0, max: 1, step: 0.05, default: 0.7 },
      { name: 'sleeve', type: 'toggle', default: false },
      { name: 'sleeveColor', type: 'color', default: '#e9e1d0' },
      { name: 'pullOut', type: 'range', min: 0, max: 1, step: 0.02, default: 0.55 },
    ],
    preview: (p) => <VinylRecord {...p} height="100%" />,
    fill: true,
    files: ['VinylRecord.jsx', 'vinyl/VinylScene.jsx', 'vinyl/Vinyl.jsx', 'vinyl/textures.js'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'sunglasses',
    name: 'Sunglasses',
    category: '3D & Materials',
    isNew: true,
    description: 'Parametric sunglasses with six frame shapes and tinted lenses.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Classic', values: { shape: 'wayfarer', finish: 'gloss', frameColor: '#16120f', tipColor: '#16120f', lensColor: '#2a2a2f', mirror: 0, gradient: true } },
          { name: 'Aviator', values: { shape: 'aviator', finish: 'metal', frameColor: '#d4af37', tipColor: '#7a5a12', lensColor: '#3b3a2a', mirror: 0, gradient: true } },
          { name: 'Tortoise', values: { shape: 'round', finish: 'tortoise', frameColor: '#3b1d0c', accent: '#d99a2b', tipColor: '#2b1508', lensColor: '#3a2a1a', mirror: 0, gradient: true } },
          { name: 'Mirror cat-eye', values: { shape: 'cat-eye', finish: 'gloss', frameColor: '#f4efe6', tipColor: '#f4efe6', lensColor: '#4a3a5a', mirror: 0.9, mirrorColor: '#ff7ac8', gradient: false } },
          { name: 'Neon', values: { shape: 'square', finish: 'matte', frameColor: '#c8ff2e', tipColor: '#111111', lensColor: '#101014', mirror: 0, gradient: false } },
          { name: 'Silver hex', values: { shape: 'hexagon', finish: 'metal', frameColor: '#c8ccd4', tipColor: '#8a909a', lensColor: '#1b3a5c', mirror: 0.7, mirrorColor: '#5ec8ff', gradient: false } },
        ],
      },
      { name: 'shape', type: 'select', options: ['wayfarer', 'aviator', 'round', 'cat-eye', 'square', 'hexagon'], default: 'wayfarer' },
      { name: 'lensWidth', type: 'range', min: 1.4, max: 2.6, step: 0.05, default: 2 },
      { name: 'lensHeight', type: 'range', min: 1, max: 2.2, step: 0.05, default: 1.5 },
      { name: 'bridge', type: 'range', min: 0.2, max: 0.9, step: 0.02, default: 0.45 },
      { name: 'thickness', type: 'range', min: 0.05, max: 0.3, step: 0.01, default: 0.16 },
      { name: 'wrap', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
      { name: 'templeLength', type: 'range', min: 2.8, max: 4.6, step: 0.1, default: 3.6 },
      { name: 'finish', type: 'select', options: ['gloss', 'matte', 'metal', 'tortoise'], default: 'gloss' },
      { name: 'frameColor', type: 'color', default: '#16120f' },
      { name: 'accent', type: 'color', default: '#d99a2b' },
      { name: 'tipColor', type: 'color', default: '#16120f' },
      { name: 'lensColor', type: 'color', default: '#2a2a2f' },
      { name: 'lensOpacity', type: 'range', min: 0.3, max: 1, step: 0.02, default: 0.88 },
      { name: 'gradient', type: 'toggle', default: true },
      { name: 'mirror', type: 'range', min: 0, max: 1, step: 0.05, default: 0 },
      { name: 'mirrorColor', type: 'color', default: '#6aa8ff' },
      { name: 'fold', type: 'range', min: 0, max: 1, step: 0.02, default: 0 },
      { name: 'autoRotate', type: 'toggle', default: true },
    ],
    // `set` lets the scene update the controls (clicking the glasses folds them).
    preview: (p, set) => <SunglassesModel {...p} onChange={set} height="100%" />,
    fill: true,
    files: ['SunglassesModel.jsx', 'sunglasses/SunglassesScene.jsx', 'sunglasses/Sunglasses.jsx', 'sunglasses/build.js', 'sunglasses/shapes.js', 'sunglasses/textures.js'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'watch',
    name: 'Watch',
    category: '3D & Materials',
    isNew: true,
    description: 'An analog or smart watch with swappable straps.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Dress', values: { type: 'analog', strap: 'leather', caseColor: '#cdb26a', strapColor: '#4a2c17', dialColor: '#f1ede2', handsColor: '#1a1a1a', strapAccent: '#d8bb7a', dialStyle: 'index', accent: '#b3261e' } },
          { name: 'Diver', values: { type: 'analog', strap: 'sport', caseColor: '#b4bac2', strapColor: '#0d3b66', dialColor: '#0b2b4a', handsColor: '#f4f1e0', dialStyle: 'diver', bezelColor: '#14181d', accent: '#ff7a1a' } },
          { name: 'Field', values: { type: 'analog', strap: 'nylon', caseColor: '#2d2f33', strapColor: '#5a6b4a', dialColor: '#16181c', handsColor: '#ebe5cf', strapAccent: '#c8b98a', dialStyle: 'numerals', accent: '#e8c15a' } },
          { name: 'Smart graphite', values: { type: 'smart', strap: 'sport', caseColor: '#2b2c30', strapColor: '#2b2c30', dialColor: '#000000', smartFace: 'rings', accent: '#ff375f' } },
          { name: 'Smart silver', values: { type: 'smart', strap: 'nylon', caseColor: '#c9ccd2', strapColor: '#f0eee6', dialColor: '#000000', strapAccent: '#ff6b4a', smartFace: 'analog', accent: '#ff9f0a' } },
          { name: 'Smart gold', values: { type: 'smart', strap: 'metal', caseColor: '#c8a85a', strapColor: '#c8a85a', dialColor: '#0a0a0c', smartFace: 'digital', accent: '#ffd86b' } },
        ],
      },
      { name: 'type', type: 'select', options: ['analog', 'smart'], default: 'analog' },
      { name: 'strap', type: 'select', options: ['leather', 'sport', 'nylon', 'metal'], default: 'leather' },
      { name: 'caseColor', type: 'color', default: '#cfd2d8' },
      { name: 'strapColor', type: 'color', default: '#4a2c17' },
      { name: 'strapAccent', type: 'color', default: '#c9a15a' },
      { name: 'dialColor', type: 'color', default: '#f1ede2' },
      { name: 'handsColor', type: 'color', default: '#1a1a1a' },
      { name: 'accent', type: 'color', default: '#e8402a' },
      { name: 'dialStyle', type: 'select', options: ['index', 'numerals', 'diver'], default: 'index' },
      { name: 'bezelColor', type: 'color', default: '#14181d' },
      { name: 'smartFace', type: 'select', options: ['rings', 'analog', 'digital'], default: 'rings' },
      { name: 'time', type: 'select', options: ['live', '10:10'], default: 'live' },
      { name: 'shine', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
      { name: 'autoRotate', type: 'toggle', default: true },
    ],
    // `set` lets the scene update the controls (clicking the watch swaps it).
    preview: (p, set) => <WatchModel {...p} onChange={set} height="100%" />,
    fill: true,
    files: ['WatchModel.jsx', 'watch/WatchScene.jsx', 'watch/Watch.jsx', 'watch/Analog.jsx', 'watch/Smart.jsx', 'watch/Strap.jsx', 'watch/textures.js'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'laptop',
    name: 'Laptop',
    category: '3D & Materials',
    isNew: true,
    description: 'A thin aluminium laptop with a lid that opens and closes.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Orange', values: { bodyColor: '#ff6a13', keyColor: '#1a1412', wallpaper: '#ff7a1a' } },
          { name: 'Silver', values: { bodyColor: '#c9ccd2', keyColor: '#17181a', wallpaper: '#6a7cff' } },
          { name: 'Graphite', values: { bodyColor: '#6d7076', keyColor: '#121214', wallpaper: '#a45cff' } },
          { name: 'Midnight', values: { bodyColor: '#1d2433', keyColor: '#0e1016', wallpaper: '#2fd0c4' } },
          { name: 'Sand', values: { bodyColor: '#e6dccb', keyColor: '#1a1a1a', wallpaper: '#ffb35c' } },
          { name: 'Forest', values: { bodyColor: '#4c6b57', keyColor: '#101412', wallpaper: '#a6e04a' } },
          { name: 'Blue', values: { bodyColor: '#2f5d9e', keyColor: '#0e1220', wallpaper: '#4dc4ff' } },
          { name: 'Rose', values: { bodyColor: '#e8b4b8', keyColor: '#1a1214', wallpaper: '#ff6f91' } },
        ],
      },
      { name: 'bodyColor', type: 'color', default: '#ff6a13' },
      { name: 'keyColor', type: 'color', default: '#1a1412' },
      { name: 'wallpaper', type: 'color', default: '#ff7a1a' },
      { name: 'open', type: 'range', min: 0, max: 1, step: 0.02, default: 0.9 },
      { name: 'screenOn', type: 'toggle', default: true },
      { name: 'shine', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
      { name: 'autoRotate', type: 'toggle', default: true },
    ],
    // `set` lets the scene update the controls (clicking the lid opens or closes it).
    preview: (p, set) => <LaptopModel {...p} onChange={set} height="100%" />,
    fill: true,
    files: ['LaptopModel.jsx', 'laptop/LaptopScene.jsx', 'laptop/Laptop.jsx', 'laptop/Keyboard.jsx', 'laptop/Screen.jsx'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'glass-bottle',
    name: 'Glass Bottle',
    category: '3D & Materials',
    isNew: true,
    description: 'A swing-top glass bottle with real refraction.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Clear', values: { glass: '#ffffff', tint: '#bfe6df', tintStrength: 0.22, capColor: '#f2f1ec', gasket: '#c4161c', wireColor: '#c9cdd2', frost: 0 } },
          { name: 'Green', values: { glass: '#ffffff', tint: '#3f9a5c', tintStrength: 0.85, capColor: '#f2f1ec', gasket: '#c4161c', wireColor: '#c9cdd2', frost: 0 } },
          { name: 'Amber', values: { glass: '#ffffff', tint: '#d9801a', tintStrength: 0.9, capColor: '#2a1c10', gasket: '#e8c15a', wireColor: '#b9895a', frost: 0 } },
          { name: 'Cobalt', values: { glass: '#ffffff', tint: '#1f4fd6', tintStrength: 0.9, capColor: '#f2f1ec', gasket: '#f2f1ec', wireColor: '#c9cdd2', frost: 0 } },
          { name: 'Rose', values: { glass: '#ffffff', tint: '#f08ca8', tintStrength: 0.7, capColor: '#f6e8ea', gasket: '#d44a6e', wireColor: '#d8b28a', frost: 0 } },
          { name: 'Frosted', values: { glass: '#ffffff', tint: '#e6eef2', tintStrength: 0.15, capColor: '#2b2c30', gasket: '#2b2c30', wireColor: '#2b2c30', frost: 0.7 } },
        ],
      },
      { name: 'open', type: 'range', min: 0, max: 1, step: 0.02, default: 0 },
      { name: 'glass', type: 'color', default: '#ffffff' },
      { name: 'tint', type: 'color', default: '#bfe6df' },
      { name: 'tintStrength', type: 'range', min: 0, max: 1, step: 0.05, default: 0.22 },
      { name: 'capColor', type: 'color', default: '#f2f1ec' },
      { name: 'gasket', type: 'color', default: '#c4161c' },
      { name: 'wireColor', type: 'color', default: '#c9cdd2' },
      { name: 'droplets', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
      { name: 'frost', type: 'range', min: 0, max: 1, step: 0.05, default: 0 },
      { name: 'autoRotate', type: 'toggle', default: true },
    ],
    // `set` lets the scene update the controls (clicking the bottle opens it).
    preview: (p, set) => <BottleModel {...p} onChange={set} height="100%" />,
    fill: true,
    files: ['BottleModel.jsx', 'bottle/BottleScene.jsx', 'bottle/Bottle.jsx', 'bottle/profile.js'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'tv',
    name: 'TV',
    category: '3D & Materials',
    isNew: true,
    description: 'A TV you can resize from 32 to 100 inches at true scale.',
    controls: [
      {
        name: 'quickSize',
        type: 'presets',
        options: [
          { name: '32â€³', values: { size: 32 } },
          { name: '43â€³', values: { size: 43 } },
          { name: '55â€³', values: { size: 55 } },
          { name: '65â€³', values: { size: 65 } },
          { name: '75â€³', values: { size: 75 } },
          { name: '85â€³', values: { size: 85 } },
          { name: '100â€³', values: { size: 100 } },
        ],
      },
      { name: 'size', type: 'range', min: 32, max: 100, step: 1, default: 55, unit: 'â€³' },
      { name: 'mount', type: 'select', options: ['feet', 'pedestal', 'wall'], default: 'feet' },
      { name: 'content', type: 'select', options: ['home', 'wallpaper', 'off'], default: 'home' },
      { name: 'frameColor', type: 'color', default: '#15161a' },
      { name: 'standColor', type: 'color', default: '#2b2d33' },
      { name: 'wallpaper', type: 'color', default: '#3a7bff' },
      { name: 'bezel', type: 'range', min: 0.15, max: 1.2, step: 0.05, default: 0.45 },
      { name: 'wallColor', type: 'color', default: '#e9e5dd' },
      { name: 'consoleColor', type: 'color', default: '#9a7550' },
      { name: 'reference', type: 'toggle', default: true },
      { name: 'measure', type: 'toggle', default: true },
      { name: 'fitCamera', type: 'toggle', default: false },
      { name: 'autoRotate', type: 'toggle', default: false },
    ],
    preview: (p) => <TvModel {...p} height="100%" />,
    fill: true,
    files: ['TvModel.jsx', 'tv/TvScene.jsx', 'tv/Tv.jsx', 'tv/Screen.jsx', 'tv/Person.jsx'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'phone',
    name: 'Phone',
    category: '3D & Materials',
    isNew: true,
    description: 'A modern smartphone at real size that flips on click.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Titanium', values: { frameColor: '#8d8a85', backColor: '#a6a29b', cameraColor: '#2b2b2f', wallpaper: '#4f7cff' } },
          { name: 'Black', values: { frameColor: '#3a3b3f', backColor: '#25262a', cameraColor: '#101012', wallpaper: '#7a5cff' } },
          { name: 'White', values: { frameColor: '#d9d6cf', backColor: '#eeece6', cameraColor: '#8d8a85', wallpaper: '#ffb35c' } },
          { name: 'Orange', values: { frameColor: '#c9632a', backColor: '#ff6a13', cameraColor: '#5a2a10', wallpaper: '#ff7a1a' } },
          { name: 'Blue', values: { frameColor: '#4a5f82', backColor: '#5f7fb0', cameraColor: '#1d2a44', wallpaper: '#3aa0ff' } },
          { name: 'Green', values: { frameColor: '#5c6b58', backColor: '#7d9a78', cameraColor: '#26302a', wallpaper: '#8ad66a' } },
          { name: 'Pink', values: { frameColor: '#c9a9ad', backColor: '#f0c4cc', cameraColor: '#6b4a50', wallpaper: '#ff6f91' } },
          { name: 'Purple', values: { frameColor: '#7d6f94', backColor: '#a99bc4', cameraColor: '#3a3150', wallpaper: '#b57cff' } },
        ],
      },
      { name: 'view', type: 'select', options: ['front', 'back'], default: 'front' },
      { name: 'content', type: 'select', options: ['lock', 'home', 'off'], default: 'lock' },
      { name: 'frameColor', type: 'color', default: '#8d8a85' },
      { name: 'backColor', type: 'color', default: '#a6a29b' },
      { name: 'cameraColor', type: 'color', default: '#2b2b2f' },
      { name: 'wallpaper', type: 'color', default: '#4f7cff' },
      { name: 'finish', type: 'select', options: ['matte', 'gloss'], default: 'matte' },
      { name: 'shine', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
      { name: 'autoRotate', type: 'toggle', default: false },
    ],
    // `set` lets the scene update the controls (clicking the phone flips it).
    preview: (p, set) => <PhoneModel {...p} onChange={set} height="100%" />,
    fill: true,
    files: ['PhoneModel.jsx', 'phone/PhoneScene.jsx', 'phone/Phone.jsx', 'phone/Screen.jsx', 'phone/outline.js'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'headphones',
    name: 'Headphones',
    category: '3D & Materials',
    isNew: true,
    description: 'Over-ear headphones with cups that slide and fold.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Midnight', values: { bandColor: '#262c3d', padColor: '#262c3d', cupColor: '#16181e', accentColor: '#3b3f4b' } },
          { name: 'Stone', values: { bandColor: '#b9b7b0', padColor: '#b9b7b0', cupColor: '#d6d4cd', accentColor: '#8d8a85' } },
          { name: 'Ivory', values: { bandColor: '#ece7dc', padColor: '#ece7dc', cupColor: '#f6f2e9', accentColor: '#c9c3b4' } },
          { name: 'Orange', values: { bandColor: '#e5601a', padColor: '#e5601a', cupColor: '#ff7a2e', accentColor: '#3a1f10' } },
          { name: 'Sage', values: { bandColor: '#6f8468', padColor: '#6f8468', cupColor: '#86a07e', accentColor: '#2c382a' } },
          { name: 'Sky', values: { bandColor: '#5f86c4', padColor: '#5f86c4', cupColor: '#7aa0d8', accentColor: '#22304a' } },
          { name: 'Rose', values: { bandColor: '#d79aa6', padColor: '#d79aa6', cupColor: '#e9b4be', accentColor: '#6b4a52' } },
          { name: 'Two-tone', values: { bandColor: '#16181e', padColor: '#16181e', cupColor: '#ff6a13', accentColor: '#c8ccd4' } },
        ],
      },
      { name: 'bandColor', type: 'color', default: '#262c3d' },
      { name: 'padColor', type: 'color', default: '#262c3d' },
      { name: 'cupColor', type: 'color', default: '#16181e' },
      { name: 'accentColor', type: 'color', default: '#3b3f4b' },
      { name: 'finish', type: 'select', options: ['leather', 'matte', 'gloss'], default: 'leather' },
      { name: 'adjust', type: 'range', min: 0, max: 1, step: 0.02, default: 0.3 },
      { name: 'fold', type: 'range', min: 0, max: 1, step: 0.02, default: 0 },
      { name: 'autoRotate', type: 'toggle', default: false },
    ],
    // `set` lets the scene update the controls (clicking the headphones folds them).
    preview: (p, set) => <HeadphonesModel {...p} onChange={set} height="100%" />,
    fill: true,
    files: ['HeadphonesModel.jsx', 'headphones/HeadphonesScene.jsx', 'headphones/Headphones.jsx'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'ipad-bot',
    name: 'Tablet Bot',
    category: '3D & Materials',
    isNew: true,
    description: 'A tablet on a rolling stand whose screen is a face: eyes that follow you, six moods and a talking mouth.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Silver blue', values: { bodyColor: '#e2e3e5', eyeColor: '#2f7bff' } },
          { name: 'Space grey', values: { bodyColor: '#6d7076', eyeColor: '#4dffb8' } },
          { name: 'Starlight', values: { bodyColor: '#e9dfcf', eyeColor: '#ff9d3d' } },
          { name: 'Rose', values: { bodyColor: '#e8b4b8', eyeColor: '#ff5f9e' } },
          { name: 'Midnight', values: { bodyColor: '#1d2433', eyeColor: '#7aa8ff' } },
          { name: 'Sage', values: { bodyColor: '#a9b8a0', eyeColor: '#d6ff5c' } },
        ],
      },
      { name: 'mood', type: 'select', options: ['idle', 'curious', 'happy', 'surprised', 'sleepy', 'asleep'], default: 'idle' },
      { name: 'speaking', type: 'toggle', default: false },
      { name: 'follow', type: 'toggle', default: true },
      { name: 'bodyColor', type: 'color', default: '#e2e3e5' },
      { name: 'eyeColor', type: 'color', default: '#2f7bff' },
      { name: 'autoRotate', type: 'toggle', default: false },
    ],
    // `set` lets the scene update the controls (clicking it puts it to sleep).
    preview: (p, set) => <IpadModel {...p} onChange={set} height="100%" />,
    fill: true,
    files: ['IpadModel.jsx', 'ipad/IpadScene.jsx', 'ipad/Ipad.jsx'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'tablet',
    name: 'Tablet',
    category: '3D & Materials',
    isNew: true,
    description: 'A slim aluminium tablet with a live home screen, in landscape or portrait, that flips over to show its back.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Silver', values: { bodyColor: '#e2e3e5', wallpaper: '#3a7bff' } },
          { name: 'Space grey', values: { bodyColor: '#6d7076', wallpaper: '#a45cff' } },
          { name: 'Starlight', values: { bodyColor: '#e9dfcf', wallpaper: '#ff9d3d' } },
          { name: 'Rose', values: { bodyColor: '#e8b4b8', wallpaper: '#ff5f9e' } },
          { name: 'Midnight', values: { bodyColor: '#1d2433', wallpaper: '#2fd0c4' } },
          { name: 'Sage', values: { bodyColor: '#a9b8a0', wallpaper: '#a6e04a' } },
        ],
      },
      { name: 'bodyColor', type: 'color', default: '#e2e3e5' },
      { name: 'wallpaper', type: 'color', default: '#3a7bff' },
      { name: 'orientation', type: 'select', options: ['landscape', 'portrait'], default: 'landscape' },
      { name: 'screenOn', type: 'toggle', default: true },
      { name: 'flip', type: 'range', min: 0, max: 1, step: 0.02, default: 0 },
      { name: 'shine', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
      { name: 'tilt', type: 'toggle', default: true },
      { name: 'autoRotate', type: 'toggle', default: false },
    ],
    // `set` lets the scene update the controls (clicking the tablet flips it).
    preview: (p, set) => <TabletModel {...p} onChange={set} height="100%" />,
    fill: true,
    files: ['TabletModel.jsx', 'tablet/TabletScene.jsx', 'tablet/Tablet.jsx'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'newtons-cradle',
    name: "Newton's Cradle",
    category: '3D & Materials',
    isNew: true,
    description: 'Chrome balls on strings with real pendulum physics: lift an end ball, let go, and the swing passes through the row.',
    controls: [
      {
        name: 'palette',
        type: 'presets',
        options: [
          { name: 'Chrome', values: { ballColor: '#d9dce0', frameColor: '#1b1c1f', stringColor: '#9aa0a8' } },
          { name: 'Brass', values: { ballColor: '#d8b25a', frameColor: '#2a1d12', stringColor: '#b89a5a' } },
          { name: 'Copper', values: { ballColor: '#c9764a', frameColor: '#1d1f24', stringColor: '#a8683f' } },
          { name: 'Gunmetal', values: { ballColor: '#6d7076', frameColor: '#d6d8dc', stringColor: '#7d838c' } },
          { name: 'Rose', values: { ballColor: '#e8b4b8', frameColor: '#3a2a2c', stringColor: '#c89aa0' } },
          { name: 'Ink', values: { ballColor: '#2a2d33', frameColor: '#e9e6df', stringColor: '#55595f' } },
        ],
      },
      { name: 'balls', type: 'range', min: 3, max: 8, step: 1, default: 5 },
      { name: 'stringLength', type: 'range', min: 2.4, max: 4.6, step: 0.1, default: 3.4 },
      { name: 'damping', type: 'range', min: 0, max: 1, step: 0.05, default: 0.15 },
      { name: 'ballColor', type: 'color', default: '#d9dce0' },
      { name: 'frameColor', type: 'color', default: '#1b1c1f' },
      { name: 'stringColor', type: 'color', default: '#9aa0a8' },
      { name: 'frameFinish', type: 'select', options: ['polished', 'satin', 'matte'], default: 'polished' },
      { name: 'shine', type: 'range', min: 0, max: 1, step: 0.05, default: 0.8 },
      { name: 'autoRotate', type: 'toggle', default: false },
    ],
    preview: (p) => <CradleModel {...p} height="100%" />,
    fill: true,
    files: ['CradleModel.jsx', 'cradle/CradleScene.jsx', 'cradle/Cradle.jsx'],
    deps: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  {
    slug: 'drafting-grid',
    name: 'Drafting Grid',
    category: 'Backgrounds',
    description: 'A drafting-paper grid background with a cursor crosshair.',
    controls: [
      { name: 'cell', type: 'range', min: 8, max: 64, step: 2, default: 24, unit: 'px' },
      { name: 'major', type: 'range', min: 2, max: 10, step: 1, default: 5 },
      { name: 'crosshair', type: 'toggle', default: true },
      { name: 'accent', type: 'color', default: '#ff4d1a' },
    ],
    fill: true,
    preview: (p) => (
      <DraftingGrid {...p} style={{ position: 'absolute', inset: 0 }}>
        <div className="demo-center">
          <span className="demo-bg-title">Move your cursor</span>
        </div>
      </DraftingGrid>
    ),
    files: ['DraftingGrid.jsx'],
    deps: [],
  },
  {
    slug: 'light-sweep',
    name: 'Light Sweep',
    category: 'Backgrounds',
    description: 'A band of light that sweeps across a surface on a loop.',
    controls: [
      { name: 'speed', type: 'range', min: 1, max: 8, step: 0.5, default: 3.5, unit: 's' },
      { name: 'pause', type: 'range', min: 0, max: 4, step: 0.2, default: 1.2, unit: 's' },
      { name: 'angle', type: 'range', min: 0, max: 180, step: 5, default: 115, unit: 'Â°' },
      { name: 'intensity', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.55 },
      { name: 'width', type: 'range', min: 5, max: 50, step: 1, default: 22, unit: '%' },
      { name: 'base', type: 'color', default: '#15171a' },
    ],
    fill: true,
    preview: (p) => (
      <LightSweep {...p} style={{ position: 'absolute', inset: 0 }}>
        <div className="demo-center">
          <span className="demo-bg-title light">Brushed steel</span>
        </div>
      </LightSweep>
    ),
    files: ['LightSweep.jsx'],
    deps: [],
  },
  {
    slug: 'cyclorama',
    name: 'Cyclorama',
    category: 'Backgrounds',
    isNew: true,
    description: 'A seamless curved studio backdrop in a single tinted colour.',
    controls: [
      { name: 'tint', type: 'color', default: '#d9d4ca' },
      { name: 'horizon', type: 'range', min: 30, max: 85, step: 1, default: 62, unit: '%' },
      { name: 'curve', type: 'range', min: 2, max: 40, step: 1, default: 18, unit: '%' },
      { name: 'light', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
      { name: 'vignette', type: 'range', min: 0, max: 0.8, step: 0.05, default: 0.35 },
      { name: 'shadow', type: 'toggle', default: true },
    ],
    fill: true,
    preview: (p) => (
      <Cyclorama {...p} style={{ position: 'absolute', inset: 0 }}>
        <div className="demo-center">
          <span className="demo-bg-title">Studio sweep</span>
        </div>
      </Cyclorama>
    ),
    files: ['Cyclorama.jsx'],
    deps: [],
  },
  {
    slug: 'gradient-sweep',
    name: 'Gradient Sweep',
    category: 'Backgrounds',
    isNew: true,
    description: "A studio sweep that shifts hue to match the product's main colour.",
    controls: [
      { name: 'color', type: 'color', default: '#ff4d1a' },
      { name: 'base', type: 'color', default: '#121316' },
      { name: 'shift', type: 'range', min: 0, max: 180, step: 5, default: 40, unit: '°' },
      { name: 'strength', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.55 },
      { name: 'drift', type: 'range', min: 0, max: 120, step: 5, default: 0, unit: '°' },
      { name: 'speed', type: 'range', min: 2, max: 20, step: 1, default: 8, unit: 's' },
      { name: 'transition', type: 'range', min: 0, max: 3, step: 0.1, default: 0.9, unit: 's' },
    ],
    fill: true,
    preview: (p) => (
      <GradientSweep {...p} style={{ position: 'absolute', inset: 0 }}>
        <div className="demo-center">
          <span className="demo-bg-title light">Colour matched</span>
        </div>
      </GradientSweep>
    ),
    files: ['GradientSweep.jsx'],
    deps: [],
  },
  {
    slug: 'soft-horizon',
    name: 'Soft Horizon',
    category: 'Backgrounds',
    isNew: true,
    description: 'A wall and floor that meet at a soft, blurred band of light.',
    controls: [
      { name: 'wall', type: 'color', default: '#1b1d22' },
      { name: 'floor', type: 'color', default: '#2a2c31' },
      { name: 'band', type: 'color', default: '#f3efe6' },
      { name: 'horizon', type: 'range', min: 30, max: 85, step: 1, default: 60, unit: '%' },
      { name: 'softness', type: 'range', min: 4, max: 120, step: 2, default: 40, unit: 'px' },
      { name: 'glow', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
      { name: 'spread', type: 'range', min: 20, max: 140, step: 5, default: 70, unit: '%' },
    ],
    fill: true,
    preview: (p) => (
      <SoftHorizon {...p} style={{ position: 'absolute', inset: 0 }}>
        <div className="demo-center">
          <span className="demo-bg-title light">Horizon</span>
        </div>
      </SoftHorizon>
    ),
    files: ['SoftHorizon.jsx'],
    deps: [],
  },
]

// Components that take children, so usage shows them as wrappers.
export const WRAPPERS = ['TiltCard', 'DraftingGrid', 'LightSweep', 'Cyclorama', 'GradientSweep', 'SoftHorizon', 'SpringButton', 'MagneticButton']

export const sourceFor = (c) => c.files.map((f) => ({ file: f, code: src(f) }))

// Preset rows only set other controls, so they have no value of their own.
export const valueControls = (c) => c.controls.filter((k) => k.type !== 'presets')

export const defaultsFor = (c) => Object.fromEntries(valueControls(c).map((k) => [k.name, k.default]))

// JSX usage snippet for the current settings (only props that differ from
// the defaults are written out, like a real call site).
export function usageFor(c, values) {
  const tag = c.files[0].replace('.jsx', '')
  const props = valueControls(c)
    .filter((k) => values[k.name] !== k.default)
    .map((k) => {
      const v = values[k.name]
      if (typeof v === 'boolean') return v ? k.name : `${k.name}={false}`
      if (typeof v === 'number') return `${k.name}={${v}}`
      return `${k.name}="${v}"`
    })
  const wraps = WRAPPERS.includes(tag)
  const open = props.length ? `<${tag}\n  ${props.join('\n  ')}\n` : `<${tag}`
  const body = wraps ? `${open}${props.length ? '' : ''}>\n  {/* your content */}\n</${tag}>` : `${open}${props.length ? '/>' : ' />'}`
  return `import ${tag} from './${tag}'\n\n${body}`
}
