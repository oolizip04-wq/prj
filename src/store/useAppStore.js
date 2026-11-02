import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { post } from '../api/client'

// 앱 전체가 공유하는 상태. 한 페이지에서만 쓰면 useState, 여러 페이지가 쓰면 여기.
// 사용: const user = useAppStore((s) => s.user)

// Supabase 인증 오류를 한국어로
export function authMessage(error) {
  const m = String(error?.message || error || '')
  if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요'
  if (/already registered/i.test(m)) return '이미 가입된 이메일이에요'
  if (/Email not confirmed/i.test(m)) return '이메일 확인이 필요해요. 받은 메일의 링크를 눌러 주세요'
  if (/at least|weak|short/i.test(m)) return '비밀번호는 6자 이상이어야 해요'
  if (/valid email|invalid.*email/i.test(m)) return '이메일 형식을 확인해 주세요'
  if (/rate limit|too many|seconds/i.test(m)) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요'
  return m || '요청에 실패했어요'
}

export const useAppStore = create((set, get) => ({
  // ── 알림(토스트) ──
  toasts: [],
  toast: (message, variant = 'success') => {
    const id = Date.now() + Math.random()
    set({ toasts: [...get().toasts, { id, message, variant }] })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2500)
  },

  // ── 로그인 (Supabase Auth, 이메일+비밀번호) ──
  user: null,
  authReady: false,   // 저장된 로그인 확인이 끝났는지
  initAuth: async () => {
    if (!supabase) return set({ authReady: true })
    const { data } = await supabase.auth.getSession()   // 메일 확인 링크로 돌아온 경우(#access_token)도 여기서 처리됨
    set({ user: data.session?.user ?? null, authReady: true })
    if (data.session) get().loadFavorites()
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      if (user?.id !== get().user?.id) {
        set({ user, favorites: [] })
        if (user) get().loadFavorites()
      }
    })
  },
  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(authMessage(error))
  },
  signUp: async (email, password, nickname) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nickname }, emailRedirectTo: `${location.origin}/map` } })
    if (error) throw new Error(authMessage(error))
    return { needsConfirm: !data.session }   // 메일 확인을 켜 둔 경우 세션이 바로 안 생김
  },
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, favorites: [], route: null })
  },

  // ── 즐겨찾기: 로그인한 사용자의 것만 (Supabase RLS 가 걸러 줌). 주차장 객체 목록 ──
  favorites: [],
  favLoading: false,
  isFav: (id) => get().favorites.some((f) => f.id === id),
  loadFavorites: async () => {
    if (!supabase || !get().user) return
    set({ favLoading: true })
    const { data, error } = await supabase.from('favorites').select('item_id,title,data').order('created_at', { ascending: false })
    set({ favLoading: false })
    if (error) return get().toast(error.message, 'danger')
    set({ favorites: data.map((x) => (x.data?.lat ? x.data : { id: x.item_id, name: x.title })) })
  },
  addFavorite: async (p) => {
    const { user } = get()
    if (!supabase || !user) return get().toast('로그인이 필요해요', 'warning')
    set({ favorites: [p, ...get().favorites] })   // 먼저 화면에 반영(낙관적), 실패하면 되돌림
    const { error } = await supabase.from('favorites').insert({ source: 'parking', item_id: p.id, title: p.name, data: p, user_id: user.id, nickname: user.user_metadata?.nickname || '익명' })
    if (error && error.code !== '23505') {
      set({ favorites: get().favorites.filter((f) => f.id !== p.id) })
      get().toast('즐겨찾기 저장 실패: ' + error.message, 'danger')
    }
  },
  removeFavorite: async (id) => {
    const { user, favorites } = get()
    if (!supabase || !user) return
    set({ favorites: favorites.filter((f) => f.id !== id) })
    const { error } = await supabase.from('favorites').delete().eq('item_id', id).eq('user_id', user.id)
    if (error) { set({ favorites }); get().toast('삭제 실패: ' + error.message, 'danger') }
  },

  clearFavorites: async () => {
    const { user, favorites } = get()
    if (!supabase || !user || !favorites.length) return
    if (!window.confirm(`즐겨찾기 ${favorites.length}곳을 모두 비울까요?`)) return
    set({ favorites: [] })
    const { error } = await supabase.from('favorites').delete().eq('user_id', user.id)
    if (error) { set({ favorites }); get().toast('삭제 실패: ' + error.message, 'danger') }
  },

  // ── 내 위치 · 길찾기 ──
  userLoc: null,   // { lat, lng, label }
  setUserLoc: (userLoc) => set({ userLoc }),
  route: null,     // { route:{coords,minutes,km}, places:[...], title, dest }
  setRoute: (route) => set({ route }),
  findRoute: async (p) => {
    const { userLoc } = get()
    if (!userLoc) return get().toast('출발지가 없어요. "내 위치" 버튼이나 지도 오른쪽 클릭으로 정해 주세요', 'warning')
    set({ route: { loading: true, dest: p } })
    try {
      const j = await post('/api/route', { fromLat: userLoc.lat, fromLng: userLoc.lng, toLat: p.lat, toLng: p.lng })
      set({ route: { ...j, title: `${userLoc.label} → ${p.name}`, dest: p } })
    } catch (e) {
      set({ route: { error: e.message, dest: p } })
    }
  },

  // ── AI 에이전트 대화 ──
  chat: [],          // { role:'user'|'assistant', content, steps?, model? }
  chatBusy: false,
  focus: null,       // AI 가 찾아 준 주차장들 (지도에 강조)
  askAgent: async (text) => {
    const { chat, userLoc } = get()
    set({ chat: [...chat, { role: 'user', content: text }], chatBusy: true, route: null, focus: null })   // 새 검색 → 이전 길찾기·검색 결과 초기화
    try {
      const history = chat.slice(-10).map(({ role, content }) => ({ role, content }))
      const j = await post('/api/agent', { message: text, history, userLoc: userLoc && { lat: userLoc.lat, lng: userLoc.lng } })
      set({
        chat: [...get().chat, { role: 'assistant', content: j.answer.replaceAll('**', ''), steps: j.steps, model: j.model, fallback: j.fallback }],
        focus: j.results?.length ? j.results : null,
        route: j.route ? { route: j.route, places: j.places, title: 'AI 추천 경로', dest: null } : get().route,
      })
    } catch (e) {
      set({ chat: [...get().chat, { role: 'assistant', content: 'AI 검색 실패: ' + e.message, error: true }] })
    } finally { set({ chatBusy: false }) }
  },
  clearFocus: () => set({ focus: null }),
}))
