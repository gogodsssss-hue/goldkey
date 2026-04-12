import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useStore } from './store/useStore'
import { parseCharacters } from './components/ScriptPanel/ScriptParser'
import CharacterDetail from './components/CharacterDetail/CharacterDetail'
import CharacterGridCard from './components/CharacterGrid/CharacterGridCard'
import ImageLab from './components/ImageLab/ImageLab'
import { validateGeminiKey, validateOpenAIKey, debugGeminiImageGen, discoverGeminiImageModels } from './utils/generateImage'

const RATIOS = [
  { id: '1:1',  label: '정사각형 (1:1)' },
  { id: '16:9', label: '가로 (16:9)' },
  { id: '9:16', label: '세로 (9:16)' },
]

export default function App() {
  const characters       = useStore((s) => s.characters)
  const importCharacters = useStore((s) => s.importCharacters)
  const selectCharacter  = useStore((s) => s.selectCharacter)

  const [step,         setStep]         = useState(1)   // 1: 대본 입력, 2: 생성 결과
  const [intro,        setIntro]        = useState('')
  const [body,         setBody]         = useState('')
  const [ratio,        setRatio]        = useState('1:1')
  const [parseMsg,     setParseMsg]     = useState('')
  const [showCharEdit,  setShowCharEdit]  = useState(false) // 캐릭터 편집 드로어
  const [showResults,   setShowResults]   = useState(false) // Tab1 결과 섹션
  const resultsRef = useRef(null)
  const [showApiPanel,    setShowApiPanel]    = useState(false)

  // ── API 키 localStorage 키 이름 ──────────────────────────────
  const LS_GEMINI = 'gemini_api_key'
  const LS_OPENAI = 'openai_api_key'

  // ── Gemini state ──────────────────────────────────────────────
  const [geminiKeyInput, setGeminiKeyInput] = useState('')
  const [geminiKeySaved, setGeminiKeySaved] = useState(
    () => localStorage.getItem(LS_GEMINI) ?? ''
  )
  // null=미확인 | 'checking'=확인 중 | true=성공 | false=실패
  const [geminiStatus,  setGeminiStatus]  = useState(null)
  const [geminiErrMsg,  setGeminiErrMsg]  = useState('')
  // 실패 시 세부 타입: 'key' | 'permission' | 'config' | 'network'
  const [geminiErrType,  setGeminiErrType]  = useState(null)
  // 이미지 생성 디버그 결과
  const [geminiDebug,    setGeminiDebug]    = useState(null)   // null | 'running' | { [modelId]: result }
  // 모델 목록 조회 결과
  const [geminiDiscover, setGeminiDiscover] = useState(null)   // null | 'running' | { ok, all, imageModels }


  // ── OpenAI state ──────────────────────────────────────────────
  const [openaiKeyInput, setOpenaiKeyInput] = useState('')
  const [openaiKeySaved, setOpenaiKeySaved] = useState(
    () => localStorage.getItem(LS_OPENAI) ?? ''
  )
  const [openaiStatus,  setOpenaiStatus]  = useState(null)
  const [openaiErrMsg,  setOpenaiErrMsg]  = useState('')

  // ── 공통 저장 함수 ────────────────────────────────────────────
  const saveAllKeys = () => {
    let saved = false
    const gk = geminiKeyInput.trim()
    if (gk) {
      localStorage.setItem(LS_GEMINI, gk)
      setGeminiKeySaved(gk)
      setGeminiKeyInput('')
      setGeminiStatus(null)   // 새 키 → 미확인 리셋
      setGeminiErrMsg('')
      setGeminiErrType(null)
      saved = true
    }
    const ok = openaiKeyInput.trim()
    if (ok) {
      localStorage.setItem(LS_OPENAI, ok)
      setOpenaiKeySaved(ok)
      setOpenaiKeyInput('')
      setOpenaiStatus(null)
      setOpenaiErrMsg('')
      saved = true
    }
    return saved
  }

  // ── 개별 삭제 ────────────────────────────────────────────────
  const removeGemini = () => {
    localStorage.removeItem(LS_GEMINI)
    setGeminiKeySaved('')
    setGeminiStatus(null)
    setGeminiErrMsg('')
    setGeminiErrType(null)
    setGeminiDebug(null)
    setGeminiDiscover(null)
  }

  const runGeminiDebug = async () => {
    if (!geminiKeySaved || geminiDebug === 'running') return
    setGeminiDebug('running')
    const result = await debugGeminiImageGen(geminiKeySaved)
    setGeminiDebug(result)
  }

  const runGeminiDiscover = async () => {
    if (!geminiKeySaved || geminiDiscover === 'running') return
    setGeminiDiscover('running')
    const result = await discoverGeminiImageModels(geminiKeySaved)
    setGeminiDiscover(result)
  }
  const removeOpenAI = () => {
    localStorage.removeItem(LS_OPENAI)
    setOpenaiKeySaved('')
    setOpenaiStatus(null)
    setOpenaiErrMsg('')
  }

  // ── Gemini 연결 확인 ──────────────────────────────────────────
  const checkGeminiKey = async () => {
    if (!geminiKeySaved || geminiStatus === 'checking') return
    setGeminiStatus('checking')
    setGeminiErrMsg('')
    setGeminiErrType(null)
    const result = await validateGeminiKey(geminiKeySaved)
    if (result.ok) {
      setGeminiStatus(true)
      setGeminiErrMsg('')
      setGeminiErrType(null)
    } else {
      setGeminiStatus(false)
      setGeminiErrMsg(result.reason)
      setGeminiErrType(result.type ?? 'network')
    }
  }

  // ── OpenAI 연결 확인 ──────────────────────────────────────────
  const checkOpenAIKey = async () => {
    if (!openaiKeySaved || openaiStatus === 'checking') return
    setOpenaiStatus('checking')
    setOpenaiErrMsg('')
    const result = await validateOpenAIKey(openaiKeySaved)
    if (result.ok) {
      setOpenaiStatus(true)
      setOpenaiErrMsg('')
    } else {
      setOpenaiStatus(false)
      setOpenaiErrMsg(result.reason.slice(0, 80))
    }
  }

  const totalChars = intro.length + body.length

  // 입력값이 바뀔 때마다 실시간으로 등장인물 추출 (store 업데이트 없음 — 미리보기 전용)
  const liveChars = useMemo(() => {
    const combined = [intro, body].filter(Boolean).join('\n')
    return parseCharacters(combined)
  }, [intro, body])

  // 생성 시작 — 같은 화면 아래 결과 섹션 펼치기
  const handleStartGeneration = () => {
    const toImport = liveChars.length > 0 ? liveChars : ['캐릭터 A', '캐릭터 B']
    importCharacters(toImport)
    const allChars = useStore.getState().characters
    const first = allChars[0] ?? null
    if (first) selectCharacter(first.id)
    setShowResults(true)
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  // ── API 패널용 작은 헬퍼 컴포넌트 ───────────────────────────────
  // status: null=미확인 | 'checking'=확인 중 | true=성공 | false=실패
  // errType: 'key' | 'permission' | 'config' | 'network' | null
  const STATUS_TEXT = (status, hasSaved, errType = null) => {
    if (!hasSaved) return { text: '미설정', color: '#6a7f96' }
    if (status === null)       return { text: '저장됨 (미확인)', color: '#5ab4e8' }
    if (status === 'checking') return { text: '확인 중…',        color: '#9aadc4' }
    if (status === true)       return { text: '연결 확인됨',     color: '#5cba80' }
    if (status === false) {
      if (errType === 'key')        return { text: '키 오류',          color: '#e87c7c' }
      if (errType === 'permission') return { text: '권한/결제 오류',   color: '#e8a87c' }
      if (errType === 'config')     return { text: '연결 설정 오류',   color: '#e8c87c' }
      return                               { text: '연결 오류',         color: '#e87c7c' }
    }
    return { text: '미설정', color: '#6a7f96' }
  }

  const StatusBadge = ({ label, status, hasSaved, errType = null, showLabel = true }) => {
    const { text, color } = STATUS_TEXT(status, hasSaved, errType)
    return (
      <span style={{ color, fontSize: 10, fontFamily: 'monospace' }}>
        {showLabel ? `${label}: ` : ''}{text}
      </span>
    )
  }

  const StatusDot = ({ status, hasSaved, errType = null }) => {
    const color = !hasSaved ? '#3d4f66'
      : status === true ? '#5cba80'
      : status === false
        ? (errType === 'config' ? '#e8c87c' : errType === 'permission' ? '#e8a87c' : '#e87c7c')
      : '#5ab4e8'
    return (
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        backgroundColor: color, display: 'inline-block', flexShrink: 0,
      }} />
    )
  }

  const Spinner = () => (
    <span style={{
      width: 12, height: 12, borderRadius: '50%',
      border: '2px solid rgba(148,163,184,0.2)',
      borderTopColor: '#94a3b8',
      display: 'inline-block',
      animation: 'spin 0.7s linear infinite',
    }} />
  )

  // ── Gemini 단계별 테스트 결과 표시 컴포넌트 ──────────────────
  const GeminiDebugResult = ({ result }) => {
    // result = { [modelId]: { status, model, codename, image, errorKind, msg }, imagen3: {...} }
    const rows = Object.values(result)
    const firstSuccess = rows.find(r => r?.status === 'success')

    return (
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          if (!r) return null
          const ok      = r.status === 'success'
          const label   = r.codename ?? r.model ?? '?'
          const isAuth  = r.errorKind === 'auth'
          const isModel = r.errorKind === 'model_not_found' || r.errorKind === 'model'
          const color   = ok ? '#5cba80' : isModel ? '#e8c87c' : isAuth ? '#e87c7c' : '#e8a87c'
          const icon    = ok ? '✓' : '✗'
          const badge   = ok ? '성공' : isModel ? '모델 없음' : isAuth ? '키 오류' : r.errorKind ?? '실패'

          return (
            <div key={r.model ?? label} style={{
              background: ok ? 'rgba(92,186,128,0.08)' : 'rgba(232,124,124,0.06)',
              border: `1px solid ${color}30`,
              borderRadius: 8, padding: '6px 10px',
            }}>
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontSize: 11, color: '#9aadc4', fontFamily: 'monospace' }}>{label}</span>
                <span style={{ fontSize: 10, color, fontFamily: 'monospace', fontWeight: 600 }}>
                  {icon} {badge}
                </span>
              </div>
              {r.model && (
                <p style={{ fontSize: 9, color: '#4a6a88', marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {r.model}
                </p>
              )}
              {!ok && r.msg && (
                <p style={{ fontSize: 10, color: '#7a9ab8', marginTop: 3, lineHeight: 1.4,
                            wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                  {r.msg.slice(0, 140)}
                </p>
              )}
              {ok && r.image && (
                <div className="mt-1.5 flex items-center gap-2">
                  <img
                    src={r.image}
                    alt="test"
                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #2a4260' }}
                    onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block' }}
                  />
                  <span style={{ fontSize: 10, color: '#e87c7c', display: 'none' }}>렌더링 실패</span>
                  <span style={{ fontSize: 10, color: '#5cba80' }}>이미지 생성 + 렌더링 성공</span>
                </div>
              )}
            </div>
          )
        })}

        {/* 종합 판정 */}
        <div style={{
          fontSize: 10, color: firstSuccess ? '#5cba80' : '#e87c7c',
          fontWeight: 600, paddingTop: 2,
        }}>
          {firstSuccess
            ? `✓ ${firstSuccess.codename ?? firstSuccess.model} 생성 성공 → 실제 이미지 생성 가능`
            : '✗ 전체 모델 실패 — 계정 설정 또는 지역 제한 확인 필요'}
        </div>
      </div>
    )
  }

  // ── Gemini 모델 목록 조회 결과 표시 컴포넌트 ─────────────────
  const GeminiDiscoverResult = ({ result }) => {
    if (!result.ok) {
      return (
        <p style={{ fontSize: 10, color: '#e87c7c', fontFamily: 'monospace' }}>
          조회 실패: {result.error?.slice(0, 80)}
        </p>
      )
    }
    const { all = [], imageModels = [] } = result
    return (
      <div className="flex flex-col gap-1.5">
        <p style={{ fontSize: 10, color: '#9aadc4' }}>
          전체 모델: {all.length}개 · 이미지 관련: {imageModels.length}개
        </p>
        {imageModels.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p style={{ fontSize: 9, color: '#5cba80', fontWeight: 600 }}>이미지 생성 가능 모델:</p>
            {imageModels.map(m => (
              <div key={m.name} style={{
                background: 'rgba(92,186,128,0.07)', border: '1px solid rgba(92,186,128,0.2)',
                borderRadius: 6, padding: '4px 8px',
              }}>
                <p style={{ fontSize: 10, color: '#5cba80', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {m.name}
                </p>
                {m.displayName && m.displayName !== m.name && (
                  <p style={{ fontSize: 9, color: '#7a9ab8' }}>{m.displayName}</p>
                )}
                {m.supportedGenerationMethods?.length > 0 && (
                  <p style={{ fontSize: 9, color: '#4a6a88', fontFamily: 'monospace' }}>
                    {m.supportedGenerationMethods.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p style={{ fontSize: 10, color: '#e8c87c' }}>⚠ 이미지 관련 모델 없음</p>
            <p style={{ fontSize: 9, color: '#7a9ab8' }}>전체 모델 목록 (콘솔 [Discover] 로그 확인)</p>
          </div>
        )}
      </div>
    )
  }

  // ── 공통 헤더 ─────────────────────────────────────────────────────
  const apiPanelRef = useRef(null)
  useEffect(() => {
    if (!showApiPanel) return
    const handle = (e) => {
      if (apiPanelRef.current && !apiPanelRef.current.contains(e.target)) {
        setShowApiPanel(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showApiPanel])

  const Header = () => (
    <header className="flex-shrink-0 flex items-center justify-between px-10 border-b border-border bg-surface-1"
            style={{ height: 80, paddingTop: 10, paddingBottom: 10 }}>
      {/* 좌측: 브랜드 + 탭 */}
      <div className="flex items-center gap-8">

        {/* 로고 */}
        <div className="flex flex-col justify-center gap-1 select-none">
          <span className="font-black leading-none"
                style={{ fontSize: 28, letterSpacing: '0.10em' }}>
            irir<span style={{ color: '#7c6af7' }}>4</span>r
            <span style={{ color: '#3d4f66', letterSpacing: '0.08em', fontSize: 20, fontWeight: 500 }}> _ ver.1</span>
          </span>
          <span className="font-semibold uppercase"
                style={{ fontSize: '9px', letterSpacing: '0.24em', color: '#9aadc4' }}>
            Character DNA Studio
          </span>
        </div>

        {/* 수직 구분선 */}
        {characters.length > 0 && (
          <div className="w-px self-stretch bg-border mx-2" />
        )}

        {/* 단계 전환 탭 */}
        {characters.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep(1)}
              className={`
                px-8 py-3 rounded border font-semibold tracking-wide
                transition-all duration-150
                ${step === 1
                  ? 'bg-accent/15 border-accent/50 text-white'
                  : 'border-border text-white/60 hover:border-subtle hover:text-white bg-transparent'}
              `}
              style={{ fontSize: 16 }}
            >
              1. 대본 입력
            </button>
            <button
              onClick={() => setStep(2)}
              className={`
                px-7 py-2.5 rounded border font-semibold tracking-wide
                transition-all duration-150 flex items-center gap-2.5
                ${step === 2
                  ? 'bg-accent/15 border-accent/50 text-white'
                  : 'border-border text-white/60 hover:border-subtle hover:text-white bg-transparent'}
              `}
              style={{ fontSize: 15 }}
            >
              2. 생성 결과
              <span className={`text-xs font-normal px-2 py-0.5 rounded
                ${step === 2 ? 'bg-accent/20 text-accent' : 'bg-surface-3 text-muted'}`}>
                {characters.length}명
              </span>
            </button>
          </div>
        )}
      </div>

      {/* 우측: API 설정 토글 */}
      <div className="relative flex items-center" ref={apiPanelRef}>
        <button
          onClick={() => setShowApiPanel((v) => !v)}
          className={`flex flex-col items-end gap-0.5 px-4 py-2 rounded border transition-all duration-150 select-none
            ${showApiPanel
              ? 'border-accent/50 bg-accent/10'
              : 'border-border hover:border-subtle bg-transparent'}`}
        >
          <span className="text-xs font-semibold leading-none"
                style={{ color: '#c8d8ea', letterSpacing: '0.04em' }}>
            API 설정
          </span>
          {/* 연결 상태 요약 */}
          <span className="text-[10px] leading-none mt-0.5 flex items-center gap-1.5"
                style={{ color: '#6a7f96' }}>
            {openaiKeySaved && (
              <span style={{ color: openaiStatus === true ? '#5cba80' : openaiStatus === false ? '#e87c7c' : '#5ab4e8' }}>
                OpenAI {openaiStatus === true ? '✓' : openaiStatus === false ? '✗' : '·'}
              </span>
            )}
            {openaiKeySaved && geminiKeySaved && (
              <span style={{ color: '#6a7f96' }}>·</span>
            )}
            {geminiKeySaved && (
              <span style={{ color:
                geminiStatus === true ? '#5cba80'
                : geminiStatus === false
                  ? (geminiErrType === 'config' ? '#e8c87c' : '#e87c7c')
                : '#5ab4e8' }}>
                Gemini {geminiStatus === true ? '✓' : geminiStatus === false ? '✗' : '·'}
              </span>
            )}
            {!openaiKeySaved && !geminiKeySaved && 'Key 없음'}
          </span>
        </button>

        {/* 드롭다운 패널 */}
        {showApiPanel && (
          <div className="absolute right-0 top-full mt-2 z-50
                          bg-surface-2 border border-border rounded-xl shadow-2xl shadow-black/40
                          flex flex-col"
               style={{ width: 380 }}>

            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
              <span className="text-xs font-bold tracking-[0.14em] uppercase text-muted">
                API 설정
              </span>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <StatusBadge label="Gemini" status={geminiStatus} hasSaved={!!geminiKeySaved} errType={geminiErrType} />
                <span className="text-border">·</span>
                <StatusBadge label="OpenAI" status={openaiStatus} hasSaved={!!openaiKeySaved} />
              </div>
            </div>

            <div className="flex flex-col px-5 py-4 gap-5">

              {/* ── Gemini 섹션 ── */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <StatusDot status={geminiStatus} hasSaved={!!geminiKeySaved} errType={geminiErrType} />
                  <span className="text-sm font-semibold text-white">Gemini API Key</span>
                  <span className="ml-auto">
                    <StatusBadge label="Gemini" status={geminiStatus} hasSaved={!!geminiKeySaved} errType={geminiErrType} showLabel={false} />
                  </span>
                </div>

                <input
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5
                             text-sm text-white font-mono placeholder-muted
                             focus:outline-none focus:border-accent transition-colors"
                  type="password"
                  placeholder="Gemini API key (AIza...)"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                />

                {/* 연결 확인 버튼 */}
                <div className="flex items-center gap-2">
                  {geminiKeySaved && (
                    <button
                      onClick={checkGeminiKey}
                      disabled={geminiStatus === 'checking'}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border
                        flex items-center justify-center gap-1.5 transition-all duration-150
                        ${geminiStatus === 'checking'
                          ? 'border-border text-muted cursor-not-allowed'
                          : geminiStatus === true
                          ? 'border-green-700/50 bg-green-900/20 text-green-400 hover:bg-green-900/30'
                          : geminiStatus === false && geminiErrType === 'config'
                          ? 'border-yellow-700/40 bg-yellow-900/15 text-yellow-400 hover:bg-yellow-900/25'
                          : geminiStatus === false
                          ? 'border-red-700/40 bg-red-900/15 text-red-400 hover:bg-red-900/25'
                          : 'border-blue-700/40 bg-blue-900/15 text-blue-300 hover:bg-blue-900/25'}`}
                    >
                      {geminiStatus === 'checking'
                        ? <><Spinner /> 확인 중…</>
                        : geminiStatus === true ? '✓ 연결 확인됨 (재확인)'
                        : geminiStatus === false ? '↺ 재확인'
                        : 'Gemini 연결 확인'}
                    </button>
                  )}
                  {geminiKeySaved && (
                    <button onClick={removeGemini}
                      className="text-[11px] text-red-400/50 hover:text-red-400 transition-colors px-2 py-1.5">
                      삭제
                    </button>
                  )}
                </div>

                {/* 상태 메시지 */}
                {geminiErrMsg && (
                  <p className={`text-[11px] leading-snug ${
                    geminiErrType === 'config' ? 'text-yellow-400'
                    : geminiErrType === 'permission' ? 'text-orange-400'
                    : 'text-red-400'
                  }`}>{geminiErrMsg}</p>
                )}
                {geminiStatus === false && geminiErrType === 'key' && (
                  <p className="text-[10px] text-muted leading-relaxed">
                    Google AI Studio에서 키가 올바르게 발급됐는지 확인하세요.
                  </p>
                )}
                {geminiStatus === false && geminiErrType === 'permission' && (
                  <p className="text-[10px] text-muted leading-relaxed">
                    Generative Language API 활성화 및 결제 설정을 확인하세요.
                  </p>
                )}
                {geminiStatus === false && geminiErrType === 'config' && (
                  <p className="text-[10px] text-muted leading-relaxed">
                    키는 유효할 수 있습니다. 연결 확인 엔드포인트 설정 문제입니다.
                  </p>
                )}
                {/* ── 모델 목록 조회 ── */}
                {geminiKeySaved && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted">
                        사용 가능 모델 조회
                      </span>
                      <button
                        onClick={runGeminiDiscover}
                        disabled={geminiDiscover === 'running'}
                        className={`text-[11px] px-2.5 py-1 rounded border transition-all duration-150
                          flex items-center gap-1.5
                          ${geminiDiscover === 'running'
                            ? 'border-border text-muted cursor-not-allowed'
                            : 'border-purple-700/40 bg-purple-900/15 text-purple-300 hover:bg-purple-900/25'}`}
                      >
                        {geminiDiscover === 'running' ? <><Spinner /> 조회 중…</> : '모델 목록 조회'}
                      </button>
                    </div>

                    {geminiDiscover && geminiDiscover !== 'running' && (
                      <GeminiDiscoverResult result={geminiDiscover} />
                    )}
                  </div>
                )}

                {/* ── 이미지 생성 단계별 테스트 ── */}
                {geminiKeySaved && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted">
                        이미지 생성 테스트
                      </span>
                      <button
                        onClick={runGeminiDebug}
                        disabled={geminiDebug === 'running'}
                        className={`text-[11px] px-2.5 py-1 rounded border transition-all duration-150
                          flex items-center gap-1.5
                          ${geminiDebug === 'running'
                            ? 'border-border text-muted cursor-not-allowed'
                            : 'border-blue-700/40 bg-blue-900/15 text-blue-300 hover:bg-blue-900/25'}`}
                      >
                        {geminiDebug === 'running' ? <><Spinner /> 테스트 중…</> : '단계별 테스트 실행'}
                      </button>
                    </div>

                    {geminiDebug && geminiDebug !== 'running' && (
                      <GeminiDebugResult result={geminiDebug} />
                    )}
                  </div>
                )}

                <p className="text-[10px] text-muted">형식: AIzaSy... (Google AI Studio에서 발급)</p>
              </div>

              <div className="h-px bg-border" />

              {/* ── OpenAI 섹션 ── */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <StatusDot status={openaiStatus} hasSaved={!!openaiKeySaved} />
                  <span className="text-sm font-semibold text-white">OpenAI API Key</span>
                  <span className="ml-auto">
                    <StatusBadge label="OpenAI" status={openaiStatus} hasSaved={!!openaiKeySaved} showLabel={false} />
                  </span>
                </div>

                <input
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2.5
                             text-sm text-white font-mono placeholder-muted
                             focus:outline-none focus:border-accent transition-colors"
                  type="password"
                  placeholder="OpenAI API key (sk-...)"
                  value={openaiKeyInput}
                  onChange={(e) => setOpenaiKeyInput(e.target.value)}
                />

                {/* 연결 확인 버튼 */}
                <div className="flex items-center gap-2">
                  {openaiKeySaved && (
                    <button
                      onClick={checkOpenAIKey}
                      disabled={openaiStatus === 'checking'}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border
                        flex items-center justify-center gap-1.5 transition-all duration-150
                        ${openaiStatus === 'checking'
                          ? 'border-border text-muted cursor-not-allowed'
                          : openaiStatus === true
                          ? 'border-green-700/50 bg-green-900/20 text-green-400 hover:bg-green-900/30'
                          : openaiStatus === false
                          ? 'border-red-700/40 bg-red-900/15 text-red-400 hover:bg-red-900/25'
                          : 'border-green-700/40 bg-green-900/10 text-green-300/80 hover:bg-green-900/20'}`}
                    >
                      {openaiStatus === 'checking'
                        ? <><Spinner /> 확인 중…</>
                        : openaiStatus === true ? '✓ 연결 확인됨 (재확인)'
                        : openaiStatus === false ? '✗ 재확인'
                        : 'OpenAI 연결 확인'}
                    </button>
                  )}
                  {openaiKeySaved && (
                    <button onClick={removeOpenAI}
                      className="text-[11px] text-red-400/50 hover:text-red-400 transition-colors px-2 py-1.5">
                      삭제
                    </button>
                  )}
                </div>

                {/* 상태 메시지 */}
                {openaiErrMsg && (
                  <p className="text-[11px] text-red-400 leading-snug">{openaiErrMsg}</p>
                )}
                <p className="text-[10px] text-muted">형식: sk-... (platform.openai.com에서 발급)</p>
              </div>

              {/* ── 공통 저장 버튼 ── */}
              <button
                onClick={saveAllKeys}
                disabled={!geminiKeyInput.trim() && !openaiKeyInput.trim()}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold tracking-wide
                  transition-all duration-150
                  ${(geminiKeyInput.trim() || openaiKeyInput.trim())
                    ? 'bg-accent hover:bg-accent-hover text-white'
                    : 'bg-surface-3 text-muted cursor-not-allowed border border-border'}`}
              >
                API 키 저장
              </button>

            </div>
          </div>
        )}
      </div>
    </header>
  )

  // ── 단계 1: 대본 입력 ─────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="flex flex-col h-screen bg-surface-0 text-white overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-6 p-7 items-start min-h-full">

            {/* ════ 좌측 설정 패널 ════ */}
            <div className="flex-shrink-0 flex flex-col gap-5" style={{ width: '29%' }}>

              <div className="flex items-center gap-2 px-1">
                <span className="text-base font-semibold text-white">⚙️ 설정</span>
              </div>

              {/* 카드: 생성 구성 */}
              <div className="bg-surface-2 border border-border rounded-2xl flex flex-col gap-5"
                   style={{ padding: '24px 24px 28px' }}>
                <p className="text-sm font-semibold text-white tracking-wide">생성 구성</p>
                <p className="text-base font-bold text-accent" style={{ letterSpacing: '0.01em' }}>
                  도입부 5컷 + 본문 25컷
                </p>
                <p className="text-sm text-subtle leading-relaxed">
                  대본 전체를 분석해 <strong className="text-white font-semibold">총 30컷</strong>으로 구성합니다.
                </p>
              </div>

              {/* 카드: 이미지 화면 비율 */}
              <div className="bg-surface-2 border border-border rounded-2xl p-5 flex flex-col gap-3">
                <p className="text-sm font-semibold text-white">이미지 화면 비율</p>
                <div className="flex flex-col gap-2">
                  {RATIOS.map((r) => {
                    const active = ratio === r.id
                    return (
                      <button
                        key={r.id}
                        onClick={() => setRatio(r.id)}
                        className={`
                          w-full text-left px-4 py-3 rounded-xl border text-sm font-medium
                          transition-colors duration-150
                          ${active
                            ? 'border-accent bg-accent/20 text-white'
                            : 'border-border bg-surface-3 text-subtle hover:text-white hover:border-subtle'}
                        `}
                      >
                        {r.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 카드: Consistent Story Engine */}
              <div className="bg-surface-2 border border-border rounded-2xl p-5 flex flex-col gap-2">
                <p className="text-sm font-semibold text-white">Consistent Story Engine</p>
                <p className="text-xs text-muted leading-relaxed">
                  대본의 처음부터 마지막 지점까지 압축하여 도달합니다.
                </p>
              </div>

            </div>

            {/* ════ 우측 메인 카드 ════ */}
            <div className="flex-1 min-w-0 bg-surface-1 border border-border rounded-3xl p-10
                            flex flex-col gap-7">

              {/* 단계 표시 + 제목 */}
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0 w-9 h-9 rounded-full border-2 border-accent
                                flex items-center justify-center text-accent font-bold text-base">
                  1
                </div>
                <div className="flex flex-col gap-1 pt-0.5">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    1단계: 대본 입력
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span>글자 수: <strong className="text-white">{totalChars.toLocaleString()}자</strong></span>
                    <span className="text-border">|</span>
                    <span>압축 목표: <strong className="text-accent">총 30컷</strong></span>
                  </div>
                </div>
              </div>

              {/* 도입부 입력 */}
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="text-xs text-muted font-mono tracking-widest uppercase">Intro</span>
                  <span className="text-muted text-xs">— 도입부 · 5컷</span>
                </label>
                <textarea
                  className="w-full bg-surface-2 border border-border rounded-xl text-white
                             placeholder-muted px-5 py-4 text-sm leading-relaxed resize-none
                             focus:outline-none focus:border-accent transition-colors"
                  style={{ height: 180 }}
                  placeholder="화자 소개 및 인트로 멘트"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  spellCheck={false}
                />
              </div>

              {/* 본문 입력 */}
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="text-xs text-muted font-mono tracking-widest uppercase">Script</span>
                  <span className="text-muted text-xs">— 본문 · 25컷</span>
                </label>
                <textarea
                  className="w-full bg-surface-2 border border-border rounded-xl text-white
                             placeholder-muted px-5 py-4 text-sm leading-relaxed resize-none
                             focus:outline-none focus:border-accent transition-colors"
                  style={{ height: 220 }}
                  placeholder={`홍길동 : 오늘 날씨가 참 좋군.\n이몽룡 : 그렇군요, 나리.\n\n이름: 대사 형식으로 입력하면 등장인물이 자동 추출됩니다.`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  spellCheck={false}
                />
              </div>

              {/* ── 등장인물 실시간 미리보기 ── */}
              <div className="flex flex-col gap-3 bg-surface-2 border border-border rounded-xl px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-[0.14em] uppercase text-muted">
                    등장인물
                  </span>
                  {liveChars.length > 0 && (
                    <span className="text-xs text-muted font-mono">{liveChars.length}명 추출됨</span>
                  )}
                </div>

                {!intro.trim() && !body.trim() ? (
                  <p className="text-xs text-muted leading-relaxed">
                    대본에서 추출된 인물이 여기에 표시됩니다
                  </p>
                ) : liveChars.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {liveChars.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center px-3 py-1 rounded border border-border
                                   bg-surface-3 text-sm text-white font-medium"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted leading-relaxed">
                    이름: 대사 형식으로 입력하면 등장인물이 표시됩니다
                  </p>
                )}
              </div>

              {/* 결과 메시지 */}
              {parseMsg && (
                <p className="text-sm text-accent font-medium">{parseMsg}</p>
              )}

              {/* 생성 시작 버튼 */}
              <button
                onClick={handleStartGeneration}
                disabled={!intro.trim() && !body.trim()}
                className={`
                  w-full py-4 rounded-xl border text-base font-semibold tracking-wide
                  flex items-center justify-center gap-2 transition-all duration-150
                  ${(!intro.trim() && !body.trim())
                    ? 'border-border text-muted cursor-not-allowed bg-transparent'
                    : 'border-accent/50 bg-accent/15 text-white hover:bg-accent/25 cursor-pointer'}
                `}
              >
                생성 시작
              </button>

            </div>
          </div>

          {/* ════ 추출 결과 섹션 (생성 시작 후 펼침) ════ */}
          {showResults ? (
            <div ref={resultsRef} className="px-7 pb-10">
              <div className="border-t border-border pt-8 flex flex-col gap-6">

                {/* 섹션 헤더 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted">
                      추출 결과
                    </span>
                    <span className="text-xs font-mono text-muted">
                      {characters.length}명
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCharEdit((v) => !v)}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors
                        ${showCharEdit
                          ? 'border-accent/50 bg-accent/10 text-accent'
                          : 'border-border text-muted hover:border-subtle hover:text-white'}`}
                    >
                      {showCharEdit ? '편집 닫기 ×' : '캐릭터 편집 ▶'}
                    </button>
                  </div>
                </div>

                {/* 캐릭터 카드 그리드 */}
                <div className="flex gap-6">
                  <div className="flex-1 grid gap-4"
                       style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                    {characters.map((char, i) => (
                      <CharacterGridCard
                        key={char.id}
                        char={char}
                        index={i}
                        apiKey={openaiKeySaved || ''}
                        onEdit={() => {
                          selectCharacter(char.id)
                          setShowCharEdit(true)
                        }}
                      />
                    ))}
                  </div>

                  {/* 캐릭터 편집 드로어 */}
                  {showCharEdit && (
                    <div className="flex-shrink-0 border border-border rounded-2xl bg-surface-1 overflow-hidden flex flex-col"
                         style={{ width: 340 }}>
                      <CharacterDetail onClose={() => setShowCharEdit(false)} />
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : (
            /* 결과 플레이스홀더 */
            <div className="mx-7 mb-10 border border-dashed border-border rounded-2xl
                            flex items-center justify-center py-12">
              <p className="text-sm text-muted text-center leading-relaxed">
                생성 결과가 여기에 표시됩니다
              </p>
            </div>
          )}

        </div>
      </div>
    )
  }

  // ── 단계 2: 이미지 생성 랩 ──────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-surface-0 text-white overflow-hidden">
      <Header />
      <ImageLab
        apiKeyOpenAI={openaiKeySaved || ''}
        apiKeyGemini={geminiKeySaved || ''}
      />
    </div>
  )
}
