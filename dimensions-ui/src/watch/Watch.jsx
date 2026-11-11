import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import Analog from './Analog.jsx'
import Smart from './Smart.jsx'
import Strap from './Strap.jsx'

export const STRAPS = ['leather', 'sport', 'nylon', 'metal']
const STRAP_WIDTH = { analog: 1, smart: 1.3 } // the strap stretches to fit the head
const smooth = (t) => t * t * (3 - 2 * t)

// A prop that can also be changed from inside the scene (clicking the watch);
// `onChange` lets the owner stay in sync.
function useTwoWay(prop, key, onChange) {
  const [v, setV] = useState(prop)
  useEffect(() => setV(prop), [prop])
  return [
    v,
    (next) => {
      setV(next)
      onChange?.({ [key]: next })
    },
  ]
}

// type: 'analog' | 'smart'.  strap: 'leather' | 'sport' | 'nylon' | 'metal'.
// Change either one and the old part pops off and the new one pops on.
export default function Watch({
  type: typeProp = 'analog',
  strap: strapProp = 'leather',
  caseColor = '#cfd2d8',
  strapColor = '#4a2c17',
  strapAccent = '#c9a15a',
  dialColor = '#f1ede2',
  handsColor = '#1a1a1a',
  accent = '#e8402a',
  dialStyle = 'index',
  bezelColor = '#14181d',
  smartFace = 'rings',
  shine = 0.5,
  time = 'live',
  onChange,
}) {
  const [type, setType] = useTwoWay(typeProp, 'type', onChange)
  const [strap, setStrap] = useTwoWay(strapProp, 'strap', onChange)
  // what is currently on the wrist; it follows the wanted one after the old part is off
  const [typeShown, setTypeShown] = useState(type)
  const [strapShown, setStrapShown] = useState(strap)

  const root = useRef()
  const head = useRef()
  const band = useRef()
  const s = useRef({ head: 1, band: 1, width: STRAP_WIDTH[typeProp] ?? 1 })
  const want = useRef({})
  want.current = { type, strap }

  const [hoverHead, setHoverHead] = useState(false)
  const [hoverBand, setHoverBand] = useState(false)
  useCursor(hoverHead || hoverBand, 'pointer')

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const k = 1 - Math.exp(-dt * 8)
    const st = s.current
    const w = want.current

    // Head: pop off, swap, pop back on
    if (w.type !== typeShown) {
      st.head += (0 - st.head) * k * 1.4
      if (st.head < 0.06) setTypeShown(w.type)
    } else st.head += (1 - st.head) * k
    // Strap
    if (w.strap !== strapShown) {
      st.band += (0 - st.band) * k * 1.4
      if (st.band < 0.06) setStrapShown(w.strap)
    } else st.band += (1 - st.band) * k
    st.width += ((STRAP_WIDTH[typeShown] ?? 1) - st.width) * k

    const h = smooth(Math.min(Math.max(st.head, 0), 1))
    head.current.scale.setScalar(Math.max(h, 0.001))
    head.current.position.z = (1 - h) * 1.8
    head.current.rotation.y = (1 - h) * 1.1
    const b = smooth(Math.min(Math.max(st.band, 0), 1))
    band.current.scale.set(Math.max(b, 0.001) * st.width, Math.max(b, 0.001), Math.max(b, 0.001))

    root.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.05
  })

  return (
    <group ref={root} position={[0, 0, 1.9]}>
      <group
        ref={head}
        onClick={(e) => {
          e.stopPropagation()
          setType(type === 'analog' ? 'smart' : 'analog')
        }}
        onPointerOver={() => setHoverHead(true)}
        onPointerOut={() => setHoverHead(false)}
      >
        {typeShown === 'smart' ? (
          <Smart caseColor={caseColor} dialColor={dialColor} accent={accent} face={smartFace} shine={shine} time={time} />
        ) : (
          <Analog
            caseColor={caseColor}
            dialColor={dialColor}
            handsColor={handsColor}
            accent={accent}
            dialStyle={dialStyle}
            bezelColor={bezelColor}
            shine={shine}
            time={time}
          />
        )}
      </group>
      <group
        ref={band}
        onClick={(e) => {
          e.stopPropagation()
          setStrap(STRAPS[(STRAPS.indexOf(strap) + 1) % STRAPS.length])
        }}
        onPointerOver={() => setHoverBand(true)}
        onPointerOut={() => setHoverBand(false)}
      >
        <Strap style={strapShown} color={strapColor} accent={strapAccent} metal={caseColor} shine={shine} />
      </group>
    </group>
  )
}
