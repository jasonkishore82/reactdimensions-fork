import { Suspense, lazy } from 'react'

// A slim aluminium tablet with chamfered edges, black glass and a live home
// screen (clock, date, apps and a dock). Landscape or portrait, with the body
// and wallpaper colours easing to new values. It leans towards the pointer;
// click it to flip it over and see the camera on the back. Drag to orbit.
// (Thin wrapper: the scene lives in tablet/TabletScene.jsx.)
const Scene = lazy(() => import('../tablet/TabletScene.jsx'))

export default function TabletModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
