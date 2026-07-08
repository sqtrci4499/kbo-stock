/**
 * KBO STOCK v10 - 담당자 코멘트 + AI 데이터 분석 결합
 *
 * 관리자가 쓴 짧은 야구 코멘트(주관적, 자유 형식)와, aiPrediction.ts가 계산한
 * 데이터 기반 자동 분석(순위/승률/연승연패/게임차/주가변화)을 Claude API로
 * 한 번 호출해서 자연스러운 2~3문장짜리 하나의 분석으로 합친다.
 *
 * [비용/안정성 설계]
 * - 담당자 코멘트가 없는 팀은 이 모듈을 아예 호출하지 않는다 (합칠 게 없으므로
 *   불필요한 API 호출을 하지 않음 — aiPrediction.ts 쪽에서 이미 필터링됨).
 * - API 키가 없거나 호출이 실패하면, 예외를 던지지 않고 null을 반환한다.
 *   호출부(aiPrediction.ts)는 null이면 담당자 코멘트+자동분석을 단순히
 *   이어붙인 텍스트로 대체해서 "완전히 안 보이는 것"은 방지한다.
 */

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"; // 짧은 합성 작업이라 저렴/빠른 모델 사용
const TIMEOUT_MS = 8_000;

export async function synthesizeTeamComment(params: {
  teamName: string;
  adminComment: string;
  autoComment: string;
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[aiSynthesis] ⚠️ ANTHROPIC_API_KEY 미설정 — 합성 없이 단순 결합으로 대체됩니다.");
    return null;
  }

  const prompt =
    `당신은 KBO 가상주식 서비스의 애널리스트입니다. 아래 두 정보를 하나의 자연스러운 한국어 분석으로 합쳐주세요.\n\n` +
    `[담당자가 직접 작성한 야구 코멘트]\n${params.adminComment}\n\n` +
    `[데이터 기반 자동 분석]\n${params.autoComment}\n\n` +
    `요구사항:\n` +
    `- 2~3문장, 총 150자 이내\n` +
    `- 두 정보를 단순 나열하지 말고 하나의 매끄러운 분석으로 재구성\n` +
    `- 팀명(${params.teamName})은 자연스러운 경우에만 언급, 과장/추천 문구(예: "무조건", "확실히") 금지\n` +
    `- 결과 텍스트만 출력 (따옴표, 설명, 접두사 없이)`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[aiSynthesis] ❌ API HTTP ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const text = data?.content?.find((c: any) => c.type === "text")?.text?.trim();
    return text || null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[aiSynthesis] ❌ 합성 실패: ${msg}`);
    return null;
  }
}
