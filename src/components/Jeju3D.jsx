import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sky, Stars } from '@react-three/drei'
import { typeMeta } from '../lib/format'
import { loadTerrain } from '../lib/terrain'
import JejuStylized from './JejuStylized'

// 지명 라벨 (실제 좌표·고도)
const LANDMARKS = [
  { name: '한라산', sub: '1,947m', lat: 33.3617, lng: 126.5292 },
  { name: '성산일출봉', lat: 33.4584, lng: 126.9425 },
  { name: '산방산', lat: 33.2397, lng: 126.3141 },
  { name: '우도', lat: 33.5, lng: 126.953 },
  { name: '가파도', lat: 33.1667, lng: 126.2717 },
  { name: '마라도', lat: 33.1139, lng: 126.2697 },
]

// ── 날씨·시간대 ────────────────────────────────────────────
const hm = (s) => { const m = String(s ?? '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null }

// 지금이 낮·황금시간·밤 중 어디인지 (한국시간 + 일출·일몰 시각). override 로 낮/밤을 강제할 수 있다 (날씨 미리보기용)
function dayPhase(sun, override) {
  if (override === 'night') return { phase: 'night', elev: -12, az: 30 }
  if (override === 'day') return { phase: 'day', elev: 42, az: 170 }
  const kst = new Date(Date.now() + 9 * 3600e3)
  const now = kst.getUTCHours() * 60 + kst.getUTCMinutes()
  const sr = hm(sun?.sunrise) ?? 390, ss = hm(sun?.sunset) ?? 1080
  const frac = (now - sr) / (ss - sr)
  const az = 90 + 180 * Math.min(Math.max(frac, 0), 1) // 동쪽에서 떠서 남쪽을 지나 서쪽으로
  if (now < sr - 40 || now > ss + 40) return { phase: 'night', elev: -12, az }
  const elev = frac < 0 || frac > 1 ? 2 : Math.max(3, Math.sin(Math.PI * frac) * 48)
  const golden = now > ss - 60 || now < sr + 50
  return { phase: golden ? 'golden' : 'day', elev, az }
}

// 날씨 + 시간대 → 하늘·빛·안개·구름·강수·바람 설정
function atmosphere(weather, sun, override) {
  const t = dayPhase(sun, override)
  const snow = Boolean(weather?.rainy) && /눈/.test(weather?.rain ?? '')
  const rainy = Boolean(weather?.rainy) && !snow
  const overcast = rainy || snow || weather?.sky === '흐림'
  let a
  if (rainy || snow) a = { fog: '#8a97a4', turbidity: 12, rayleigh: 0.4, sun: 0.9, clouds: 0.85, dark: true }
  else if (weather?.sky === '흐림') a = { fog: '#a9b7c4', turbidity: 9, rayleigh: 0.7, sun: 1.2, clouds: 0.7, dark: true }
  else if (weather?.sky === '구름많음') a = { fog: '#b4cadc', turbidity: 5, rayleigh: 1, sun: 2.0, clouds: 0.4, dark: false }
  else a = { fog: '#bcd6ea', turbidity: 2.5, rayleigh: 1.3, sun: 2.6, clouds: 0.12, dark: false }

  const out = { ...a, ...t, rainy, snow, overcast, wind: Number(weather?.wind) || 3, sunColor: a.dark ? '#f4f6f8' : '#fff4e0', hemi: a.dark ? 0.9 : 0.6, hemiSky: '#cfe2ff', hemiGround: '#5b6150', moon: 0 }
  // 화면 밝기(노출): 위성사진의 숲이 어두워서 낮에는 올리고, 밤에는 낮춘다
  out.exposure = t.phase === 'night' ? 1.1 : t.phase === 'golden' ? 1.5 : overcast ? 1.5 : weather?.sky === '구름많음' ? 1.6 : 1.75
  if (t.phase === 'night') {
    Object.assign(out, { fog: overcast ? '#1a2533' : '#0b1626', sun: 0, sunColor: '#9db7ff', hemi: 0.42, hemiSky: '#5a73b8', hemiGround: '#141a28', moon: overcast ? 0.35 : 0.6, dark: true })
  } else if (t.phase === 'golden') {
    Object.assign(out, { fog: overcast ? '#b59a86' : '#e9b48a', turbidity: Math.max(a.turbidity, 6), sun: a.sun * 0.9, sunColor: '#ffb066', hemiSky: '#ffd9b0', hemiGround: '#6b5a48' })
  }
  return out
}

// 가장자리를 서서히 투명하게 → 바깥 바다 평면과 자연스럽게 이어지도록
function featherTexture() {
  const N = 256
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')
  const img = g.createImageData(N, N)
  const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t) }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / (N - 1), v = j / (N - 1)
    const a = Math.min(ss(0, 0.09, u), ss(0, 0.09, 1 - u), ss(0, 0.09, v), ss(0, 0.09, 1 - v))
    const k = (j * N + i) * 4
    img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(a * 255)
    img.data[k + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(c)
}

// 구름용 부드러운 원형 그라데이션
function puffTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

// 글자를 캔버스 텍스처로 만들어 스프라이트로 표시 — 화면에서 항상 같은 크기, 지형에 가려지지 않음
//  variant 'pin': 어두운 알약 모양(장소 이름) / 'geo': 그림자 있는 흰 글씨(지명)
function TextSprite({ text, sub, position, variant = 'geo', px = 13 }) {
  const { camera, size } = useThree()
  const { texture, w, h } = useMemo(() => {
    const dpr = 2
    const g0 = document.createElement('canvas').getContext('2d')
    const font = `600 ${px * dpr}px "Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif`
    g0.font = font
    const tw = Math.ceil(g0.measureText(text).width)
    const pill = variant === 'pin' || variant === 'wx'
    const padX = (pill ? 14 : 8) * dpr, padY = (pill ? 8 : 6) * dpr
    const subH = sub ? px * dpr * 0.9 : 0
    const cw = tw + padX * 2, ch = px * dpr * 1.25 + subH + padY * 2
    const c = document.createElement('canvas')
    c.width = cw; c.height = ch
    const g = c.getContext('2d')
    if (pill) {
      g.fillStyle = variant === 'wx' ? 'rgba(14,111,122,0.94)' : 'rgba(15,26,32,0.92)'
      g.beginPath(); g.roundRect(0, 0, cw, ch, 10 * dpr); g.fill()
    } else {
      g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 6 * dpr
    }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font
    g.fillText(text, cw / 2, padY + (px * dpr * 1.25) / 2)
    if (sub) { g.font = `500 ${px * dpr * 0.82}px "Pretendard Variable", Pretendard, sans-serif`; g.globalAlpha = 0.85; g.fillText(sub, cw / 2, padY + px * dpr * 1.25 + subH / 2) }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return { texture: t, w: cw / dpr, h: ch / dpr }
  }, [text, sub, variant, px])
  useEffect(() => () => texture.dispose(), [texture])

  // sizeAttenuation=false 일 때 스프라이트 높이 = scale × 거리 → 화면 높이 대비 비율로 환산
  const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  const s = (h / size.height) * k
  return (
    <sprite position={position} scale={[s * (w / h), s, 1]} renderOrder={20}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} sizeAttenuation={false} fog={false} toneMapped={false} />
    </sprite>
  )
}

