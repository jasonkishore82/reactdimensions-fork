// A plain, faceless figure 5'9" (69 in) tall, to show how big the screen is.
export default function Person({ color = '#b5b0a6' }) {
  const m = <meshStandardMaterial color={color} roughness={0.85} />
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 3.1, 17.5, 0]} castShadow>
          <capsuleGeometry args={[3.2, 28, 6, 16]} />
          {m}
        </mesh>
      ))}
      <mesh position={[0, 45, 0]} scale={[1.2, 1, 0.68]} castShadow>
        <capsuleGeometry args={[6.4, 14, 8, 20]} />
        {m}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 8.9, 44, 0]} rotation={[0, 0, s * 0.06]} castShadow>
          <capsuleGeometry args={[2.3, 22, 6, 12]} />
          {m}
        </mesh>
      ))}
      <mesh position={[0, 63.6, 0.2]} castShadow>
        <sphereGeometry args={[4.6, 24, 18]} />
        {m}
      </mesh>
      <mesh position={[0, 58.5, 0]}>
        <cylinderGeometry args={[2.2, 2.6, 4, 12]} />
        {m}
      </mesh>
    </group>
  )
}
