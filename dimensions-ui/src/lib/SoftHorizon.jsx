// A wall and a floor that meet at a soft, blurred band of light, like the
// horizon of a studio set where the join has been lit out of focus.
export default function SoftHorizon({
  children,
  wall = '#1b1d22',
  floor = '#2a2c31',
  band = '#f3efe6',
  horizon = 60,
  softness = 40,
  glow = 0.35,
  spread = 70,
  style,
}) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate', background: wall, ...style }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* wall into floor in one gradient, crossing over across the band so
            there is no hard edge; the floor is lit near the join and falls off
            toward the camera */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom,
              ${wall} 0%,
              color-mix(in oklab, ${wall}, ${band} 8%) calc(${horizon}% - ${softness / 2}px),
              color-mix(in oklab, ${floor}, ${band} 12%) calc(${horizon}% + ${softness / 2}px),
              ${floor} calc(${horizon}% + (100% - ${horizon}%) * 0.45),
              color-mix(in oklab, ${floor}, black 35%) 100%)`,
          }}
        />
        {/* the band itself, blurred so the join has no hard edge */}
        <div
          style={{
            position: 'absolute',
            left: `${(100 - spread) / 2}%`,
            width: `${spread}%`,
            top: `${horizon}%`,
            height: Math.max(2, softness / 6),
            transform: 'translateY(-50%)',
            borderRadius: '50%',
            background: band,
            opacity: glow,
            filter: `blur(${softness}px)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, transparent calc(${horizon}% - ${softness}px), color-mix(in oklab, ${band} ${Math.round(glow * 40)}%, transparent) ${horizon}%, transparent calc(${horizon}% + ${softness}px))`,
          }}
        />
      </div>
      <div style={{ position: 'relative', height: '100%' }}>{children}</div>
    </div>
  )
}
