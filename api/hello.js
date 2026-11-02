// 동작 확인용: /api/hello
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    time: new Date().toISOString(),
    keys: {
      dataGoKr: Boolean(process.env.DATA_GO_KR_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  })
}
