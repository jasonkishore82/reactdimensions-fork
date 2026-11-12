import { Suspense, lazy } from 'react'

// A hardback book with a leather cover, gold foil and paper pages that bend as
// they turn. The title, subtitle, number of pages, the text on every page, all
// the colours and the logo (built-in or your own image) are props. Click a
// page or use the arrows to turn it; drag to orbit.
//
// content: pages are separated by a line of three dashes (---). In a page,
// "# Heading" makes a heading, "> note" an italic note, and "Name | Price"
// sets two parts apart with a dotted leader.
// (Thin wrapper: the scene lives in book/BookScene.jsx.)
const Scene = lazy(() => import('../book/BookScene.jsx'))

export default function BookModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}
