import { Suspense, lazy } from 'react'

// Manual typewriter. Type on your real keyboard or click the round keys: the
// typebar swings up and strikes the platen, the letter is inked onto the paper
// and the carriage steps along. A bell rings near the margin; Enter or the
// chrome lever returns the carriage. Drag the background to orbit.
// (Thin wrapper: the scene lives in typewriter/TypewriterScene.jsx.)
const Scene = lazy(() => import('../typewriter/TypewriterScene.jsx'))

export default function TypewriterModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
