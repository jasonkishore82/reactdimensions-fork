import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import {
  PAGE_W,
  PAGE_H,
  FONTS_TO_LOAD,
  coverTexture,
  endpaperTexture,
  titlePageTexture,
  contentPageTexture,
  edgeTexture,
  splitPages,
} from './textures.js'
import { DEFAULT_CONTENT } from './content.js'

// Sizes are in the book's own units: a page is 3 wide and 4.2 tall.
const LEAF_T = 0.014 // thickness of one sheet
const COVER_T = 0.07 // thickness of a cover board
export const COVER_W = PAGE_W + 0.12
const COVER_H = PAGE_H + 0.22
const SPINE_W = 0.05
const SEG = 32 // pieces along the page width, so it can bend
const TURN_TIME = 0.9 // seconds for one page to turn
const CURL = 1.15 // how much a page bends as it turns (radians, tip to spine)

const smooth = (s) => s * s * (3 - 2 * s)

// ---------- a page that can bend ----------
// A strip of quads from the spine (u = 0) to the outer edge (u = PAGE_W).
// Front faces point up while the page lies on the right.
function leafGeometry() {
  const g = new THREE.BufferGeometry()
  const pos = new Float32Array((SEG + 1) * 2 * 3)
  const uv = new Float32Array((SEG + 1) * 2 * 2)
  const idx = []
  for (let i = 0; i <= SEG; i++) {
    for (let j = 0; j < 2; j++) {
      const n = i * 2 + j
      pos[n * 3 + 0] = (i / SEG) * PAGE_W
      pos[n * 3 + 2] = j === 0 ? -PAGE_H / 2 : PAGE_H / 2
      uv[n * 2 + 0] = i / SEG
      uv[n * 2 + 1] = j === 0 ? 1 : 0
    }
    if (i < SEG) {
      const a = i * 2
      const b = a + 1
      const c = a + 2
      const d = a + 3
      idx.push(a, b, c, c, b, d)
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

// Lays the page out as an arc: it leaves the spine at angle `theta` and its
// direction changes by `c` per unit of width, so the free edge lags behind.
function bend(g, theta, c, y0) {
  const p = g.attributes.position.array
  for (let i = 0; i <= SEG; i++) {
    const u = (i / SEG) * PAGE_W
    let x
    let y
    if (Math.abs(c) < 1e-5) {
      x = u * Math.cos(theta)
      y = u * Math.sin(theta)
    } else {
      x = (Math.sin(theta + c * u) - Math.sin(theta)) / c
      y = (Math.cos(theta) - Math.cos(theta + c * u)) / c
    }
    for (let j = 0; j < 2; j++) {
      const n = (i * 2 + j) * 3
      p[n] = x
      p[n + 1] = y0 + y
    }
  }
  g.attributes.position.needsUpdate = true
  g.computeVertexNormals()
  g.computeBoundingSphere()
}

// Seen from above after it has turned, the back of a page runs from the spine
// towards -x, so its picture is mirrored to read the right way round.
function mirrored(t) {
  t.wrapS = THREE.RepeatWrapping
  t.repeat.x = -1
  t.offset.x = 1
  return t
}
function rotated(t) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(-1, -1)
  t.offset.set(1, 1)
  return t
}

function Leaf({ k, n, state, opts, chunks, fontsVersion, anisotropy }) {
  const geo = useMemo(leafGeometry, [])
  useEffect(() => () => geo.dispose(), [geo])

  // page numbers: this sheet carries pages 2k-1 (front) and 2k (back)
  const front = 2 * k - 1
  const back = 2 * k
  const maps = useMemo(() => {
    const draw = (p, side) => (p === 1 ? titlePageTexture(opts, anisotropy) : contentPageTexture(opts, chunks[p - 2] ?? '', p, side, anisotropy))
    return { front: draw(front, 'right'), back: mirrored(draw(back, 'left')) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, chunks, front, back, fontsVersion, anisotropy])
  useEffect(
    () => () => {
      maps.front.dispose()
      maps.back.dispose()
    },
    [maps],
  )

  const last = useRef(null)
  useFrame(() => {
    const s = state.current.s[k]
    const dir = state.current.dir[k]
    const key = `${s}|${dir}|${n}`
    if (key === last.current) return
    last.current = key
    const e = smooth(s)
    const theta = Math.PI * e
    // the free edge lags behind the turn; never let it dip into the stacks
    let c = (Math.sin(Math.PI * s) * CURL) / PAGE_W
    c = dir > 0 ? -Math.min(c, theta / PAGE_W) : Math.min(c, (Math.PI - theta) / PAGE_W)
    const y = THREE.MathUtils.lerp((n - k + 1) * LEAF_T, k * LEAF_T, e)
    bend(geo, theta, c, y)
  })

  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial map={maps.front} roughness={0.86} side={THREE.FrontSide} />
      </mesh>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial map={maps.back} roughness={0.86} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

// ---------- the block of pages under the top sheet ----------
function PageBlock({ side, height, paperColor }) {
  const ref = useRef()
  const tex = useMemo(() => edgeTexture(paperColor), [paperColor])
  useEffect(() => () => tex.dispose(), [tex])
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(PAGE_W, 1, PAGE_H)
    g.translate(side === 'right' ? PAGE_W / 2 : -PAGE_W / 2, 0.5, 0)
    return g
  }, [side])
  useEffect(() => () => geo.dispose(), [geo])
  useFrame(() => {
    const h = height.current[side]
    ref.current.visible = h > 0.0005
    ref.current.scale.y = Math.max(h, 0.0001)
    tex.repeat.set(1, Math.max(h / LEAF_T / 64, 0.01))
  })
  // Box faces in order: +x, -x, +y, -y, +z, -z. The three outer sides show
  // the page edges; the spine side and top are plain paper.
  return (
    <mesh ref={ref} geometry={geo} castShadow receiveShadow>
      {[0, 1, 2, 3, 4, 5].map((i) =>
        (side === 'right' ? i === 0 : i === 1) || i === 4 || i === 5 ? (
          <meshStandardMaterial key={i} attach={`material-${i}`} map={tex} roughness={0.95} />
        ) : (
          <meshStandardMaterial key={i} attach={`material-${i}`} color={paperColor} roughness={0.9} />
        ),
      )}
    </mesh>
  )
}

// ---------- page-turn sound, made on the fly (no audio file) ----------
let audioCtx
export function playFlipSound() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)()
    const dur = 0.42
    const len = Math.floor(audioCtx.sampleRate * dur)
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const t = i / len
      data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * t) ** 2 * (1 - t * 0.5)
    }
    const src = audioCtx.createBufferSource()
    src.buffer = buf
    const filter = audioCtx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.8
    filter.frequency.setValueAtTime(900, audioCtx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(3800, audioCtx.currentTime + dur)
    const gain = audioCtx.createGain()
    gain.gain.value = 0.16
    src.connect(filter).connect(gain).connect(audioCtx.destination)
    src.start()
  } catch {
    /* sound is optional */
  }
}

