import { Suspense, lazy } from 'react'

// A dreadnought acoustic guitar on a floor stand, with the physics of the
// real thing. Each string is a sum of its vibrating modes: drag across them
// to strum and watch the pluck run as Helmholtz motion, brighter near the
// bridge, hollow at the middle. Click the fingerboard to press frets, or pick
// a chord. The open-gear tuners are 18:1 worms: turn a key and the gear and
// post follow, the string's tension changes and so does its pitch, with a
// tuner readout. Knock the body and it rocks in its stand.
// (Thin wrapper: the scene lives in guitar/GuitarScene.jsx.)
const Scene = lazy(() => import('../guitar/GuitarScene.jsx'))

export default function GuitarModel({ height = 560, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
