import Anthropic from '@anthropic-ai/sdk'
import { tools, runTool } from '../server/tools.js'

const MODEL = process.env.AGENT_MODEL || 'claude-haiku-5-5' // 환경변수로 모델을 바꿀 수 있다 (예: claude-sonnet-5-5, claude-opus-5-5)

const SYSTEM = `너는 제주를 처음 여행하는 관광객을 돕는 여행 가이드 에이전트 "제주픽 AI"다.
- 사진·장소·날씨·혼잡도·접근성 정보는 반드시 도구로 확인한 뒤 답한다.
- 도구 결과에 없는 장소나 수치는 지어내지 않는다. 도구가 실패하면 솔직히 말한다.
- 비가 오거나 강수확률이 높으면 실내 대안을 함께 제안한다.
- 코스·일정·동선 요청에는 장소를 도구로 확인한 뒤 가까운 순서로 3~6곳을 묶어 propose_route 를 호출한다. 호출한 뒤에는 코스가 화면에 표시되므로 장소별 설명을 반복하지 말고 핵심 팁만 짧게 말한다.
- 위시리스트: 사용자가 담아 둔 장소 목록을 주면 그 장소들을 우선해서 한 코스(최대 8곳)에 모두 넣는다. 사진 제목처럼 보이는 이름("다랑쉬오름의 아침")은 도구로 실제 장소를 확인해 넣고, 위치를 못 찾으면 그 곳만 말로 안내한다. 목록에 없는 장소는 사용자가 원할 때만 덧붙인다.
- 위시리스트·여러 장소 요청: 장소 확인은 모든 장소를 첫 응답에서 한꺼번에(병렬로) 호출한다. 못 찾은 장소는 이름을 바꿔 다시 찾지 말고 곧바로 "찾지 못했다"고 말로 안내한 뒤, 찾은 장소들로 propose_route 를 호출해 코스를 끝낸다. 도구를 모두 쓰고도 코스 없이 끝내는 일이 없게 한다.
- 효율: 서로 독립적인 도구는 한 번의 응답에서 함께 호출한다. 코스 요청은 보통 장소 확인 → 날씨·교통 확인 → propose_route 의 3~4단계면 충분하다. 같은 도구를 같은 인자로 반복하지 않고, get_photo_info 는 촬영지가 꼭 필요할 때만 쓴다. 장소를 못 찾았다는 결과가 나오면 다른 이름으로 한 번만 다시 시도하고, 그래도 없으면 그 장소는 말로만 안내한다.
- 한적한 날이 궁금하면 혼잡도 도구를 쓴다. 해수욕장 수질처럼 도구에 없는 정보는 모른다고 말한다.
- 언어 규칙: 사용자가 영어·중국어·일본어로 물으면 같은 언어로 답하고, 그 외에는 한국어로 답한다. 한 대화에서 사용자가 언어를 바꾸면 바뀐 언어를 따른다.
  · 도구를 호출할 때 장소 이름과 검색어는 항상 한국어로 넣는다 (예: "Seongsan Ilchulbong" 이라고 물어도 도구에는 "성산일출봉").
  · 답변에서 장소 이름은 질문 언어 표기 뒤에 한국어 원문을 괄호로 병기한다 (예: Seongsan Ilchulbong (성산일출봉)). 지도·버스 정류소 검색에는 한국어 원문이 필요하기 때문이다.
  · propose_route 의 stops.name 은 반드시 도구로 확인한 한국어 실제 이름으로 넣고, title 과 note 는 사용자의 언어로 쓴다.
  · 버스 노선 번호, 시각, 기온 같은 숫자는 그대로 쓴다.
- 답은 정중하고 간결하게, 6문장 이내로. 이모지는 쓰지 않는다.`

// 화면에서 "AI가 호출한 도구"를 눌렀을 때 보여 줄 결과 미리보기 — 길이를 줄여서(최대 6건, 긴 글 자르기, 이미지 제외) 응답이 커지지 않게 한다
const SKIP = new Set(['image', 'images', 'thumbnail'])
function brief(v, depth = 0, maxItems = 6) {
  if (typeof v === 'string') return v.length > 140 ? `${v.slice(0, 140)}…` : v
  if (v == null || typeof v !== 'object') return v
  if (Array.isArray(v)) {
    const out = v.slice(0, maxItems).map((x) => brief(x, depth + 1, maxItems))
    if (v.length > maxItems) out.push(`… 외 ${v.length - maxItems}건`)
    return out
  }
  if (depth >= 3) return '…'
  return Object.fromEntries(Object.entries(v).filter(([k]) => !SKIP.has(k)).map(([k, x]) => [k, brief(x, depth + 1, maxItems)]))
}
const preview = (v) => {
  let b = brief(v)
  if (JSON.stringify(b).length > 3500) b = brief(v, 0, 3)
  return b
}

