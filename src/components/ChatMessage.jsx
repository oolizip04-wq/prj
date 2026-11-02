// 에이전트 대화 한 줄 + "AI가 한 일"(도구 호출 로그, 접었다 펼침). 지도 화면과 AI 가이드 화면이 같이 씀
export const TOOL_LABEL = {
  find_place: '장소 찾기 · Nominatim',
  search_parking: '주차장 검색 · 공공데이터',
  get_travel_time: '이동 시간 · OSRM',
  get_route: '경로 · OSRM',
  find_along_route: '경로 주변 카페 · 상가정보',
}

export default function ChatMessage({ m, openLog = false }) {
  return (
    <div className={`msg ${m.role}${m.error ? ' error' : ''}`}>
      {m.content}
      {m.fallback && <div className="small text-warning-emphasis mt-1">⚠ {m.fallback}</div>}
      {m.steps && (
        <details className="mt-2 small text-muted" open={openLog}>
          <summary role="button">AI가 한 일 · 도구 {m.steps.length}번 호출 ({m.model})</summary>
          {m.steps.map((s, i) => (
            <div key={i} className={`ps-3 py-1 ${s.error ? 'text-danger' : ''}`} style={{ wordBreak: 'break-all' }}>
              {i + 1}. {TOOL_LABEL[s.tool] || s.tool}({Object.entries(s.args || {}).map(([k, v]) => `${k}=${v}`).join(', ')}) → {s.summary}
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