function Terrain({ terrain, exag }) {
  const { gl } = useThree()
  const [detail, setDetail] = useState(null)

  // 저해상도로 먼저 보여 주고, 고해상도 위성사진이 준비되면 교체
  useEffect(() => {
    let alive = true
    terrain.loadDetail().then((c) => alive && c && setDetail(c))
    return () => { alive = false }
  }, [terrain])

  const geometry = useMemo(() => {
    const { data, gw, gh, size } = terrain.grid
    const pos = new Float32Array(gw * gh * 3)
    const uv = new Float32Array(gw * gh * 2)
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const k = j * gw + i
      pos[k * 3] = (i / (gw - 1) - 0.5) * size[0]
      pos[k * 3 + 1] = (data[k] / terrain.UNIT) * exag
      pos[k * 3 + 2] = (j / (gh - 1) - 0.5) * size[1]
      uv[k * 2] = i / (gw - 1)
      uv[k * 2 + 1] = 1 - j / (gh - 1)
    }
    const idx = new Uint32Array((gw - 1) * (gh - 1) * 6)
    let p = 0
    for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
      const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1
      idx[p++] = a; idx[p++] = c; idx[p++] = b // 위쪽(+y)을 보는 삼각형
      idx[p++] = b; idx[p++] = c; idx[p++] = d
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
    geo.computeVertexNormals()
    return geo
  }, [terrain, exag])

  const { map, alpha } = useMemo(() => {
    // GPU 최대 텍스처 크기를 넘으면 줄여서 사용
    let src = detail ?? terrain.imageCanvas
    const max = gl.capabilities.maxTextureSize
    if (src.width > max) {
      const s = max / src.width
      const small = document.createElement('canvas')
      small.width = max; small.height = Math.floor(src.height * s)
      small.getContext('2d').drawImage(src, 0, 0, small.width, small.height)
      src = small
    }
    const m = new THREE.CanvasTexture(src)
    m.colorSpace = THREE.SRGBColorSpace
    m.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    return { map: m, alpha: featherTexture() }
  }, [terrain, detail, gl])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => { map.dispose(); alpha.dispose() }, [map, alpha])

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshStandardMaterial map={map} alphaMap={alpha} transparent roughness={1} metalness={0} />
    </mesh>
  )
}

