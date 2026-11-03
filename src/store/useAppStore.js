import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { askAgent } from '../api/client'
import { matchFavorites } from '../lib/favKey'

// AI 가 추천한 코스를 최근 10개까지 이 브라우저(localStorage)에 기록해 둔다 — 새 대화·새로고침 뒤에도 다시 볼 수 있다
const ROUTE_HISTORY_MAX = 10
const ROUTE_HISTORY_KEY = 'jp-route-history'
function loadRouteHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(ROUTE_HISTORY_KEY) || '[]')
    return Array.isArray(list) ? list.filter((e) => e?.route?.stops?.length || e?.places?.length).slice(0, ROUTE_HISTORY_MAX) : []
  } catch { return [] }
}
function saveRouteHistory(list) {
  try { localStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(list)) } catch { /* 저장소를 못 쓰는 환경 */ }
}

// ── 앱 전체가 함께 쓰는 상태(store) ──────────────────────
// 사용법:  const user = useAppStore((s) => s.user)
let authStarted = false

export const useAppStore = create((set, get) => ({
  // ① 인증 — Supabase Auth (이메일·비밀번호)
  user: null,
  authReady: false,
  initAuth: async () => {
    if (authStarted) return
    authStarted = true
    if (!supabase) return set({ authReady: true })
    const { data } = await supabase.auth.getSession()
    set({ user: data.session?.user ?? null, authReady: true })
    if (data.session) { get().loadFavorites(); get().loadRoutes() }
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      if (user?.id === get().user?.id) return
      set({ user, favorites: [], routes: [] })
      if (user) { get().loadFavorites(); get().loadRoutes() }
    })
  },
  signUp: async ({ email, password, name }) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
    if (error) throw error
    return { needsConfirm: !data.session } // 이메일 확인이 켜져 있으면 세션이 바로 생기지 않음
  },
  signIn: async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  },
  // 카카오 로그인 — Supabase 의 Kakao provider 로 이동 → 카카오 로그인 → 홈(/)으로 돌아옴
  signInKakao: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      // prompt=login: 브라우저에 카카오 계정 로그인이 남아 있어도 매번 아이디·비밀번호를 다시 묻는다 (카카오톡 프로그램과는 별개의 로그인이다)
      options: { redirectTo: `${window.location.origin}/`, queryParams: { prompt: 'login' } },
    })
    if (error) throw error
  },
  signOut: async () => {
    await supabase?.auth.signOut()
    set({ user: null, favorites: [], routes: [] })
  },

  // ② 알림(토스트)
  toasts: [],
  toast: (message, variant = 'success') => {
    const id = Date.now() + Math.random()
    set({ toasts: [...get().toasts, { id, message, variant }] })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600)
  },

  // ③ 위시리스트 — 로그인한 사용자의 favorites (RLS 로 본인 것만 조회)
  favorites: [],
  favLoading: false,
  loadFavorites: async () => {
    if (!supabase || !get().user) return
    set({ favLoading: true })
    const { data, error } = await supabase.from('favorites').select('*').order('created_at', { ascending: false })
    set({ favLoading: false })
    if (error) return get().toast(error.message, 'danger')
    set({ favorites: data })
  },
  toggleFavorite: async ({ source, id, title, image }) => {
    if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
    if (!get().user) return get().toast('로그인하면 위시리스트에 담을 수 있어요', 'warning')
    // 같은 장소가 다른 화면(사진 탐색·지도·포토 스팟)에서 담겨 있어도 함께 빼서, 어디서 눌러도 하트가 같게 보이게 한다
    const existing = matchFavorites(get().favorites, { source, id, title })
    if (existing.length) {
      const ids = existing.map((f) => f.id)
      const { error } = await supabase.from('favorites').delete().in('id', ids)
      if (error) return get().toast(error.message, 'danger')
      set({ favorites: get().favorites.filter((f) => !ids.includes(f.id)) })
      return get().toast('위시리스트에서 뺐어요', 'secondary')
    }
    const { data, error } = await supabase.from('favorites')
      .insert({ source, item_id: String(id), title, image: image || null }).select().single()
    if (error) return get().toast(error.message, 'danger')
    set({ favorites: [data, ...get().favorites] })
    get().toast('위시리스트에 담았어요')
  },

  // ④ 내 경로 — AI 가이드가 만든 코스 저장
  routes: [],
  loadRoutes: async () => {
    if (!supabase || !get().user) return
    const { data, error } = await supabase.from('routes').select('*').order('created_at', { ascending: false })
    if (error) return get().toast(error.message, 'danger')
    set({ routes: data })
  },
  saveRoute: async ({ title, summary, stops }) => {
    if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
    if (!get().user) return get().toast('로그인하면 경로를 저장할 수 있어요', 'warning')
    const { data, error } = await supabase.from('routes').insert({ title, summary: summary || null, stops }).select().single()
    if (error) return get().toast(error.message, 'danger')
    set({ routes: [data, ...get().routes] })
    get().toast('내 경로에 저장했어요')
    return data
  },
  deleteRoute: async (id) => {
    const { error } = await supabase.from('routes').delete().eq('id', id)
    if (error) return get().toast(error.message, 'danger')
    set({ routes: get().routes.filter((r) => r.id !== id) })
  },

  // ⑤ AI 가이드 대화 — 페이지를 옮겨도 대화가 남도록 store 에 둠
  messages: [], // { role: 'user' | 'assistant', text, steps, route }
  chatLoading: false,
  routeHistory: loadRouteHistory(), // 최근에 AI가 추천한 코스 (최신이 앞, 이 브라우저에 저장)
  // 추천 기록 지우기 — 이 브라우저에 저장된 기록만 지워진다 (로그인한 대화 기록은 별도)
  deleteHistory: (id) => {
    const list = get().routeHistory.filter((e) => e.id !== id)
    set({ routeHistory: list })
    saveRouteHistory(list)
  },
  clearHistory: () => {
    set({ routeHistory: [] })
    saveRouteHistory([])
  },
  sendMessage: async (text) => {
    const history = get().messages.map((m) => ({ role: m.role, content: m.text }))
    set({ messages: [...get().messages, { role: 'user', text }], chatLoading: true })
    try {
      const { answer, steps, route } = await askAgent(text, history)
      set({ messages: [...get().messages, { role: 'assistant', text: answer, steps, route }] })
      // 지도에 보여 줄 최신 정보: 코스가 있으면 코스, 없으면 AI가 확인한 주변 장소들
      const base = { id: `${Date.now()}`, at: new Date().toISOString(), question: text, summary: answer }
      let entry = null
      if (route?.stops?.length) {
        entry = { ...base, kind: 'route', route: { ...route, stops: route.stops.map(({ image: _i, ...s }) => s) } }
      } else {
        const seen = new Set()
        const places = (steps ?? []).flatMap((s) => s.pins ?? []).filter((p) => !seen.has(p.name) && seen.add(p.name)).slice(0, 20)
        if (places.length) {
          const a = (steps ?? []).find((s) => s.pins?.length)?.args ?? {}
          const where = a.place_name || a.near || a.stop_name || a.keyword
          entry = { ...base, kind: 'places', title: where ? `${where} 주변 장소` : `${text.slice(0, 18)} 관련 장소`, places }
        }
      }
      if (entry) {
        const list = [entry, ...get().routeHistory].slice(0, ROUTE_HISTORY_MAX)
        set({ routeHistory: list })
        saveRouteHistory(list)
      }
      if (supabase && get().user) { // 로그인했으면 대화 기록 저장 (실패해도 화면에는 영향 없음)
        const tools = (steps ?? []).map(({ result: _r, pins: _p, ...s }) => s) // 도구 결과 미리보기·핀은 저장하지 않는다
        supabase.from('chat_logs').insert({ question: text, answer, tools }).then(() => {})
      }
    } catch (e) {
      get().toast(e.message, 'danger')
    } finally {
      set({ chatLoading: false })
    }
  },
  clearChat: () => set({ messages: [] }),
}))
