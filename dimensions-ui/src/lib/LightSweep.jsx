// A band of specular light that sweeps across a surface on a loop,
// like a studio light passing over polished metal.
export default function LightSweep({
  children,
  speed = 3.5,
  angle = 115,
  intensity = 0.55,
  width = 22,
  base = '#15171a',
  pause = 1.2,
  style,
}) {
  const total = speed + pause
  const sweepEnd = (speed / total) * 100
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: base, isolation: 'isolate', ...style }}>
      <style>{`
        @keyframes ls-sweep {
          0% { transform: translateX(-60%); }
          ${sweepEnd}% { transform: translateX(60%); }
          100% { transform: translateX(60%); }
        }
      `}</style>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-50%',
          background: `linear-gradient(${angle}deg, transparent ${50 - width / 2}%, rgba(255,255,255,${intensity}) 50%, transparent ${50 + width / 2}%)`,
          mixBlendMode: 'screen',
          animation: `ls-sweep ${total}s cubic-bezier(0.45, 0, 0.2, 1) infinite`,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div style={{ position: 'relative', height: '100%' }}>{children}</div>
    </div>
  )
}
