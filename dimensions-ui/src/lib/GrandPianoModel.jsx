import { Suspense, lazy } from 'react'

// A grand piano with a working action: keys throw hammers that escape and
// strike the strings, dampers lift and fall, strings ring, the three pedals
// work and the lid swings onto its prop. Play it with the mouse, the
// computer keyboard or a real MIDI keyboard.
// (Thin wrapper: the scene lives in piano/PianoScene.jsx.)
const Scene = lazy(() => import('../piano/PianoScene.jsx'))

export default function GrandPianoModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
