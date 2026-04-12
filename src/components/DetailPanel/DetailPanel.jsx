import React, { useState } from 'react'
import { generateImage } from '../../utils/generateImage'

/**
 * 색채/연출 정밀 리터칭 패널
 * props:
 *   image       - 현재 표시할 이미지 src (dataUrl or URL)
 *   versions    - 이전 생성 이미지 배열 [{src}]
 *   charName    - 캐릭터 이름 (없으면 '')
 *   apiKey      - OpenAI API key
 *   onNewImage  - (src) => void  새 이미지 생성 시 콜백
 *   onClose     - () => void
 */
export default function DetailPanel({ image, versions = [], charName = '', apiKey, provider = 'openai', onNewImage, onClose }) {
  const [prompt,  setPrompt]  = useState('')
  const [status,  setStatus]  = useState('idle') // idle | generating | done | failed
  const [errMsg,  setErrMsg]  = useState('')
  const [current, setCurrent] = useState(image)   // 우측에서 선택 중인 버전

  const downloadCurrent = async () => {
    const ts = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const name = charName ? charName.replace(/\s+/g, '_').slice(0, 20) : 'result'
    const filename = `irir4r_${name}_${ts}.png`
    try {
      if (current.startsWith('data:')) {
        const a = document.createElement('a')
        a.href = current
        a.download = filename
        a.click()
      } else {
        const res = await fetch(current)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (e) {
      console.error('[DetailPanel] 다운로드 실패:', e.message)
    }
  }

  const isGenerating = status === 'generating'

  const handleRetouch = async () => {
    if (!prompt.trim() || isGenerating) return
    setStatus('generating')
    setErrMsg('')

    const finalPrompt = [
      charName ? `cinematic portrait of ${charName}` : 'cinematic portrait',
      prompt.trim(),
      'maintain character consistency, photorealistic',
    ].join(', ')

    try {
      const result = await generateImage(finalPrompt, apiKey, charName || prompt, provider)
      onNewImage?.(result)
      setCurrent(result)
      setStatus('done')
    } catch (e) {
      setErrMsg(e.message ?? '오류 발생')
      setStatus('failed')
    }
  }

  const allVersions = [...versions, image].filter(Boolean)

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-surface-1 border border-border rounded-2xl flex overflow-hidden
                   w-full max-w-4xl"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 좌측: 이미지 ── */}
        <div className="flex-1 bg-canvas flex items-center justify-center p-8 min-w-0">
          <img
            src={current}
            alt={charName || 'generated'}
            className="max-h-[70vh] max-w-full rounded-xl object-contain"
          />
        </div>

        {/* ── 우측: 리터칭 컨트롤 ── */}
        <div className="flex-shrink-0 border-l border-border flex flex-col bg-surface-2"
             style={{ width: 288 }}>

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">✦</span>
              <span className="text-sm font-semibold text-white">색채/연출 정밀 리터칭</span>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-white text-xl leading-none transition-colors"
            >×</button>
          </div>

          {/* 모드 + 텍스트 영역 */}
          <div className="flex-1 px-5 py-4 flex flex-col gap-3 overflow-y-auto">
            <span className="text-xs font-medium text-accent">의상/색감 보정 모드</span>
            <textarea
              className="flex-1 bg-surface-3 border border-border rounded-lg px-3 py-3
                         text-sm text-white placeholder-muted resize-none
                         focus:outline-none focus:border-accent transition-colors leading-relaxed"
              style={{ minHeight: 120 }}
              placeholder={`색감을 더 화려하게 하거나,\n인물의 동작을 더 크게 바꿔보세요.\n옷은 유지됩니다.`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            {/* 상태 메시지 */}
            {status === 'failed' && (
              <p className="text-xs text-red-400">{errMsg.slice(0, 60)}</p>
            )}

            {/* 재생성 버튼 */}
            <button
              onClick={handleRetouch}
              disabled={!prompt.trim() || isGenerating}
              className={`w-full py-3 rounded-xl text-sm font-semibold tracking-wide transition-all duration-150
                flex items-center justify-center gap-2
                ${(!prompt.trim() || isGenerating)
                  ? 'bg-surface-3 text-muted cursor-not-allowed border border-border'
                  : 'bg-accent hover:bg-accent-hover text-white'}`}
            >
              {isGenerating
                ? <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> 생성 중…</>
                : '역동적 재생성'}
            </button>
          </div>

          {/* 버전 히스토리 */}
          {allVersions.length > 0 && (
            <div className="flex-shrink-0 px-5 py-3 border-t border-border">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted block mb-2">
                버전 히스토리
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allVersions.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(v)}
                    className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors
                      ${current === v ? 'border-accent' : 'border-border hover:border-subtle'}`}
                  >
                    <img src={v} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 다운로드 + 닫기 */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-border flex flex-col gap-2">
            <button
              onClick={downloadCurrent}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors
                         border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
            >
              ↓ 이미지 저장
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 border border-border rounded-lg text-sm text-subtle
                         hover:text-white hover:border-subtle transition-colors"
            >
              확인 후 닫기
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
