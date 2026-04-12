import React, { useState, useRef, useEffect } from 'react'
import { generateImage, GEMINI_PRIMARY_CODENAME } from '../../utils/generateImage'
import DetailPanel from '../DetailPanel/DetailPanel'

const RATIOS = ['1:1', '16:9', '9:16', '4:3']
const STYLES = [
  { value: 'anime',      label: '애니메이션' },
  { value: 'realistic',  label: '실사/사진' },
  { value: 'watercolor', label: '수채화' },
  { value: 'ink',        label: '먹선/수묵' },
  { value: 'webtoon',    label: '웹툰' },
]

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-muted, #6a7f96)', marginBottom: 8 }}>
      {children}
    </p>
  )
}

// ── localStorage 키 ────────────────────────────────────────────────
const LS_LAST    = 'irir4r_last_image'
const LS_HISTORY = 'irir4r_image_history'
const HISTORY_MAX = 5

// ── localStorage 저장 헬퍼 (용량 초과 시 히스토리 축소) ─────────────
function persistImages(lastImage, history) {
  // 용량 초과 시 히스토리를 줄여가며 재시도
  const trySet = (hist) => {
    try {
      localStorage.setItem(LS_LAST, lastImage)
      localStorage.setItem(LS_HISTORY, JSON.stringify(hist))
      console.log('[ImageLab] ✅ localStorage 저장 완료 — 히스토리:', hist.length, '개')
      return true
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) return false
      console.warn('[ImageLab] localStorage 저장 오류:', e.message)
      return false
    }
  }

  // 최대 → 0개까지 단계적 축소
  for (let limit = history.length; limit >= 0; limit--) {
    if (trySet(history.slice(0, limit))) return
  }
  console.warn('[ImageLab] localStorage 용량 부족 — 이미지 저장 불가')
}

// ── localStorage 히스토리 로드 헬퍼 ──────────────────────────────────
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]')
  } catch {
    return []
  }
}