// 바깥 바다 (지형 가장자리와 같은 색)
function Sea({ color, fogColor }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]}>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} emissive={fogColor} emissiveIntensity={0.03} />
    </mesh>
  )
}

// 모든 장소를 한 번에 그리는 인스턴스 핀 — 위아래로 살짝 떠 있는 푸른 핀 (오름 수백 개도 가볍게)
//  · 선택/호버한 핀은 커지고 통통 튀며, 바닥에 퍼지는 물결 링이 생긴다 (핀이 80개 이하면 모든 핀에 은은하게)
function Pins({ spots, terrain, exag, selectedId, onSelect }) {
  const cone = useRef()
  const ball = useRef()
  const ring = useRef()
  const hit = useRef()
  const [hover, setHover] = useState(-1)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tint = useMemo(() => new THREE.Color(), [])

  const items = useMemo(() => spots.map((s) => {
    const [x, z] = terrain.project(s.lat, s.lng)
    return { s, x, z, y: (terrain.heightAt(x, z) / terrain.UNIT) * exag + 0.006, color: new THREE.Color(typeMeta(s.type).color) }
  }), [spots, terrain, exag])

  // 색과 클릭 영역은 한 번만 설정, 위치·크기는 아래 useFrame 에서 매 프레임 애니메이션
  useLayoutEffect(() => {
    items.forEach((it, i) => {
      cone.current.setColorAt(i, it.color)
      ball.current.setColorAt(i, it.color)
      dummy.position.set(it.x, it.y + 0.19, it.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix()
      hit.current.setMatrixAt(i, dummy.matrix)
    })
    for (const r of [cone.current, ball.current]) if (r.instanceColor) r.instanceColor.needsUpdate = true
    hit.current.instanceMatrix.needsUpdate = true
    hit.current.computeBoundingSphere()
  }, [items, dummy])

  const pulseAll = items.length <= 80
  useFrame(({ clock }) => {
    if (!cone.current || !ball.current || !ring.current) return
    const t = clock.elapsedTime
    items.forEach((it, i) => {
      const sel = String(it.s.id) === String(selectedId)
      const hov = i === hover
      const sc = sel ? 1.5 : hov ? 1.25 : 1
      const bob = (Math.sin(t * 2.2 + i * 0.9) + 1) * 0.5 * 0.03 + (sel ? Math.abs(Math.sin(t * 4)) * 0.06 : 0)

      dummy.position.set(it.x, it.y + 0.08 * sc + bob, it.z); dummy.rotation.set(Math.PI, 0, 0); dummy.scale.setScalar(sc); dummy.updateMatrix()
      cone.current.setMatrixAt(i, dummy.matrix)
      dummy.position.set(it.x, it.y + 0.185 * sc + bob, it.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix()
      ball.current.setMatrixAt(i, dummy.matrix)

      // 바닥 물결 링: 퍼지면서 사라짐 (더하기 블렌딩 + 색을 어둡게 = 투명해지는 효과)
      const active = sel || hov || pulseAll
      const phase = (t * (sel ? 0.9 : 0.5) + i * 0.37) % 1
      dummy.position.set(it.x, it.y + 0.012, it.z); dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.setScalar(active ? (0.7 + phase * (sel ? 1.8 : 1.1)) : 0); dummy.updateMatrix()
      ring.current.setMatrixAt(i, dummy.matrix)
      ring.current.setColorAt(i, tint.copy(it.color).multiplyScalar((1 - phase) * (sel ? 1.4 : 0.55)))
    })
    cone.current.instanceMatrix.needsUpdate = true
    ball.current.instanceMatrix.needsUpdate = true
    ring.current.instanceMatrix.needsUpdate = true
    if (ring.current.instanceColor) ring.current.instanceColor.needsUpdate = true
  })

  const sel = items.find((it) => String(it.s.id) === String(selectedId))
  const hov = hover >= 0 ? items[hover] : null

  return (
    <>
      <instancedMesh key={`r${items.length}`} ref={ring} args={[null, null, items.length]} frustumCulled={false}>
        <ringGeometry args={[0.1, 0.125, 40]} />
        <meshBasicMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
      <instancedMesh key={`c${items.length}`} ref={cone} args={[null, null, items.length]} frustumCulled={false}>
        <coneGeometry args={[0.045, 0.16, 12]} />
        <meshStandardMaterial roughness={0.45} emissive="#1e3a8a" emissiveIntensity={0.55} />
      </instancedMesh>
      <instancedMesh key={`b${items.length}`} ref={ball} args={[null, null, items.length]} frustumCulled={false}>
        <sphereGeometry args={[0.075, 20, 16]} />
        <meshStandardMaterial roughness={0.25} metalness={0.1} emissive="#1e3a8a" emissiveIntensity={0.55} />
      </instancedMesh>
      {/* 눈에 보이지 않는 큰 클릭 영역 — 작은 핀도 쉽게 누를 수 있게 */}
      <instancedMesh
        key={`h${items.length}`} ref={hit} args={[null, null, items.length]} frustumCulled={false}
        onClick={(e) => { e.stopPropagation(); onSelect(items[e.instanceId]?.s) }}
        onPointerMove={(e) => { e.stopPropagation(); setHover(e.instanceId); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(-1); document.body.style.cursor = '' }}
      >
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>

      {sel && <TextSprite text={sel.s.title} variant="pin" position={[sel.x, sel.y + 0.52, sel.z]} />}
      {hov && hov !== sel && <TextSprite text={hov.s.title} variant="pin" position={[hov.x, hov.y + 0.46, hov.z]} />}
    </>
  )
}

function GeoLabels({ terrain, exag }) {
  return LANDMARKS.map((l) => {
    const [x, z] = terrain.project(l.lat, l.lng)
    const y = (terrain.heightAt(x, z) / terrain.UNIT) * exag
    return <TextSprite key={l.name} text={l.name} sub={l.sub} position={[x, y + 0.26, z]} px={12} />
  })
}

// 날씨에 맞춘 구름 · 비 · 눈 (바람이 셀수록 구름이 빨리 흐르고 비가 비스듬히 내린다)
function Weather({ atm }) {
  const tex = useMemo(puffTexture, [])
  const group = useRef()
  const rain = useRef()
  const snow = useRef()
  const puffs = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    x: ((i * 53) % 100) / 100 * 12 - 6, y: 1.9 + ((i * 29) % 7) * 0.16, z: ((i * 71) % 100) / 100 * 7 - 3.5, s: 2 + ((i * 17) % 5) * 0.7,
  })), [])
  const scatter = (n) => {
    const a = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * 11; a[i * 3 + 1] = Math.random() * 4; a[i * 3 + 2] = (Math.random() - 0.5) * 7 }
    return a
  }
  const drops = useMemo(() => scatter(1100), [])
  const flakes = useMemo(() => scatter(900), [])

  useFrame(({ clock }, dt) => {
    if (group.current) group.current.position.x = ((group.current.position.x + dt * (0.08 + atm.wind * 0.035) + 3) % 6) - 3
    if (rain.current) {
      const arr = rain.current.geometry.attributes.position.array
      for (let i = 0; i < 1100; i++) {
        arr[i * 3 + 1] -= dt * 6
        arr[i * 3] += dt * atm.wind * 0.25
        if (arr[i * 3] > 5.5) arr[i * 3] -= 11
        if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 4
      }
      rain.current.geometry.attributes.position.needsUpdate = true
    }
    if (snow.current) {
      const arr = snow.current.geometry.attributes.position.array
      const t = clock.elapsedTime
      for (let i = 0; i < 900; i++) {
        arr[i * 3 + 1] -= dt * 0.7
        arr[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.25 + dt * atm.wind * 0.06
        if (arr[i * 3] > 5.5) arr[i * 3] -= 11
        if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 4
      }
      snow.current.geometry.attributes.position.needsUpdate = true
    }
  })

  const cloudColor = atm.phase === 'night' ? '#4a5568' : atm.dark ? '#9aa4ae' : atm.phase === 'golden' ? '#ffd2b0' : '#ffffff'
  return (
    <>
      <group ref={group}>
        {puffs.map((p, i) => (
          <sprite key={i} position={[p.x, p.y, p.z]} scale={[p.s, p.s * 0.55, 1]}>
            <spriteMaterial map={tex} transparent depthWrite={false} opacity={atm.clouds * 0.75} color={cloudColor} fog={false} />
          </sprite>
        ))}
      </group>
      {atm.rainy && (
        <points ref={rain}>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[drops, 3]} /></bufferGeometry>
          <pointsMaterial color="#e6f1ff" size={0.05} transparent opacity={0.9} depthWrite={false} />
        </points>
      )}
      {atm.snow && (
        <points ref={snow}>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[flakes, 3]} /></bufferGeometry>
          <pointsMaterial color="#ffffff" size={0.065} transparent opacity={0.92} depthWrite={false} />
        </points>
      )}
    </>
  )
}

