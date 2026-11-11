import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { strapTexture } from './textures.js'

// Colour pickers fire on every drag step; texture drawing is heavy, so wait
// until the value settles.
function useSettled(value, ms = 160) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

// The strap is a loop in the y/z plane: it leaves the top lug, goes round
// behind the case like a wrist, and returns to the bottom lug.
const TOP = [
  [1.2, -0.02],
  [1.7, -0.2],
  [2.15, -0.8],
  [2.3, -1.8],
  [1.85, -2.9],
  [0.95, -3.6],
  [0, -3.85],
]
export const STRAP_BASE_WIDTH = 1
const THICK = 0.09

const X = new THREE.Vector3(1, 0, 0)

function loopCurve() {
  const pts = [...TOP, ...TOP.slice(0, -1).reverse().map(([y, z]) => [-y, z])].map(([y, z]) => new THREE.Vector3(0, y, z))
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal')
}

// Frame at a point on the loop: across the strap (x), outward (o), along (t).
function frameAt(curve, u, out) {
  const p = curve.getPointAt(u)
  const t = curve.getTangentAt(u)
  const o = new THREE.Vector3().crossVectors(X, t).normalize()
  out.p = p
  out.t = t
  out.o = o
  return out
}

// A flat band swept along the loop: a rounded-rectangle section.
function bandGeometry(curve, width, thick) {
  const rc = Math.min(0.03, thick * 0.4)
  const hw = width / 2
  const ht = thick / 2
  const prof = []
  const corner = (cx, cy, a0) => {
    for (let k = 0; k <= 3; k++) {
      const a = a0 + (k / 3) * (Math.PI / 2)
      prof.push([cx + Math.cos(a) * rc, cy + Math.sin(a) * rc])
    }
  }
  corner(hw - rc, ht - rc, 0)
  corner(-hw + rc, ht - rc, Math.PI / 2)
  corner(-hw + rc, -ht + rc, Math.PI)
  corner(hw - rc, -ht + rc, Math.PI * 1.5)
  prof.push(prof[0])
  const N = 260
  const m = prof.length
  const pos = []
  const uv = []
  const f = {}
  for (let i = 0; i <= N; i++) {
    const s = i / N
    frameAt(curve, s, f)
    for (let j = 0; j < m; j++) {
      const [px, py] = prof[j]
      pos.push(f.p.x + px, f.p.y + f.o.y * py, f.p.z + f.o.z * py)
      uv.push(Math.min(Math.max((px + hw) / width, 0), 1), s)
    }
  }
  const idx = []
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j
      const b = a + 1
      const c = a + m
      const d = c + 1
      idx.push(a, b, c, b, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Matrix for something sitting on the strap at position u.
function placed(curve, u, lift = 0) {
  const f = frameAt(curve, u, {})
  const m = new THREE.Matrix4().makeBasis(X, f.o, f.t.clone().negate())
  m.setPosition(f.p.clone().addScaledVector(f.o, lift))
  return m
}

// Metal bracelet: rows of links following the loop.
function Links({ curve, width, mat, count }) {
  const centre = useRef()
  const sides = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const mm = new THREE.Matrix4()
    let ci = 0
    let si = 0
    for (let i = 0; i < count; i++) {
      const u = 0.012 + (i / (count - 1)) * 0.976
      const base = placed(curve, u)
      centre.current.setMatrixAt(ci++, base)
      for (const sx of [-1, 1]) {
        mm.makeTranslation(sx * width * 0.385, 0, 0)
        m.multiplyMatrices(base, mm)
        sides.current.setMatrixAt(si++, m)
      }
    }
    centre.current.instanceMatrix.needsUpdate = true
    sides.current.instanceMatrix.needsUpdate = true
  }, [curve, width, count])
  const len = (curve.getLength() * 0.976) / count - 0.025
  return (
    <>
      <instancedMesh ref={centre} args={[null, null, count]} castShadow>
        <boxGeometry args={[width * 0.5, THICK * 1.15, len]} />
        {mat}
      </instancedMesh>
      <instancedMesh ref={sides} args={[null, null, count * 2]} castShadow>
        <boxGeometry args={[width * 0.21, THICK, len * 0.92]} />
        {mat}
      </instancedMesh>
    </>
  )
}

