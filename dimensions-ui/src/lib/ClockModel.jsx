import { Suspense, lazy } from 'react'

// A twin-bell alarm clock showing the live time. The second hand ticks; drag
// the hour or minute hand to set the time and the gold hand to set the alarm.
// When the time reaches the alarm, the hammer beats between the bells and the
// clock judders on its feet. Click the bells to try it, or to stop it.
// Drag the background to orbit.
// (Thin wrapper: the scene lives in clock/ClockScene.jsx.)
const Scene = lazy(() => import('../clock/ClockScene.jsx'))

export default function ClockModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