// ---------- the book ----------
// turned: how many leaves lie on the left (0 = closed, the front cover counts
// as one). onTurn(next) asks the owner to change it.
export default function Book({
  title = 'React Dimensions',
  subtitle = 'South Indian Kitchen',
  currency = '$',
  pages = 12,
  content = DEFAULT_CONTENT,
  coverColor = '#4a1014',
  paperColor = '#f6edd9',
  inkColor = '#2b1d14',
  accentColor = '#8a2b1c',
  foilColor = '#c9973b',
  logo = 'emblem',
  logoImage = '',
  turned = 0,
  onTurn,
}) {
  const n = Math.max(1, Math.round(pages / 2)) // sheets of paper
  const gl = useThree((s) => s.gl)
  // sharper text when the pages are seen at a slant
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
  const [hover, setHover] = useState(false)
  useCursor(hover, 'pointer')

  // Canvas text needs the web fonts loaded first; redraw once they are.
  const [fontsVersion, setFontsVersion] = useState(0)
  useEffect(() => {
    if (!document.fonts?.load) return
    let live = true
    Promise.all(FONTS_TO_LOAD.map((f) => document.fonts.load(f).catch(() => null))).then(() => live && setFontsVersion((v) => v + 1))
    return () => {
      live = false
    }
  }, [])

  // An uploaded or linked logo image.
  const [img, setImg] = useState(null)
  useEffect(() => {
    if (!logoImage) return setImg(null)
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => setImg(im)
    im.onerror = () => setImg(null)
    im.src = logoImage
  }, [logoImage])

  const opts = useMemo(
    () => ({
      title: title || ' ',
      subtitle,
      currency,
      coverColor,
      paperColor,
      inkColor,
      accentColor,
      foilColor,
      logo: logo === 'none' ? 'none' : img ? 'image' : logo,
      logoImg: img,
    }),
    [title, subtitle, currency, coverColor, paperColor, inkColor, accentColor, foilColor, logo, img],
  )
  const chunks = useMemo(() => splitPages(content), [content])

  // cover faces
  const covers = useMemo(
    () => ({
      front: coverTexture(opts, 'front', anisotropy),
      insideFront: rotated(endpaperTexture(opts, 'left', anisotropy)),
      insideBack: endpaperTexture(opts, 'right', anisotropy),
      back: rotated(coverTexture(opts, 'back', anisotropy)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts, fontsVersion, anisotropy],
  )
  useEffect(() => () => Object.values(covers).forEach((t) => t.dispose()), [covers])

  const coverGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(COVER_W, COVER_T, COVER_H)
    g.translate(COVER_W / 2, COVER_T / 2, 0)
    return g
  }, [])
  const backGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(COVER_W, COVER_T, COVER_H)
    g.translate(COVER_W / 2, -COVER_T / 2, 0)
    return g
  }, [])
  const spineGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(SPINE_W, 1, COVER_H)
    g.translate(-SPINE_W / 2, 0.5, 0)
    return g
  }, [])
  useEffect(
    () => () => {
      coverGeo.dispose()
      backGeo.dispose()
      spineGeo.dispose()
    },
    [coverGeo, backGeo, spineGeo],
  )

  // Turn state for every leaf: 0 lies on the right, 1 on the left. Index 0 is
  // the front cover, 1..n the paper sheets.
  const target = Math.min(Math.max(turned, 0), n + 1)
  const state = useRef({ s: [], dir: [] })
  if (state.current.s.length !== n + 1) {
    state.current.s = Array.from({ length: n + 1 }, (_, k) => (k < target ? 1 : 0))
    state.current.dir = Array.from({ length: n + 1 }, () => 1)
  }
  const height = useRef({ left: 0, right: 0 })
  const groupRef = useRef()
  const coverRef = useRef()
  const spineRef = useRef()

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const st = state.current
    for (let k = 0; k <= n; k++) {
      const want = k < target ? 1 : 0
      if (st.s[k] === want) continue
      st.dir[k] = want > st.s[k] ? 1 : -1
      st.s[k] = THREE.MathUtils.clamp(st.s[k] + (st.dir[k] * dt) / TURN_TIME, 0, 1)
    }
    // the cover swings on top of the right stack, and lies under the left one
    const e0 = smooth(st.s[0])
    coverRef.current.rotation.z = Math.PI * e0
    coverRef.current.position.y = THREE.MathUtils.lerp(n * LEAF_T + LEAF_T * 0.5, 0, e0)
    spineRef.current.scale.y = THREE.MathUtils.lerp(n * LEAF_T + LEAF_T * 0.5 + 2 * COVER_T, COVER_T, e0)
    spineRef.current.position.y = -COVER_T
    // the closed book sits centred; open, the spine is the centre
    groupRef.current.position.x = -(COVER_W / 2) * (1 - e0)

    // blocks of pages under the top sheets
    let first = n + 1
    for (let k = 1; k <= n; k++) if (st.s[k] === 0) {
      first = k
      break
    }
    let lastTurned = 0
    for (let k = n; k >= 1; k--) if (st.s[k] === 1) {
      lastTurned = k
      break
    }
    height.current.right = first <= n ? (n - first + 1) * LEAF_T - LEAF_T * 0.5 : 0
    height.current.left = lastTurned > 0 ? lastTurned * LEAF_T - LEAF_T * 0.5 : 0
  })

  // Only the sheets near the open spread are drawn; the blocks stand in for
  // the rest, which keeps texture memory small for long books.
  const visible = []
  for (let k = Math.max(1, target - 2); k <= Math.min(n, target + 1); k++) visible.push(k)

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        if (e.delta > 4) return // a drag to orbit, not a click
        e.stopPropagation()
        const local = groupRef.current.worldToLocal(e.point.clone())
        const next = target === 0 ? 1 : local.x >= 0 ? target + 1 : target - 1
        onTurn?.(Math.min(Math.max(next, 0), n + 1))
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      {/* back cover, fixed: its inside faces up under the pages */}
      <mesh geometry={backGeo} castShadow receiveShadow>
        <meshStandardMaterial attach="material-0" color={coverColor} roughness={0.6} />
        <meshStandardMaterial attach="material-1" color={coverColor} roughness={0.6} />
        <meshStandardMaterial attach="material-2" map={covers.insideBack} roughness={0.8} />
        <meshStandardMaterial attach="material-3" map={covers.back} roughness={0.55} />
        <meshStandardMaterial attach="material-4" color={coverColor} roughness={0.6} />
        <meshStandardMaterial attach="material-5" color={coverColor} roughness={0.6} />
      </mesh>

      {/* front cover, hinged at the spine */}
      <group ref={coverRef}>
        <mesh geometry={coverGeo} castShadow receiveShadow>
          <meshStandardMaterial attach="material-0" color={coverColor} roughness={0.6} />
          <meshStandardMaterial attach="material-1" color={coverColor} roughness={0.6} />
          <meshStandardMaterial attach="material-2" map={covers.front} roughness={0.55} />
          <meshStandardMaterial attach="material-3" map={covers.insideFront} roughness={0.8} />
          <meshStandardMaterial attach="material-4" color={coverColor} roughness={0.6} />
          <meshStandardMaterial attach="material-5" color={coverColor} roughness={0.6} />
        </mesh>
      </group>

      <mesh ref={spineRef} geometry={spineGeo} castShadow>
        <meshStandardMaterial color={coverColor} roughness={0.6} />
      </mesh>

      <PageBlock side="right" height={height} paperColor={paperColor} />
      <PageBlock side="left" height={height} paperColor={paperColor} />

      {visible.map((k) => (
        <Leaf key={k} k={k} n={n} state={state} opts={opts} chunks={chunks} fontsVersion={fontsVersion} anisotropy={anisotropy} />
      ))}
    </group>
  )
}
