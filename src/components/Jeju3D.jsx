import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'

// 위도·경도 → 3D 좌표 (제주 중심 북위 33.38, 동경 126.55 기준)
const toXZ = (lat, lng) => [(lng - 126.55) * 20, (33.38 - lat) * 20]

function Pin({ lat, lng, name }) {
  const [x, z] = toXZ(Number(lat), Number(lng))
  return (
    <mesh position={[x, 0.4, z]}>
      <coneGeometry args={[0.15, 0.6, 8]} />
      <meshStandardMaterial color="tomato" />
      <Html distanceFactor={10}><div className="badge text-bg-dark">{name}</div></Html>
    </mesh>
  )
}

export default function Jeju3D({ items = [] }) {
  const pins = items.filter((h) => Number(h.lat) > 0 && Number(h.lng) > 0)
  return (
    <Canvas camera={{ position: [0, 8, 10] }} style={{ height: 420 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} />
      {/* 제주섬: 동서로 긴 타원 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.45, 1]}>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial color="#6aa84f" />
      </mesh>
      {/* 한라산 */}
      <mesh position={[0, 0.75, 0]}>
        <coneGeometry args={[1.5, 1.5, 32]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      {pins.map((h, i) => <Pin key={i} {...h} />)}
      <OrbitControls />   {/* 마우스로 돌리기·확대 */}
    </Canvas>
  )
}