// 지역별 현재 날씨를 지도 위에 띄우는 라벨 (제주시·서귀포시·성산·한림)
export const WEATHER_REGIONS = [
  { place: '제주시', lat: 33.4996, lng: 126.5312 },
  { place: '서귀포시', lat: 33.2541, lng: 126.5601 },
  { place: '성산', lat: 33.4585, lng: 126.9425 },
  { place: '한림', lat: 33.414, lng: 126.265 },
]
function RegionWeather({ terrain, exag, items }) {
  return items.map((r) => {
    const [x, z] = terrain.project(r.lat, r.lng)
    const y = (terrain.heightAt(x, z) / terrain.UNIT) * exag
    return <TextSprite key={r.place} variant="wx" px={12} text={`${r.place} ${r.temp}°`} sub={`${r.rainy ? r.rain : r.sky} · 강수 ${r.pop}%`} position={[x, y + 0.75, z]} />
  })
}

// 선택한 핀으로 카메라가 부드럽게 이동
function CameraRig({ controls, target }) {
  const { camera } = useThree()
  useFrame(() => {
    const c = controls.current
    if (!c || !target) return
    const want = new THREE.Vector3(...target)
    const delta = want.clone().sub(c.target).multiplyScalar(0.08)
    c.target.add(delta)
    camera.position.add(delta)
    const dist = camera.position.distanceTo(c.target)
    if (dist > 3.2) camera.position.lerp(c.target, 0.025) // 너무 멀면 가까이
    c.update()
  })
  return null
}

