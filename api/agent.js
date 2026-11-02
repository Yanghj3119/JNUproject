import Anthropic from '@anthropic-ai/sdk'
import { tools, runTool } from '../server/tools.js'

const MODEL = 'claude-sonnet-5-5'

const SYSTEM = `너는 제주를 처음 여행하는 관광객을 돕는 여행 가이드 에이전트 "제주픽"이다.
- 사진·장소·날씨·접근성 정보는 반드시 도구로 확인한 뒤 답한다.
- 도구 결과에 없는 장소나 수치는 지어내지 않는다. 도구가 실패하면 솔직히 말한다.
- 비가 오거나 강수확률이 높으면 실내 대안을 함께 제안한다.
- 장소를 추천할 때는 가까운 순서로 동선을 짜 주고, 촬영월이 있으면 가기 좋은 시기도 알려 준다.
- 답은 한국어로, 친근하게, 6문장 이내로 짧게.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 가 없어요 (.env.local)' })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { message, history = [] } = req.body ?? {}
  if (!message) return res.status(400).json({ error: 'message 가 필요해요' })

  const messages = [...history.slice(-10), { role: 'user', content: message }] // 최근 10개만 보내 비용 절약
  const steps = [] // 화면에 "에이전트가 호출한 도구"를 보여주기 위한 기록

  try {
    // ③ 에이전트 루프: 생각 → 도구 호출 → 결과 확인 → (반복) → 최종 답
    for (let turn = 0; turn < 6; turn++) {
      const r = await client.messages.create({ model: MODEL, max_tokens: 1024, system: SYSTEM, tools, messages })

      if (r.stop_reason !== 'tool_use') {
        const answer = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
        return res.status(200).json({ answer, steps })
      }

      messages.push({ role: 'assistant', content: r.content })
      const results = []
      for (const block of r.content) {
        if (block.type !== 'tool_use') continue
        let result
        try { result = await runTool[block.name](block.input ?? {}) } catch (e) { result = { error: e.message } }
        steps.push({
          tool: block.name, args: block.input,
          count: Array.isArray(result) ? result.length : undefined,
          error: result?.error,
        })
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
      }
      messages.push({ role: 'user', content: results })
    }
    res.status(200).json({ answer: '도구 호출이 너무 많아 중단했어요. 질문을 좁혀 주세요.', steps })
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.status === 429 ? '사용량이 많아요. 1분 뒤 다시 시도하세요.' : e.message })
  }
}
