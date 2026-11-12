import { Suspense, lazy } from 'react'

// A piston-filling fountain pen on ruled paper, with rigid-body physics. Pick
// it up anywhere and it hangs and swings from that point; drop or throw it and
// it bounces and rolls until the clip stops it. Click the cap to unscrew it,
// post it on the end, or screw it back on. Turn the end knob to move the
// piston (watch the ink window); with the nib out, ink drips onto the paper,
// and dragging the pen by its back end lets the nib write.
// (Thin wrapper: the scene lives in pen/PenScene.jsx.)
const Scene = lazy(() => import('../pen/PenScene.jsx'))

export default function PenModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
