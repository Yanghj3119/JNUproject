import { supabase } from './supabase'

// 여행자 포토 스팟 (Supabase 테이블 user_spots + Storage 버킷 user-spots) — 설정 방법은 supabase/user_spots.sql
export const BUCKET = 'user-spots'
export const MAX_PER_USER = 5

const publicUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

// 테이블·버킷을 아직 만들지 않았을 때 알아보기 쉬운 안내로 바꾼다
const friendly = (e) => (/relation .*user_spots|schema cache|does not exist|Bucket not found/i.test(e?.message ?? '')
  ? new Error('아직 이 기능이 준비되지 않았어요 (Supabase 에 supabase/user_spots.sql 을 실행해야 해요)')
  : e)

export async function listSpots() {
  if (!supabase) return []
  const { data, error } = await supabase.from('user_spots').select('*').order('created_at', { ascending: false }).limit(60)
  if (error) throw friendly(error)
  return data.map((r) => ({ ...r, url: publicUrl(r.image_path) }))
}

export async function addSpot({ userId, blob, title, caption, placeName, lat, lng }) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (up.error) throw friendly(up.error)
  const { data, error } = await supabase.from('user_spots')
    .insert({ user_id: userId, title, caption: caption || null, place_name: placeName || null, lat, lng, image_path: path }).select().single()
  if (error) { // 행을 못 만들었으면 올린 파일도 지운다 (남는 파일 없게)
    await supabase.storage.from(BUCKET).remove([path])
    throw friendly(error)
  }
  return { ...data, url: publicUrl(path) }
}

// 사진 파일과 기록을 함께 완전히 삭제
export async function removeSpot(spot) {
  const rm = await supabase.storage.from(BUCKET).remove([spot.image_path])
  if (rm.error) throw friendly(rm.error)
  const { error } = await supabase.from('user_spots').delete().eq('id', spot.id)
  if (error) throw friendly(error)
}

export function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
