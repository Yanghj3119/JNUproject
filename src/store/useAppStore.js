import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { askAgent } from '../api/client'

// ── 앱 전체가 함께 쓰는 상태(store) ──────────────────────
// 사용법:  const nickname = useAppStore((s) => s.nickname)
export const useAppStore = create(
  persist(
    (set, get) => ({
      // ① 사용자 — localStorage 에 저장되어 새로고침해도 유지
      nickname: '',
      setNickname: (nickname) => set({ nickname: nickname.trim() }),

      // ② 알림(토스트)
      toasts: [],
      toast: (message, variant = 'success') => {
        const id = Date.now() + Math.random()
        set({ toasts: [...get().toasts, { id, message, variant }] })
        setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2500)
      },

      // ③ 보관함 — Supabase favorites 테이블과 동기화
      favorites: [],
      favLoading: false,
      loadFavorites: async () => {
        if (!supabase) return
        set({ favLoading: true })
        const { data, error } = await supabase
          .from('favorites').select('*')
          .eq('nickname', get().nickname || '익명')
          .order('created_at', { ascending: false })
        set({ favLoading: false })
        if (error) return get().toast(error.message, 'danger')
        set({ favorites: data })
      },
      isFav: (source, id) => get().favorites.some((f) => f.source === source && f.item_id === String(id)),
      toggleFavorite: async ({ source, id, title, image }) => {
        if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
        const existing = get().favorites.find((f) => f.source === source && f.item_id === String(id))
        if (existing) {
          const { error } = await supabase.from('favorites').delete().eq('id', existing.id)
          if (error) return get().toast(error.message, 'danger')
          set({ favorites: get().favorites.filter((f) => f.id !== existing.id) })
          return get().toast('보관함에서 뺐어요', 'secondary')
        }
        const row = { nickname: get().nickname || '익명', source, item_id: String(id), title, image: image || null }
        const { data, error } = await supabase.from('favorites').insert(row).select().single()
        if (error) return get().toast(error.message, 'danger')
        set({ favorites: [data, ...get().favorites] })
        get().toast('보관함에 담았어요')
      },

      // ④ AI 가이드 대화 — 페이지를 옮겨도 대화가 남도록 store 에 둠
      messages: [], // { role: 'user' | 'assistant', text, steps }
      chatLoading: false,
      sendMessage: async (text) => {
        const history = get().messages.map((m) => ({ role: m.role, content: m.text }))
        set({ messages: [...get().messages, { role: 'user', text }], chatLoading: true })
        try {
          const { answer, steps } = await askAgent(text, history)
          set({ messages: [...get().messages, { role: 'assistant', text: answer, steps }] })
          // 대화 기록 저장 (실패해도 화면에는 영향 없음)
          supabase?.from('chat_logs')
            .insert({ nickname: get().nickname || '익명', question: text, answer, tools: steps })
            .then(() => {})
        } catch (e) {
          get().toast(e.message, 'danger')
        } finally {
          set({ chatLoading: false })
        }
      },
      clearChat: () => set({ messages: [] }),
    }),
    {
      name: 'jeju-pick-store',
      partialize: (s) => ({ nickname: s.nickname }),
    },
  ),
)
