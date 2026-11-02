// 함수 인스턴스 메모리 캐시 — 같은 데이터를 AI 가 도구를 부를 때마다 다시 받지 않도록 한다.
// 같은 키의 요청이 동시에 오면 한 번만 실행하고, 실패하면 캐시에 남기지 않는다. 결과가 null 이면 1분만 보관한다.
const store = new Map()

export function cached(key, ttlMs, fn) {
  const hit = store.get(key)
  if (hit && hit.exp > Date.now()) return hit.p

  const entry = { exp: Date.now() + ttlMs }
  entry.p = fn().then(
    (v) => { if (v == null) entry.exp = Date.now() + 60_000; return v },
    (e) => { if (store.get(key) === entry) store.delete(key); throw e },
  )
  store.set(key, entry)

  if (store.size > 500) for (const [k, v] of store) if (v.exp < Date.now()) store.delete(k)
  return entry.p
}
