import { createBrowserRouter } from 'react-router-dom'
import RootLayout from './layouts/RootLayout'
import Home from './pages/Home'
import Explore from './pages/Explore'
import PhotoDetail from './pages/PhotoDetail'
import Map3D from './pages/Map3D'
import Agent from './pages/Agent'
import My from './pages/My'
import StatusPage from './pages/StatusPage'
import NotFound from './pages/NotFound'

// ── 메뉴 목록 ────────────────────────────────────────────
// 페이지를 추가할 때: ① pages/에 파일 만들기 ② NAV_ITEMS 에 한 줄 ③ routes 에 한 줄
export const NAV_ITEMS = [
  { to: '/', label: '홈', icon: 'house' },
  { to: '/explore', label: '사진 탐색', icon: 'images' },
  { to: '/map', label: '3D 지도', icon: 'globe-asia-australia' },
  { to: '/agent', label: 'AI 가이드', icon: 'chat-heart' },
  { to: '/my', label: '내 보관함', icon: 'bookmark-heart' },
]

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      { path: 'explore', element: <Explore /> },
      { path: 'photo/:id', element: <PhotoDetail /> },
      { path: 'map', element: <Map3D /> },
      { path: 'agent', element: <Agent /> },
      { path: 'my', element: <My /> },
      { path: 'status', element: <StatusPage /> },
    ],
  },
])
