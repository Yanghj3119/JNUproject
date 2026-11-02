import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { askAgent } from '../api/client'

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
  // 카카오 로그인 — Supabase 의 Kakao provider 로 이동 → 카카오 로그인 → /my 로 돌아옴
  signInKakao: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/my` },
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
    const existing = get().favorites.find((f) => f.source === source && f.item_id === String(id))
    if (existing) {
      const { error } = await supabase.from('favorites').delete().eq('id', existing.id)
      if (error) return get().toast(error.message, 'danger')
      set({ favorites: get().favorites.filter((f) => f.id !== existing.id) })
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
  sendMessage: async (text) => {
    const history = get().messages.map((m) => ({ role: m.role, content: m.text }))
    set({ messages: [...get().messages, { role: 'user', text }], chatLoading: true })
    try {
      const { answer, steps, route } = await askAgent(text, history)
      set({ messages: [...get().messages, { role: 'assistant', text: answer, steps, route }] })
      if (supabase && get().user) { // 로그인했으면 대화 기록 저장 (실패해도 화면에는 영향 없음)
        supabase.from('chat_logs').insert({ question: text, answer, tools: steps }).then(() => {})
      }
    } catch (e) {
      get().toast(e.message, 'danger')
    } finally {
      set({ chatLoading: false })
    }
  },
  clearChat: () => set({ messages: [] }),
}))
