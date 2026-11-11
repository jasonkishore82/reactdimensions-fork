// A studio sweep whose gradient is built from the product's main colour.
// Change `color` and the backdrop eases to the new hue; `drift` slowly walks
// the hue back and forth so the light feels alive.
export default function GradientSweep({
  children,
  color = '#ff4d1a',
  base = '#121316',
  shift = 40,
  strength = 0.55,
  drift = 0,
  speed = 8,
  transition = 0.9,
  style,
}) {
  // Two hues: the product colour and a neighbour `shift` degrees round the wheel.
  const hue = (deg) => `oklch(from ${color} l c calc(h + ${deg} + var(--gs-drift)))`
  const mix = (c, pct) => `color-mix(in oklch, ${c} ${pct}%, ${base})`
  const s = Math.round(strength * 100)

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
        background: base,
        '--gs-top': mix(hue(-shift / 2), Math.round(s * 0.35)),
        '--gs-mid': mix(color, s),
        '--gs-low': mix(hue(shift), Math.round(s * 0.8)),
        '--gs-glow': mix(color, Math.min(100, s + 25)),
        transition: ['--gs-top', '--gs-mid', '--gs-low', '--gs-glow'].map((p) => `${p} ${transition}s ease`).join(', '),
        animation: drift ? `gs-drift ${speed}s ease-in-out infinite alternate` : 'none',
        ...style,
      }}
    >
      <style>{`
        @property --gs-top { syntax: '<color>'; inherits: true; initial-value: transparent; }
        @property --gs-mid { syntax: '<color>'; inherits: true; initial-value: transparent; }
        @property --gs-low { syntax: '<color>'; inherits: true; initial-value: transparent; }
        @property --gs-glow { syntax: '<color>'; inherits: true; initial-value: transparent; }
        @property --gs-drift { syntax: '<number>'; inherits: true; initial-value: 0; }
        @keyframes gs-drift { from { --gs-drift: ${-drift / 2}; } to { --gs-drift: ${drift / 2}; } }
      `}</style>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: [
            // glow behind the subject, then a dark floor, over the wall-to-floor sweep
            'radial-gradient(ellipse 45% 40% at 50% 48%, var(--gs-glow), transparent 70%)',
            `radial-gradient(ellipse 120% 60% at 50% 115%, ${base}, transparent 70%)`,
            'linear-gradient(to bottom, var(--gs-top) 0%, var(--gs-mid) 55%, var(--gs-low) 72%, var(--gs-top) 100%)',
          ].join(', '),
        }}
      />
      <div style={{ position: 'relative', height: '100%' }}>{children}</div>
    </div>
  )
}
