import { createBrowserRouter } from 'react-router-dom'
import RootLayout from './layouts/RootLayout'
import Home from './pages/Home'
import Explore from './pages/Explore'
import PhotoDetail from './pages/PhotoDetail'
import Map3D from './pages/Map3D'
import Info from './pages/Info'
import PhotoSpots from './pages/PhotoSpots'
import Near from './pages/Near'
import Album from './pages/Album'
import SpotUpload from './pages/SpotUpload'
import SharedRoute from './pages/SharedRoute'
import Agent from './pages/Agent'
import My from './pages/My'
import Login from './pages/Login'
import StatusPage from './pages/StatusPage'
import NotFound from './pages/NotFound'

// ── 메뉴 목록 ────────────────────────────────────────────
// 페이지를 추가할 때: ① pages/에 파일 만들기 ② NAV_ITEMS 에 한 줄 ③ routes 에 한 줄
export const NAV_ITEMS = [
  { to: '/agent', label: 'AI 가이드', icon: 'stars', ai: true },
  { to: '/explore', label: '사진 탐색', icon: 'images' },
  { to: '/spots', label: '포토 스팟', icon: 'camera' },
  { to: '/near', label: '내 주변', icon: 'geo-alt' },
  { to: '/album', label: '미니앨범', icon: 'film' },
  { to: '/map', label: '지도', icon: 'map' },
  { to: '/info', label: '여행 정보', icon: 'info-circle' },
]

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      { path: 'agent', element: <Agent /> },
      { path: 'explore', element: <Explore /> },
      { path: 'photo/:id', element: <PhotoDetail /> },
      { path: 'map', element: <Map3D /> },
      { path: 'info', element: <Info /> },
      { path: 'spots', element: <PhotoSpots /> },
      { path: 'near', element: <Near /> },
      { path: 'album', element: <Album /> },
      { path: 'spots/upload', element: <SpotUpload /> },
      { path: 'share', element: <SharedRoute /> },
      { path: 'my', element: <My /> },
      { path: 'login', element: <Login /> },
      { path: 'status', element: <StatusPage /> },
    ],
  },
])