function Scene({ terrain, spots, selectedId, onSelect, weather, sun, override, regional, exag }) {
  const atm = atmosphere(weather, sun, override)
  const controls = useRef()
  const az = THREE.MathUtils.degToRad(atm.az)
  const el = THREE.MathUtils.degToRad(atm.elev)
  // 방위각은 북쪽 기준 시계 방향 (북쪽 = −z, 동쪽 = +x)
  const sunDir = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]
  const sel = spots.find((s) => String(s.id) === String(selectedId))
  const target = useMemo(() => {
    if (!sel) return null
    const [x, z] = terrain.project(sel.lat, sel.lng)
    return [x, (terrain.heightAt(x, z) / terrain.UNIT) * exag, z]
  }, [sel, terrain, exag])

  // 시간대·날씨에 맞춘 화면 밝기, 그리고 낮에는 바다색을 하늘색 쪽으로 밝게
  const { gl } = useThree()
  useEffect(() => { gl.toneMappingExposure = atm.exposure }, [gl, atm.exposure])
  const seaColor = useMemo(
    () => new THREE.Color(terrain.seaColor).lerp(new THREE.Color(atm.fog), atm.phase === 'night' ? 0.06 : 0.35).getStyle(),
    [terrain.seaColor, atm.fog, atm.phase],
  )

  return (
    <>
      <color attach="background" args={[atm.fog]} />
      <fog attach="fog" args={[atm.fog, 9, 40]} />
      <Sky distance={1500} sunPosition={sunDir.map((v) => v * 100)} turbidity={atm.turbidity} rayleigh={atm.rayleigh} mieCoefficient={0.005} mieDirectionalG={0.8} />
      {atm.phase === 'night' && atm.clouds < 0.6 && <Stars radius={400} depth={60} count={3000} factor={7} saturation={0} fade speed={0.4} />}
      <hemisphereLight args={[atm.hemiSky, atm.hemiGround, atm.hemi]} />
      {atm.sun > 0 && <directionalLight position={sunDir.map((v) => v * 20)} intensity={atm.sun} color={atm.sunColor} />}
      {atm.moon > 0 && <directionalLight position={[-6, 10, 4]} intensity={atm.moon} color="#9db7ff" />}

      <Sea color={seaColor} fogColor={atm.fog} />
      <Terrain terrain={terrain} exag={exag} />
      <GeoLabels terrain={terrain} exag={exag} />
      {regional?.length > 0 && <RegionWeather terrain={terrain} exag={exag} items={regional} />}
      <Pins spots={spots} terrain={terrain} exag={exag} selectedId={selectedId} onSelect={onSelect} />
      <Weather atm={atm} />

      <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={1.2} maxDistance={14} maxPolarAngle={Math.PI / 2.08} target={[0, 0, 0]} />
      <CameraRig controls={controls} target={target} />
    </>
  )
}

