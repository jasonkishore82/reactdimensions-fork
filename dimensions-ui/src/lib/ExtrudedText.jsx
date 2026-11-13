import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json'

// A solid 3D headline: the letters are extruded with a rounded bevel on every
// edge, so the studio lights roll along the bevels as it turns. Drag to look
// around it; it rocks gently on its own. Pick chrome, gold, glossy plastic or
// glass for the material.
const font = new FontLoader().parse(fontData)

const MATERIALS = {
  chrome: { color: '#e9ebee', metalness: 1, roughness: 0.12 },
  gold: { color: '#e7b85a', metalness: 1, roughness: 0.2 },
  plastic: { metalness: 0, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 },
  glass: { metalness: 0, roughness: 0.05, transmission: 1, thickness: 1.2, ior: 1.45, clearcoat: 1 },
}

function Headline({ text, depth, bevel, material, color }) {
  const group = useRef()
  const geo = useMemo(() => {
    const g = new TextGeometry(text || ' ', {
      font,
      size: 1,
      depth: depth,
      curveSegments: 10,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel * 0.7,
      bevelSegments: 6,
    })
    g.computeBoundingBox()
    const b = g.boundingBox
    g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2)
    g.computeVertexNormals()
    return g
  }, [text, depth, bevel])
  useEffect(() => () => geo.dispose(), [geo])

  const width = geo.boundingBox.max.x - geo.boundingBox.min.x
  const m = MATERIALS[material] ?? MATERIALS.chrome

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    group.current.rotation.y = Math.sin(t * 0.5) * 0.18
    group.current.rotation.x = Math.sin(t * 0.37) * 0.05
    group.current.position.y = 0.55 + Math.sin(t * 0.8) * 0.04
  })

  return (
    <group ref={group}>
      <mesh geometry={geo} castShadow scale={Math.min(1, 7 / Math.max(width, 0.1))}>
        <meshPhysicalMaterial {...m} color={material === 'plastic' || material === 'glass' ? color : m.color} envMapIntensity={1.2} />
      </mesh>
    </group>
  )
}

function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    const d = Math.max(7.5, 7.5 * (1.6 / aspect))
    camera.position.set(0, 1.4, d)
    camera.lookAt(0, 0.5, 0)
  }, [camera, size.width, size.height])
  return null
}

export default function ExtrudedText({
  text = 'DEPTH',
  depth = 0.45,
  bevel = 0.06,
  material = 'chrome',
  color = '#ff4d1a',
  background = '#f2f2f3',
  style,
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background, touchAction: 'none', ...style }} aria-label={text} role="img">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 35, position: [0, 1.4, 9] }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>
          <Headline text={text} depth={depth} bevel={bevel} material={material} color={color} />
          {/* a studio of soft boxes: big top light, two tall strips, a floor bounce */}
          <Environment resolution={256}>
            {/* a dark studio, so chrome and gold show strong reflections */}
            <color attach="background" args={['#16161a']} />
            <Lightformer form="rect" intensity={3} position={[0, 6, 2]} rotation-x={Math.PI / 2} scale={[10, 4, 1]} />
            <Lightformer form="rect" intensity={2.4} position={[-6, 1, 3]} rotation-y={Math.PI / 2.4} scale={[2, 8, 1]} />
            <Lightformer form="rect" intensity={2.4} position={[6, 1, 3]} rotation-y={-Math.PI / 2.4} scale={[2, 8, 1]} />
            <Lightformer form="rect" intensity={0.6} color="#ffd9b0" position={[0, -3, 4]} rotation-x={-Math.PI / 2} scale={[10, 3, 1]} />
            <Lightformer form="ring" intensity={1.5} position={[3, 3, 6]} scale={1.5} />
          </Environment>
        </Suspense>
        <directionalLight position={[2, 6, 4]} intensity={0.6} castShadow />
        <ContactShadows position={[0, -0.6, 0]} opacity={0.35} scale={14} blur={2.6} far={3} />
        <Rig />
        <OrbitControls makeDefault enablePan={false} enableZoom={false} target={[0, 0.5, 0]} minPolarAngle={0.9} maxPolarAngle={1.75} minAzimuthAngle={-1.1} maxAzimuthAngle={1.1} />
      </Canvas>
    </div>
  )
}