// 도구 결과에 좌표가 있는 장소(주변 명소·박물관·포토 스팟 등)는 화면 지도에 핀으로 보여 준다
const inJeju = (x) => Number(x.lat) > 33 && Number(x.lat) < 34 && Number(x.lng) > 126 && Number(x.lng) < 127.1
function pinsOf(result) {
  if (!Array.isArray(result)) return []
  return result.filter((x) => x && typeof x === 'object' && inJeju(x) && (x.title || x.name)).slice(0, 12).map((x) => ({
    name: x.title ?? x.name, lat: Number(x.lat), lng: Number(x.lng), addr: x.addr ?? '',
    dist: x.dist_m ?? (x.km_from_base != null ? Math.round(x.km_from_base * 1000) : undefined),
  }))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 가 없어요 (.env.local)' })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { message, history = [] } = req.body ?? {}
  if (!message) return res.status(400).json({ error: 'message 가 필요해요' })

  const messages = [...history.slice(-10), { role: 'user', content: message }] // 최근 10개만 보내 비용 절약
  const steps = [] // 화면에 "AI가 호출한 도구"를 보여주기 위한 기록
  let route = null // propose_route 결과 — 화면에 코스로 표시
  const seen = new Set() // 같은 도구를 같은 인자로 또 부르지 않게
  const MAX_TURNS = 8

  try {
    // 에이전트 루프: 생각 → 도구 호출 → 결과 확인 → (반복) → 최종 답
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // 마지막 차례에는 도구를 못 쓰게 해서, 도구만 부르다 답 없이 끝나는 일을 막는다
      const last = turn === MAX_TURNS - 1
      const r = await client.messages.create({ model: MODEL, max_tokens: 1200, system: SYSTEM, tools, ...(last ? { tool_choice: { type: 'none' } } : {}), messages })

      if (r.stop_reason !== 'tool_use') {
        const text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
        // 답 글자가 비어 있어도 화면이 비지 않게 한다
        const answer = text || (route ? '코스를 만들었어요. 아래 코스를 확인해 주세요.' : '답을 정리하지 못했어요. 위의 도구 결과를 참고하시거나 질문을 조금 바꿔 다시 물어봐 주세요.')
        return res.status(200).json({ answer, steps, route })
      }

      messages.push({ role: 'assistant', content: r.content })
      const results = []
      for (const block of r.content) {
        if (block.type !== 'tool_use') continue
        let result
        const key = `${block.name}:${JSON.stringify(block.input ?? {})}`
        if (seen.has(key)) result = { error: '같은 호출을 이미 했어요. 다른 방법을 쓰거나 지금까지의 결과로 답하세요.' }
        else {
          seen.add(key)
          try { result = await runTool[block.name](block.input ?? {}) } catch (e) { result = { error: e.message } }
        }

        let forModel = result
        if (block.name === 'propose_route' && result?.stops) {
          route = result
          forModel = { ...result, stops: result.stops.map(({ image: _image, ...s }) => s) } // 이미지 URL 은 모델에 보내지 않음
        }
        steps.push({
          tool: block.name, args: block.input,
          count: Array.isArray(result) ? result.length : result?.stops?.length,
          error: result?.error,
          result: preview(forModel),
          pins: pinsOf(result),
        })
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(forModel) })
      }
      // 남은 차례가 2번 이하면 더 찾지 말고 마무리하라고 알려 준다
      if (turn >= MAX_TURNS - 3) results.push({ type: 'text', text: route ? '코스를 이미 만들었으니 도구 없이 핵심 팁만 짧게 답하세요.' : '이제 도구를 더 쓰지 말고, 찾은 장소로 코스를 만들거나(propose_route) 못 찾은 곳은 말로 안내해 답을 마무리하세요.' })
      messages.push({ role: 'user', content: results })
    }
    res.status(200).json({ answer: '확인할 내용이 많아 여기까지만 정리했어요. 위의 호출 결과를 참고하거나, 장소를 나눠서 다시 물어봐 주세요.', steps, route })
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.status === 429 ? '사용량이 많아요. 1분 뒤 다시 시도하세요.' : e.message })
  }
}