// style: 'leather' | 'sport' | 'nylon' | 'metal'. `metal` is the colour of the
// buckle and of the links.
export default function Strap({ style = 'leather', color = '#4a2c17', accent = '#c9a15a', metal = '#cdd0d6', shine = 0.5 }) {
  const curve = useMemo(loopCurve, [])
  const band = useMemo(() => bandGeometry(curve, STRAP_BASE_WIDTH, THICK), [curve])
  useEffect(() => () => band.dispose(), [band])

  const key = useSettled(`${style}|${color}|${accent}`)
  const skin = useMemo(() => {
    if (style === 'metal') return null
    const [s, c, a] = key.split('|')
    return strapTexture({ style: s, color: c, accent: a })
  }, [key, style])
  useEffect(() => () => skin?.dispose(), [skin])

  const metalMat = <meshPhysicalMaterial color={metal} metalness={1} roughness={0.34 - shine * 0.2} envMapIntensity={1.3} />
  const linkMat = <meshPhysicalMaterial color={color} metalness={1} roughness={0.38 - shine * 0.22} envMapIntensity={1.3} />

  // buckle on the top strap, near the case
  const buckle = useMemo(() => placed(curve, 0.165), [curve])
  const keeper = useMemo(() => placed(curve, 0.745), [curve])
  const clasp = useMemo(() => placed(curve, 0.5), [curve])

  const linkCount = 44

  return (
    <group>
      {style === 'metal' ? (
        <>
          <Links curve={curve} width={STRAP_BASE_WIDTH} mat={linkMat} count={linkCount} />
          {/* folding clasp at the back */}
          <group matrix={clasp} matrixAutoUpdate={false}>
            <RoundedBox args={[STRAP_BASE_WIDTH * 1.04, THICK * 2.1, 0.5]} radius={0.04} smoothness={3} castShadow>
              {linkMat}
            </RoundedBox>
          </group>
        </>
      ) : (
        <>
          <mesh geometry={band} castShadow>
            <meshPhysicalMaterial
              map={skin?.map}
              bumpMap={skin?.bump}
              bumpScale={style === 'leather' ? 1.6 : style === 'nylon' ? 1.2 : 0.9}
              roughness={style === 'nylon' ? 0.95 : style === 'sport' ? 0.5 : 0.55}
              clearcoat={style === 'sport' ? 0.35 : style === 'leather' ? 0.12 : 0}
              clearcoatRoughness={0.45}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* buckle: a frame round the strap with a tongue */}
          <group matrix={buckle} matrixAutoUpdate={false}>
            <mesh position={[0, 0.02, 0]} castShadow>
              <boxGeometry args={[STRAP_BASE_WIDTH * 1.16, 0.06, 0.07]} />
              {metalMat}
            </mesh>
            <mesh position={[0, 0.02, 0.4]} castShadow>
              <boxGeometry args={[STRAP_BASE_WIDTH * 1.16, 0.06, 0.07]} />
              {metalMat}
            </mesh>
            {[-1, 1].map((sx) => (
              <mesh key={sx} position={[sx * STRAP_BASE_WIDTH * 0.58, 0.02, 0.2]} castShadow>
                <boxGeometry args={[0.07, 0.06, 0.47]} />
                {metalMat}
              </mesh>
            ))}
            <mesh position={[0, 0.07, 0.2]} castShadow>
              <boxGeometry args={[0.045, 0.045, 0.34]} />
              {metalMat}
            </mesh>
          </group>
          {/* keeper loop on the bottom strap */}
          <group matrix={keeper} matrixAutoUpdate={false}>
            <RoundedBox args={[STRAP_BASE_WIDTH * 1.06, THICK + 0.07, 0.14]} radius={0.03} smoothness={3}>
              <meshPhysicalMaterial color={color} roughness={0.6} />
            </RoundedBox>
          </group>
        </>
      )}
    </group>
  )
}
