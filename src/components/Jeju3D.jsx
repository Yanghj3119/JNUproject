import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { typeMeta } from '../lib/format'

// ── 좌표 변환 ─────────────────────────────────────────────
// 위도·경도 → 3D 좌표. 1 단위 ≈ 10km (위도 1° ≈ 111km, 제주 위도에서 경도 1° ≈ 92.7km)
const KX = 9.27, KZ = 11.1
const toXZ = (lat, lng) => [(lng - 126.55) * KX, (33.38 - lat) * KZ]
const LAND_H = 0.3

// 제주 해안선 (경도, 위도) — 시계 방향, 부드럽게 이어서 사용
const COAST = [
  [126.53, 33.52], [126.65, 33.54], [126.76, 33.56], [126.87, 33.54], [126.95, 33.47], [126.93, 33.41],
  [126.88, 33.36], [126.83, 33.32], [126.72, 33.26], [126.6, 33.24], [126.45, 33.23], [126.3, 33.23],
  [126.18, 33.24], [126.15, 33.28], [126.16, 33.35], [126.17, 33.43], [126.23, 33.49], [126.33, 33.51], [126.43, 33.51],
]

// 산: 한라산과 대표 오름 (높이는 보기 좋게 과장)
const MOUNTAINS = [
  { name: '한라산', lat: 33.3617, lng: 126.5292, h: 1.15, r: 1.7, color: '#6f9a58' },
  { name: '성산일출봉', lat: 33.4584, lng: 126.9425, h: 0.4, r: 0.32, color: '#7aa35f' },
  { name: '산방산', lat: 33.2397, lng: 126.3141, h: 0.45, r: 0.28, color: '#8a9a6a' },
].map((m) => ({ ...m, pos: toXZ(m.lat, m.lng) }))

function heightAt(x, z) {
  let h = 0
  for (const m of MOUNTAINS) {
    const d = Math.hypot(x - m.pos[0], z - m.pos[1])
    if (d < m.r) h = Math.max(h, m.h * (1 - Math.pow(d / m.r, 1.6)))
  }
  return h
}

function Island() {
  const geometry = useMemo(() => {
    const pts = COAST.map(([lng, lat]) => { const [x, z] = toXZ(lat, lng); return new THREE.Vector3(x, -z, 0) })
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
    const shape = new THREE.Shape(curve.getPoints(220).map((p) => new THREE.Vector2(p.x, p.y)))
    return new THREE.ExtrudeGeometry(shape, { depth: LAND_H, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.07, bevelSegments: 2, curveSegments: 1 })
  }, [])
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#9bc77a" roughness={0.9} />
    </mesh>
  )
}

function Mountain({ pos, h, r, color }) {
  const geometry = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 24; i++) {
      const rr = r * (1 - i / 24)
      pts.push(new THREE.Vector2(rr, h * (1 - Math.pow(rr / r, 1.6))))
    }
    return new THREE.LatheGeometry(pts, 40)
  }, [h, r])
  return (
    <mesh geometry={geometry} position={[pos[0], LAND_H, pos[1]]}>
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  )
}

function Pin({ spot, selected, onSelect }) {
  const group = useRef()
  const [hover, setHover] = useState(false)
  const [x, z] = toXZ(spot.lat, spot.lng)
  const y = LAND_H + heightAt(x, z)
  const color = typeMeta(spot.type).color

  useFrame(({ clock }) => {
    if (!group.current) return
    const s = selected ? 1.5 + Math.sin(clock.elapsedTime * 4) * 0.12 : hover ? 1.3 : 1
    group.current.scale.setScalar(s)
    group.current.position.y = y + 0.22 + (selected ? Math.sin(clock.elapsedTime * 3) * 0.05 : 0)
  })

  return (
    <group
      ref={group} position={[x, y + 0.22, z]}
      onClick={(e) => { e.stopPropagation(); onSelect(spot) }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
    >
      <mesh position={[0, 0.12, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.07, 0.22, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.6 : 0.15} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.6 : 0.15} />
      </mesh>
      {(selected || hover) && (
        <Html position={[0, 0.7, 0]} center distanceFactor={9} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="jp-pin-label">{spot.title}</div>
        </Html>
      )}
    </group>
  )
}

// 비·눈 소식이 있을 때 섬 위에 내리는 비
function Rain({ count = 900 }) {
  const ref = useRef()
  const pos = useMemo(() => {
    const a = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 12
      a[i * 3 + 1] = Math.random() * 6
      a[i * 3 + 2] = (Math.random() - 0.5) * 6
    }
    return a
  }, [count])
  useFrame((_, dt) => {
    const arr = ref.current.geometry.attributes.position.array
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] -= dt * 7
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 6
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry>
      <pointsMaterial color="#d6ecff" size={0.045} transparent opacity={0.8} />
    </points>
  )
}

function Clouds({ dark }) {
  const ref = useRef()
  const puffs = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    x: -5 + i * 1.7, y: 3 + (i % 3) * 0.35, z: -1.5 + ((i * 37) % 5) * 0.7, s: 0.5 + (i % 3) * 0.2,
  })), [])
  useFrame((_, dt) => { ref.current.position.x = ((ref.current.position.x + dt * 0.15 + 6) % 12) - 6 })
  return (
    <group ref={ref}>
      {puffs.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} scale={[p.s * 1.8, p.s * 0.7, p.s]}>
          <sphereGeometry args={[0.6, 16, 12]} />
          <meshStandardMaterial color={dark ? '#8e99a6' : '#ffffff'} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

const SKY_BG = { 맑음: '#bfe6ff', 구름많음: '#cfdde8', 흐림: '#b3bec9', 비: '#8b99a8' }

// spots: [{id,title,lat,lng,type}] / weather: 날씨 API 의 now 값 ({sky, rainy})
export default function Jeju3D({ spots = [], selectedId, onSelect = () => {}, weather }) {
  const rainy = Boolean(weather?.rainy)
  const sky = weather?.sky
  const bg = rainy ? SKY_BG.비 : (SKY_BG[sky] ?? SKY_BG.맑음)
  const cloudy = rainy || sky === '흐림' || sky === '구름많음'

  return (
    <Canvas camera={{ position: [0, 6.5, 8.5], fov: 45 }} dpr={[1, 2]} onPointerMissed={() => onSelect(null)}>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 14, 30]} />
      <ambientLight intensity={rainy ? 0.7 : 0.9} />
      <directionalLight position={[6, 10, 5]} intensity={rainy ? 0.8 : 1.6} color={sky === '맑음' ? '#fff3d6' : '#ffffff'} />

      {/* 바다 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={rainy ? '#3f7fa0' : '#2a9fd6'} roughness={0.35} metalness={0.1} />
      </mesh>

      <Island />
      {MOUNTAINS.map((m) => <Mountain key={m.name} {...m} />)}
      {spots.map((s) => <Pin key={s.id} spot={s} selected={String(s.id) === String(selectedId)} onSelect={onSelect} />)}

      {cloudy && <Clouds dark={rainy || sky === '흐림'} />}
      {rainy && <Rain />}

      <OrbitControls enablePan={false} minDistance={4} maxDistance={16} maxPolarAngle={Math.PI / 2.15} />
    </Canvas>
  )
}
