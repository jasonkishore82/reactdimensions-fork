// An infinite curved studio backdrop (cyclorama) in a single tinted colour.
// The wall bends into the floor with no visible seam, lit by a soft key light
// from above, with an optional contact shadow where the subject sits.
export default function Cyclorama({
  children,
  tint = '#d9d4ca',
  horizon = 62,
  curve = 18,
  light = 0.45,
  vignette = 0.35,
  shadow = true,
  style,
}) {
  // Every shade comes from the one tint: lighter up the wall, darker toward the camera.
  const shade = (pct) =>
    pct >= 0
      ? `color-mix(in oklab, ${tint}, white ${pct}%)`
      : `color-mix(in oklab, ${tint}, black ${-pct}%)`

  // The bend: an eased run of stops from wall to floor, so the join reads as a curve.
  const start = horizon - curve / 2
  const steps = 8
  const bend = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const ease = t * t * (3 - 2 * t)
    return `${shade(Math.round(6 - ease * 14))} ${(start + t * curve).toFixed(2)}%`
  }).join(', ')

  const sweep = `linear-gradient(to bottom, ${shade(18)} 0%, ${bend}, ${shade(-22)} 100%)`
  const key = `radial-gradient(ellipse 70% 55% at 50% ${horizon - 14}%, rgba(255,255,255,${light}), transparent 70%)`
  const floorY = horizon + (100 - horizon) * 0.42
  const contact = `radial-gradient(ellipse 22% 4% at 50% ${floorY}%, rgba(0,0,0,0.28), transparent 70%)`
  const edges = `radial-gradient(ellipse 85% 80% at 50% 45%, transparent 55%, rgba(0,0,0,${vignette}) 100%)`

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: tint,
        backgroundImage: [shadow && contact, edges, key, sweep].filter(Boolean).join(', '),
        ...style,
      }}
    >
      <div style={{ position: 'relative', height: '100%' }}>{children}</div>
    </div>
  )
}