// ═══════════════════════════════════════════════════════════════════
export default function ImageLab({ apiKeyOpenAI = '', apiKeyGemini = '' }) {
  const [prompt,       setPrompt]       = useState('')
  const [ratio,        setRatio]        = useState('1:1')
  const [style,        setStyle]        = useState('')
  const [extraRequest, setExtraRequest] = useState('')
  const [refImage,     setRefImage]     = useState(null)

  // ── provider 선택 ──────────────────────────────────────────────
  const [provider, setProvider] = useState('openai')

  // ── 이미지 상태 (localStorage에서 초기값 로드) ─────────────────
  const [result,     setResult]     = useState(() => localStorage.getItem(LS_LAST) || null)
  const [history,    setHistory]    = useState(() => loadHistory())   // 생성 히스토리
  const [status,     setStatus]     = useState(() => localStorage.getItem(LS_LAST) ? 'done' : 'idle')
  const [errMsg,     setErrMsg]     = useState('')
  const [detailOpen, setDetailOpen] = useState(false)

  // ── provider별 상태 문구 ──────────────────────────────────────
  const genLabel = provider === 'gemini' ? `${GEMINI_PRIMARY_CODENAME} 생성 중…` : '이미지 생성 중…'
  const doneLabel = provider === 'gemini' ? `${GEMINI_PRIMARY_CODENAME} 생성 성공` : '생성 완료'
  const modelErrLabel = provider === 'gemini' ? `${GEMINI_PRIMARY_CODENAME} 모델 오류` : '생성 실패'

  const fileRef = useRef(null)
  const isGenerating = status === 'generating'

  // ── 현재 provider에 맞는 API 키 ──────────────────────────────
  const activeKey = provider === 'gemini' ? apiKeyGemini : apiKeyOpenAI

  // ── result 변경 감지 로그 ──────────────────────────────────────
  useEffect(() => {
    if (result) {
      console.log('[ImageLab] ✅ result 변경 — 타입:', result.startsWith('data:') ? 'dataUrl' : 'url', '/ 길이:', result.length)
    }
  }, [result])

  // ── 프롬프트 조합 ─────────────────────────────────────────────
  const buildFinalPrompt = () => {
    const parts = []
    if (prompt.trim())       parts.push(prompt.trim())
    if (style)               parts.push(`${style} style`)
    if (extraRequest.trim()) parts.push(extraRequest.trim())
    parts.push(`aspect ratio ${ratio}`)
    return parts.join(', ')
  }

  // ── 이미지 생성 ───────────────────────────────────────────────
  const handleGenerate = async () => {
    console.log('[ImageLab] ▶ 생성 버튼 클릭 — provider:', provider, '/ key 있음:', !!activeKey)

    if (isGenerating) return

    const p = buildFinalPrompt()
    if (!p.trim() || p === `aspect ratio ${ratio}`) {
      console.log('[ImageLab] 프롬프트 없음 — 중단')
      return
    }

    console.log('[ImageLab] API 요청 시작 — prompt:', p.slice(0, 100))
    setStatus('generating')
    setErrMsg('')

    try {
      const dataUrl = await generateImage(p, activeKey, prompt.slice(0, 12) || 'image', provider)

      console.log('[ImageLab] 응답 수신 — 시작:', dataUrl?.slice(0, 80), '/ 길이:', dataUrl?.length)

      if (!dataUrl) throw new Error('실제 이미지 응답을 받지 못했습니다')

      // ── 히스토리 업데이트 (현재 result → 히스토리 앞에 추가) ──
      const newHistory = result
        ? [result, ...history].slice(0, HISTORY_MAX)
        : history.slice(0, HISTORY_MAX)

      // ── state 업데이트 ────────────────────────────────────────
      setResult(dataUrl)
      setHistory(newHistory)
      setStatus('done')

      // ── localStorage 저장 (성공 시에만) ──────────────────────
      persistImages(dataUrl, newHistory)

    } catch (e) {
      console.error('[ImageLab] ❌ 생성 실패:', e.message)
      setErrMsg(e.message ?? '알 수 없는 오류')
      setStatus('failed')
    }
  }

  // ── 히스토리에서 이미지 선택 ─────────────────────────────────
  const selectFromHistory = (src) => {
    // 현재 result를 히스토리로, 선택한 것을 result로
    if (result && result !== src) {
      const newHistory = [result, ...history.filter(h => h !== src)].slice(0, HISTORY_MAX)
      setHistory(newHistory)
      persistImages(src, newHistory)
    }
    setResult(src)
    setStatus('done')
  }

  // ── 전체 초기화 ──────────────────────────────────────────────
  const handleReset = () => {
    setResult(null)
    setHistory([])
    setStatus('idle')
    setErrMsg('')
    localStorage.removeItem(LS_LAST)
    localStorage.removeItem(LS_HISTORY)
  }

  const handleRefFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setRefImage(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleDropRef = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => setRefImage(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  // ── 이미지 다운로드 ──────────────────────────────────────────
  const downloadImage = async (src, index = '') => {
    const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const suffix = index !== '' ? `_${String(index + 1).padStart(2, '0')}` : ''
    const filename = `irir4r_result${suffix}_${ts}.png`
    try {
      if (src.startsWith('data:')) {
        const a = document.createElement('a')
        a.href = src
        a.download = filename
        a.click()
      } else {
        const res = await fetch(src)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      console.log('[ImageLab] ✅ 다운로드 —', filename)
    } catch (e) {
      console.error('[ImageLab] ❌ 다운로드 실패:', e.message)
    }
  }

  // DetailPanel 리터칭 콜백 — 새 이미지를 result로 설정
  const handleNewVersion = (src) => {
    const newHistory = result
      ? [result, ...history].slice(0, HISTORY_MAX)
      : history.slice(0, HISTORY_MAX)
    setHistory(newHistory)
    setResult(src)
    setStatus('done')
    persistImages(src, newHistory)
  }

  // ── 공통 인라인 스타일 토큰 ───────────────────────────────────
  // ── 칸 구분 border 색 (1px보다 선명한 커스텀 값) ─────────────
  const BORDER_COL   = '#253d54'   // 칸 사이 구분선
  const BORDER_PANEL = '#2a4260'   // 패널 헤더 하단선
  const BORDER_BOX   = '#223348'   // 내부 섹션 박스 테두리

  const S = {
    panel: {
      display: 'flex', flexDirection: 'column',
      borderRight: `2px solid ${BORDER_COL}`,   // ← 1px → 2px, 더 선명한 색
      background: '#0d1b28',                     // ← 약간 더 어둡게 구분
      overflow: 'hidden',
    },
    panelHeader: {
      flexShrink: 0, padding: '18px 24px 14px',
      borderBottom: `2px solid ${BORDER_PANEL}`,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
      textTransform: 'uppercase', color: '#8aaabf',
    },
    // 내부 섹션 박스 (칸 2에서 사용)
    sectionBox: {
      border: `1px solid ${BORDER_BOX}`,
      borderRadius: 14,
      background: '#0a1722',
      overflow: 'hidden',
    },
    sectionBoxHeader: {
      padding: '12px 16px',
      borderBottom: `1px solid ${BORDER_BOX}`,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
      textTransform: 'uppercase', color: '#6a8ca8',
    },
    sectionBoxBody: {
      padding: '14px 16px',
    },
    input: {
      background: '#111f2e',
      border: `1px solid ${BORDER_BOX}`,
      borderRadius: 10, padding: '12px 14px',
      fontSize: 13, color: '#fff', resize: 'none', outline: 'none',
      lineHeight: 1.6, fontFamily: 'monospace',
      width: '100%', boxSizing: 'border-box',
    },
    btnPrimary: {
      width: '100%', padding: '12px 0', borderRadius: 12,
      fontSize: 14, fontWeight: 600, letterSpacing: '0.04em',
      background: 'var(--color-accent, #7c6af7)', color: '#fff',
      border: 'none', cursor: 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    btnDisabled: {
      width: '100%', padding: '12px 0', borderRadius: 12,
      fontSize: 14, fontWeight: 600,
      background: 'transparent', color: 'var(--color-muted, #6a7f96)',
      border: `1px solid ${BORDER_BOX}`, cursor: 'not-allowed',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
  }

  // ══════════════════════════════════════════════════════════════
  return (
    // 전체 3열 grid — grid-template-rows: 1fr 으로 단일 행이 전체 높이 채움
    <div style={{
      flex: 1, minHeight: 0,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.2fr) minmax(0, 1.8fr)',
      gridTemplateRows: '1fr',
    }}>

      {/* ═══════════════════════════════════════════════════════
          칸 1 — 프롬프트 + 생성 버튼 + 원본 업로드
      ═══════════════════════════════════════════════════════ */}
      <div style={S.panel}>
        <div style={S.panelHeader}>새 이미지 만들기</div>

        {/* ── Provider 선택 + 연결 상태 ── */}
        <div style={{ flexShrink: 0, padding: '14px 24px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* 선택 버튼 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { id: 'openai', label: 'OpenAI',  sublabel: 'DALL-E 3',             key: apiKeyOpenAI, dot: '#5cba80' },
              { id: 'gemini', label: 'Gemini',  sublabel: GEMINI_PRIMARY_CODENAME, key: apiKeyGemini, dot: '#5ab4e8' },
            ].map((p) => {
              const active = provider === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  style={{
                    padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${active ? (p.id === 'openai' ? 'rgba(92,186,128,0.5)' : 'rgba(90,180,232,0.5)') : 'var(--color-border,#1e2d3d)'}`,
                    background: active ? (p.id === 'openai' ? 'rgba(92,186,128,0.08)' : 'rgba(90,180,232,0.08)') : 'transparent',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                    transition: 'all 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.key ? p.dot : '#3a4f62' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#fff' : 'var(--color-muted,#6a7f96)' }}>
                      {p.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 9, letterSpacing: '0.06em', color: p.key ? p.dot : 'var(--color-muted,#6a7f96)', fontFamily: 'monospace' }}>
                    {p.key ? '연결됨 ✓' : '키 없음'} · {p.sublabel}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 선택된 provider의 키 없을 때 안내 */}
          {!activeKey && (
            <p style={{ fontSize: 10, color: '#e87c5a', fontFamily: 'monospace', lineHeight: 1.5 }}>
              ⚠ {provider === 'openai' ? 'OpenAI' : 'Gemini'} 키 미설정 — 테스트 모드로 실행
            </p>
          )}
        </div>

        {/* 프롬프트 영역 — flex-1 로 공간 채움 */}
        <div style={{ flex: 1, padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <SectionLabel>프롬프트</SectionLabel>
          <textarea
            style={{ ...S.input, flex: 1, minHeight: 120 }}
            placeholder={`cinematic portrait of a Korean woman,\nshort dark hair, navy suit,\nphotorealistic`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate() }}
            spellCheck={false}
          />

          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            style={(!prompt.trim() || isGenerating) ? S.btnDisabled : S.btnPrimary}
          >
            {isGenerating
              ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />생성 중…</>
              : '이미지 생성'}
          </button>
        </div>

        {/* 원본 이미지 업로드 */}
        <div style={{ flexShrink: 0, padding: '16px 24px 20px', borderTop: `2px solid ${BORDER_PANEL}`, marginTop: 16 }}>
          <SectionLabel>원본 이미지 (참조용)</SectionLabel>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropRef}
            style={{
              border: '1px dashed var(--color-border,#1e2d3d)', borderRadius: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: refImage ? 6 : '20px 0',
              marginTop: 10,
            }}
          >
            {refImage ? (
              <div style={{ position: 'relative', width: '100%' }}>
                <img src={refImage} alt="ref" style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 8 }} />
                <button
                  onClick={(e) => { e.stopPropagation(); setRefImage(null) }}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: 11, cursor: 'pointer' }}
                >✕</button>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: 'var(--color-muted,#6a7f96)', textAlign: 'center' }}>클릭 또는 드래그로 업로드</p>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleRefFile} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          칸 2 — 3개 독립 섹션 박스 + 실행 버튼
      ═══════════════════════════════════════════════════════ */}
      <div style={{ ...S.panel, background: '#0b1825' }}>
        <div style={S.panelHeader}>생성 옵션</div>

        {/* 스크롤 영역 — 3개 독립 박스 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── 박스 1: 화면 비율 ── */}
          <div style={S.sectionBox}>
            <div style={S.sectionBoxHeader}>화면 비율</div>
            <div style={{ ...S.sectionBoxBody, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {RATIOS.map((r) => {
                const active = ratio === r
                return (
                  <button key={r} onClick={() => setRatio(r)} style={{
                    padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    border: `1px solid ${active ? '#7c6af7' : BORDER_BOX}`,
                    background: active ? 'rgba(124,106,247,0.18)' : 'rgba(255,255,255,0.02)',
                    color: active ? '#fff' : '#6a8ca8',
                    transition: 'all 0.12s',
                  }}>
                    {r}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── 박스 2: 스타일 ── */}
          <div style={S.sectionBox}>
            <div style={S.sectionBoxHeader}>스타일</div>
            <div style={{ ...S.sectionBoxBody, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {STYLES.map((s) => {
                const active = style === s.value
                return (
                  <button key={s.value} onClick={() => setStyle(active ? '' : s.value)} style={{
                    padding: '10px 0', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    border: `1px solid ${active ? '#7c6af7' : BORDER_BOX}`,
                    background: active ? 'rgba(124,106,247,0.18)' : 'rgba(255,255,255,0.02)',
                    color: active ? '#fff' : '#6a8ca8',
                    transition: 'all 0.12s',
                  }}>
                    {s.label}
                  </button>
                )
              })}
            </div>
            {style && (
              <div style={{ padding: '0 16px 12px', fontSize: 10, fontFamily: 'monospace', color: '#7c6af7' }}>
                선택됨: {STYLES.find(s => s.value === style)?.label}
              </div>
            )}
          </div>

          {/* ── 박스 3: 추가 요청사항 ── */}
          <div style={{ ...S.sectionBox, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={S.sectionBoxHeader}>추가 요청사항</div>
            <div style={{ ...S.sectionBoxBody, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <textarea
                style={{
                  ...S.input,
                  flex: 1, minHeight: 90,
                  fontFamily: 'inherit', fontSize: 13,
                  background: 'transparent', border: 'none', padding: 0,
                  color: '#c8d8ea',
                }}
                placeholder="배경, 분위기, 표정 등 추가로 원하는 사항을 적어주세요."
                value={extraRequest}
                onChange={(e) => setExtraRequest(e.target.value)}
              />
            </div>
          </div>

        </div>

        {/* 실행 버튼 — 하단 고정 */}
        <div style={{
          flexShrink: 0, padding: '16px 20px 22px',
          borderTop: `2px solid ${BORDER_PANEL}`,
          background: '#0a1520',
        }}>
          {status !== 'idle' && (
            <p style={{
              textAlign: 'center', fontSize: 12, fontWeight: 500, marginBottom: 12,
              color: status === 'generating' ? '#7c6af7' : status === 'done' ? '#5cba80' : '#f87171',
            }}>
              {status === 'generating' ? genLabel
               : status === 'done' ? doneLabel
               : `오류: ${errMsg.slice(0, 50)}`}
            </p>
          )}
          <button
            onClick={handleGenerate}
            disabled={(!prompt.trim() && !extraRequest.trim()) || isGenerating}
            style={
              ((!prompt.trim() && !extraRequest.trim()) || isGenerating)
                ? { ...S.btnDisabled, padding: '14px 0' }
                : { ...S.btnPrimary, padding: '14px 0' }
            }
          >
            {isGenerating
              ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />생성 중…</>
              : '실행하기'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 10, color: '#4a6478', marginTop: 10 }}>Ctrl + Enter</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          칸 3 — 결과 전용
          overflow: hidden 제거, 이미지 영역은 flex: 1 + overflow: auto
      ═══════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', background: '#070e16', minHeight: 0 }}>

        {/* 헤더 */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 32px', borderBottom: `2px solid ${BORDER_PANEL}`,
          background: '#0d1b28',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-muted,#6a7f96)' }}>
            생성된 결과물
          </span>
          {result && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#5cba80', fontWeight: 500 }}>완료</span>
              <button onClick={() => setDetailOpen(true)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border,#1e2d3d)', background: 'transparent', color: 'var(--color-muted,#6a7f96)', cursor: 'pointer' }}>✦ 리터칭</button>
              <button onClick={handleReset} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border,#1e2d3d)', background: 'transparent', color: 'var(--color-muted,#6a7f96)', cursor: 'pointer' }}>초기화</button>
            </div>
          )}
        </div>

        {/* ── 디버그 패널 (개발 중에만 표시) ── */}
        <div style={{
          flexShrink: 0, padding: '6px 32px',
          borderBottom: '1px solid rgba(124,106,247,0.12)',
          background: 'rgba(124,106,247,0.05)',
          fontSize: 10, fontFamily: 'monospace', color: 'rgba(124,106,247,0.7)',
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          <span>provider: <strong>{provider}</strong></span>
          <span>key: <strong>{activeKey ? '있음' : '없음(테스트)'}</strong></span>
          <span>status: <strong>{status}</strong></span>
          <span>result: <strong>{result ? `SET (${result.slice(0, 28)}...)` : 'null'}</strong></span>
          <span>history: <strong>{history.length}/{HISTORY_MAX}</strong></span>
          {errMsg && <span style={{ color: '#f87171' }}>err: {errMsg.slice(0, 40)}</span>}
        </div>

        {/* ── 이미지 표시 영역 ── */}
        <div style={{
          flex: 1, overflow: 'auto',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 40,
          gap: 20,
        }}>

          {/* 결과 이미지 */}
          {result && (
            <>
              <img
                src={result}
                alt="generated result"
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(100vh - 280px)',
                  objectFit: 'contain',
                  borderRadius: 16,
                  border: '1px solid var(--color-border,#1e2d3d)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  display: 'block',
                }}
                onClick={() => setDetailOpen(true)}
                onLoad={() => console.log('[ImageLab] ✅ <img> onLoad 성공')}
                onError={(e) => console.error('[ImageLab] ❌ <img> onError — src 시작:', result?.slice(0, 80))}
                title="클릭하여 리터칭"
              />

              {/* 하단 액션 영역 — 상태 배지 + 다운로드 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {/* 연결 상태 배지 */}
                <span style={{
                  fontSize: 10, fontFamily: 'monospace', padding: '4px 10px', borderRadius: 6,
                  border: `1px solid ${activeKey ? (provider === 'openai' ? 'rgba(92,186,128,0.3)' : 'rgba(90,180,232,0.3)') : 'var(--color-border,#1e2d3d)'}`,
                  background: activeKey ? (provider === 'openai' ? 'rgba(92,186,128,0.07)' : 'rgba(90,180,232,0.07)') : 'var(--color-surface-3,#1a2635)',
                  color: activeKey ? (provider === 'openai' ? '#5cba80' : '#5ab4e8') : 'var(--color-muted,#6a7f96)',
                }}>
                  {activeKey
                    ? (provider === 'openai'
                       ? 'OpenAI 연결됨 · DALL-E 3'
                       : `Gemini 연결됨 · ${GEMINI_PRIMARY_CODENAME}`)
                    : `테스트 모드 · ${provider === 'openai' ? 'OpenAI' : 'Gemini'} 키 없음`}
                </span>

                {/* 다운로드 버튼 */}
                <button
                  onClick={() => downloadImage(result)}
                  title="이미지 저장"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid rgba(124,106,247,0.4)',
                    background: 'rgba(124,106,247,0.10)',
                    color: '#a89cf7', fontSize: 12, fontWeight: 600,
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,106,247,0.22)'; e.currentTarget.style.borderColor = 'rgba(124,106,247,0.7)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124,106,247,0.10)'; e.currentTarget.style.borderColor = 'rgba(124,106,247,0.4)' }}
                >
                  ↓ 이미지 저장
                </button>
              </div>

              {/* 히스토리 썸네일 */}
              {history.length > 0 && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-muted,#6a7f96)', textAlign: 'center' }}>
                    이전 생성 ({history.length}/{HISTORY_MAX})
                  </p>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', justifyContent: 'center', paddingBottom: 4 }}>
                    {history.map((v, i) => (
                      <div
                        key={i}
                        style={{ flexShrink: 0, position: 'relative', width: 64, height: 64 }}
                        onMouseEnter={(e) => {
                          e.currentTarget.querySelector('.thumb-btn').style.borderColor = '#7c6af7'
                          e.currentTarget.querySelector('.dl-btn').style.opacity = '1'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.querySelector('.thumb-btn').style.borderColor = 'var(--color-border,#1e2d3d)'
                          e.currentTarget.querySelector('.dl-btn').style.opacity = '0'
                        }}
                      >
                        <button
                          className="thumb-btn"
                          onClick={() => selectFromHistory(v)}
                          title={`이전 이미지 ${i + 1} — 클릭하여 불러오기`}
                          style={{
                            width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden',
                            border: '2px solid var(--color-border,#1e2d3d)', cursor: 'pointer', padding: 0,
                            transition: 'border-color 0.12s', display: 'block',
                          }}
                        >
                          <img src={v} alt={`history-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </button>
                        {/* hover 시 나타나는 다운로드 버튼 */}
                        <button
                          className="dl-btn"
                          onClick={(e) => { e.stopPropagation(); downloadImage(v, i) }}
                          title="이 이미지 저장"
                          style={{
                            position: 'absolute', bottom: 3, right: 3,
                            width: 20, height: 20, borderRadius: 4,
                            background: 'rgba(10,18,28,0.85)', border: '1px solid rgba(124,106,247,0.5)',
                            color: '#a89cf7', fontSize: 11, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0, transition: 'opacity 0.12s',
                            padding: 0, lineHeight: 1,
                          }}
                        >↓</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 플레이스홀더 — result 없을 때만 */}
          {!result && (
            <div style={{
              width: '100%', maxWidth: 480, aspectRatio: '1/1',
              border: '1px solid var(--color-border,#1e2d3d)',
              borderRadius: 4,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              userSelect: 'none',
            }}>
              {/* 십자선 */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.04)' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'rgba(255,255,255,0.04)' }} />
              </div>

              {isGenerating ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, zIndex: 1 }}>
                  <div style={{ width: 48, height: 48, border: '2px solid rgba(124,106,247,0.25)', borderTop: '2px solid #7c6af7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: 14, color: '#7c6af7', fontWeight: 500 }}>{genLabel}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 1 }}>
                  <span style={{ fontSize: 28, opacity: 0.15 }}>✦</span>
                  <p style={{ fontSize: 13, color: 'var(--color-muted,#6a7f96)', textAlign: 'center', lineHeight: 1.6 }}>
                    생성된 이미지가 여기에 표시됩니다
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 스피너 keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 리터칭 패널 */}
      {detailOpen && result && (
        <DetailPanel
          image={result}
          versions={history}
          charName=""
          apiKey={activeKey}
          provider={provider}
          onNewImage={handleNewVersion}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </div>
  )
}
