import { Suspense, lazy } from 'react'

// A playable 3D turntable: a wooden deck with a grooved record, tonearm,
// speed knob and power button. Press power (or set `playing`), drag the
// tonearm onto the record, or grab the record and scratch it. Turn `sound` on
// to hear a lo-fi loop whose pitch follows the platter.
// (Thin wrapper: the scene lives in turntable/TurntableScene.jsx.)
const Scene = lazy(() => import('../turntable/TurntableScene.jsx'))

export default function TurntableModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