// spots: [{id,title,lat,lng,type}]
// weather: 날씨 API 의 now 값 ({sky, rainy, rain, wind}) / sun: {sunrise, sunset} / override: 'day'|'night'|null (낮·밤 강제)
// regional: [{place, lat, lng, temp, sky, rain, rainy, pop}] 지역별 날씨 라벨 / exaggeration: 고도 과장 배율
export default function Jeju3D({ spots = [], selectedId, onSelect = () => {}, weather, sun, override = null, regional = [], exaggeration = 3 }) {
  const [terrain, setTerrain] = useState(null)
  const [error, setError] = useState(null)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    let alive = true
    loadTerrain((p) => alive && setPct(Math.round(p * 100)))
      .then((t) => alive && setTerrain(t))
      .catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [])

  // 지형 데이터를 못 받으면 단순화된 섬으로 대체
  if (error) {
    return <JejuStylized spots={spots} selectedId={selectedId} onSelect={onSelect} weather={weather} />
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {!terrain && (
        <div className="jp-map-loading">
          <div className="spinner-border spinner-border-sm me-2" />실제 지형을 불러오는 중… {pct}%
        </div>
      )}
      {terrain && (
        <Canvas
          camera={{ position: [0, 4.2, 6.4], fov: 40, near: 0.05, far: 4000 }}
          dpr={[1, 2]}
          onPointerMissed={() => onSelect(null)}
        >
          <Scene terrain={terrain} spots={spots} selectedId={selectedId} onSelect={onSelect} weather={weather} sun={sun} override={override} regional={regional} exag={exaggeration} />
        </Canvas>
      )}
    </div>
  )
}
