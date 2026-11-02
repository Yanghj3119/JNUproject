import Anthropic from '@anthropic-ai/sdk'
import { tools, runTool } from '../server/tools.js'

const MODEL = 'claude-sonnet-5-5'

const SYSTEM = `너는 제주를 처음 여행하는 관광객을 돕는 여행 가이드 에이전트 "제주픽 AI"다.
- 사진·장소·날씨·혼잡도·접근성 정보는 반드시 도구로 확인한 뒤 답한다.
- 도구 결과에 없는 장소나 수치는 지어내지 않는다. 도구가 실패하면 솔직히 말한다.
- 비가 오거나 강수확률이 높으면 실내 대안을 함께 제안한다.
- 코스·일정·동선 요청에는 장소를 도구로 확인한 뒤 가까운 순서로 3~6곳을 묶어 propose_route 를 호출한다. 호출한 뒤에는 코스가 화면에 표시되므로 장소별 설명을 반복하지 말고 핵심 팁만 짧게 말한다.
- 한적한 날이 궁금하면 혼잡도 도구를 쓴다. 해수욕장 수질처럼 도구에 없는 정보는 모른다고 말한다.
- 언어 규칙: 사용자가 영어·중국어·일본어로 물으면 같은 언어로 답하고, 그 외에는 한국어로 답한다. 한 대화에서 사용자가 언어를 바꾸면 바뀐 언어를 따른다.
  · 도구를 호출할 때 장소 이름과 검색어는 항상 한국어로 넣는다 (예: "Seongsan Ilchulbong" 이라고 물어도 도구에는 "성산일출봉").
  · 답변에서 장소 이름은 질문 언어 표기 뒤에 한국어 원문을 괄호로 병기한다 (예: Seongsan Ilchulbong (성산일출봉)). 지도·버스 정류소 검색에는 한국어 원문이 필요하기 때문이다.
  · propose_route 의 stops.name 은 반드시 도구로 확인한 한국어 실제 이름으로 넣고, title 과 note 는 사용자의 언어로 쓴다.
  · 버스 노선 번호, 시각, 기온 같은 숫자는 그대로 쓴다.
- 답은 정중하고 간결하게, 6문장 이내로. 이모지는 쓰지 않는다.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 가 없어요 (.env.local)' })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { message, history = [] } = req.body ?? {}
  if (!message) return res.status(400).json({ error: 'message 가 필요해요' })

  const messages = [...history.slice(-10), { role: 'user', content: message }] // 최근 10개만 보내 비용 절약
  const steps = [] // 화면에 "AI가 호출한 도구"를 보여주기 위한 기록
  let route = null // propose_route 결과 — 화면에 코스로 표시

  try {
    // 에이전트 루프: 생각 → 도구 호출 → 결과 확인 → (반복) → 최종 답
    for (let turn = 0; turn < 8; turn++) {
      const r = await client.messages.create({ model: MODEL, max_tokens: 1200, system: SYSTEM, tools, messages })

      if (r.stop_reason !== 'tool_use') {
        const answer = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
        return res.status(200).json({ answer, steps, route })
      }

      messages.push({ role: 'assistant', content: r.content })
      const results = []
      for (const block of r.content) {
        if (block.type !== 'tool_use') continue
        let result
        try { result = await runTool[block.name](block.input ?? {}) } catch (e) { result = { error: e.message } }

        let forModel = result
        if (block.name === 'propose_route' && result?.stops) {
          route = result
          forModel = { ...result, stops: result.stops.map(({ image: _image, ...s }) => s) } // 이미지 URL 은 모델에 보내지 않음
        }
        steps.push({
          tool: block.name, args: block.input,
          count: Array.isArray(result) ? result.length : result?.stops?.length,
          error: result?.error,
        })
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(forModel) })
      }
      messages.push({ role: 'user', content: results })
    }
    res.status(200).json({ answer: '도구 호출이 너무 많아 중단했어요. 질문을 좁혀 주세요.', steps, route })
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.status === 429 ? '사용량이 많아요. 1분 뒤 다시 시도하세요.' : e.message })
  }
}
