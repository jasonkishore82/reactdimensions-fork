import { Suspense, lazy } from 'react'

// Mechanical keyboard. Type on your real keyboard or click the keycaps and the
// matching key travels down; held modifiers light up. Pick the layout (60%,
// TKL, full), the switch type (with optional switch sounds), keycap, legend
// and case colours, and an RGB effect. Drag the background to orbit.
// (Thin wrapper: the scene lives in keyboard/KeyboardScene.jsx.)
const Scene = lazy(() => import('../keyboard/KeyboardScene.jsx'))

export default function KeyboardModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
