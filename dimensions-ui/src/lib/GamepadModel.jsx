import { Suspense, lazy } from 'react'

// A twin-stick game controller with working mechanisms: sticks that tilt and
// spring back to centre, buttons with travel, a rocking d-pad, a clickable
// touchpad, analog triggers with adjustable resistance, rumble motors and a
// light bar. Plug in a real gamepad and it mirrors every input live.
// (Thin wrapper: the scene lives in gamepad/GamepadScene.jsx.)
const Scene = lazy(() => import('../gamepad/GamepadScene.jsx'))

export default function GamepadModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
