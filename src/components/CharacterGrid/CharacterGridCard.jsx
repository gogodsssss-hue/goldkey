import React, { useState } from 'react'
import { useStore } from '../../store/useStore'
import { generateImage, buildCharacterPrompt } from '../../utils/generateImage'

// ── 상태 색상 ─────────────────────────────────────────────────────
const STATUS_COLOR = {
  idle:       'text-muted',
  generating: 'text-accent',
  done:       'text-green-400',
  failed:     'text-red-400',
}

// ═════════════════════════════════════════════════════════════════
export default function CharacterGridCard({ char, index = 0, onEdit, apiKey }) {
  const toggleStar = useStore((s) => s.toggleStar)
  const addImage   = useStore((s) => s.addImage)

  const [imgStatus, setImgStatus] = useState('idle')
  const [errMsg,    setErrMsg]    = useState('')

  const coverImage = char.images?.[0] ?? null
  const dnaTags    = [char.dna.gender, char.dna.age, char.dna.nationality].filter(Boolean)
  const descText   = [char.dna.style, char.dna.personality].filter(Boolean).join(', ').slice(0, 60)

  // ── 대표 이미지 생성 ──────────────────────────────────────────
  const handleGenerate = async () => {
    if (imgStatus === 'generating') return
    setImgStatus('generating')
    setErrMsg('')

    try {
      const prompt   = buildCharacterPrompt(char)
      const dataUrl  = await generateImage(prompt, apiKey, char.name)
      addImage(char.id, { name: 'AI Generated', dataUrl, note: apiKey ? 'DALL-E 3' : 'Test Image' })
      setImgStatus('done')
    } catch (e) {
      setErrMsg(e.message ?? '알 수 없는 오류')
      setImgStatus('failed')
    }
  }

  const numBadgeColors = [
    '#7c6af7', '#e87c5a', '#5a9ae8', '#5ae8a0',
    '#e85a9a', '#e8c85a', '#5ae8e8', '#9ae85a',
  ]
  const badgeColor = numBadgeColors[index % numBadgeColors.length]

  // ── 렌더 ────────────────────────────────────────────────────────
  return (
    <div
      className="bg-surface-1 border border-border rounded-2xl overflow-hidden
                 flex transition-all duration-150 hover:border-subtle"
      style={{ minHeight: 120 }}
    >
      {/* ── 번호 뱃지 + 이미지 ── */}
      <div className="relative flex-shrink-0" style={{ width: 120 }}>

        {/* 번호 뱃지 */}
        <div
          className="absolute top-3 left-3 z-10 w-6 h-6 rounded-full flex items-center justify-center
                     text-white font-bold select-none"
          style={{ fontSize: 11, backgroundColor: badgeColor, boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
        >
          #{index + 1}
        </div>

        {/* 이미지 또는 플레이스홀더 */}
        {coverImage ? (
          <img
            src={coverImage.dataUrl}
            alt={char.name}
            className="w-full h-full object-cover"
            style={{ minHeight: 120 }}
          />
        ) : (
          <div className="w-full h-full bg-canvas flex items-center justify-center" style={{ minHeight: 120 }}>
            <span className="font-black text-surface-4 select-none"
                  style={{ fontSize: 42, letterSpacing: '-0.04em' }}>
              {char.name.charAt(0)}
            </span>
          </div>
        )}

        {/* 생성 중 오버레이 */}
        {imgStatus === 'generating' && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
            <div className="w-6 h-6 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ── 우측 콘텐츠 ── */}
      <div className="flex-1 min-w-0 flex flex-col px-4 py-3 gap-1.5">

        {/* 이름 + 별 + 편집 */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-white truncate leading-tight">
            {char.name}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => toggleStar(char.id)}
              className={`text-sm leading-none transition-colors
                ${char.starred ? 'text-yellow-400' : 'text-surface-4 hover:text-yellow-400'}`}
            >★</button>
            <button
              onClick={onEdit}
              className="text-[11px] px-2 py-0.5 border border-border rounded text-muted
                         hover:text-white hover:border-subtle transition-colors"
            >편집</button>
          </div>
        </div>

        {/* DNA 태그 */}
        {dnaTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {dnaTags.map((tag, i) => (
              <span key={i}
                    className="text-[10px] text-subtle border border-border px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 설명 */}
        <p className="text-[11px] text-muted leading-snug flex-1">
          {descText || (
            <span className="italic">편집에서 DNA를 입력하세요</span>
          )}
        </p>

        {/* 하단: 상태 + 생성 버튼 */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <span className={`text-[10px] font-medium truncate ${STATUS_COLOR[imgStatus]}`}>
            {imgStatus === 'failed' && errMsg
              ? `실패: ${errMsg.slice(0, 30)}`
              : imgStatus === 'generating' ? '생성 중…'
              : imgStatus === 'done' ? '완료'
              : '대기'}
          </span>
          <button
            onClick={handleGenerate}
            disabled={imgStatus === 'generating'}
            className={`flex-shrink-0 text-[11px] px-3 py-1 rounded border font-medium
              transition-all duration-150
              ${imgStatus === 'generating'
                ? 'border-accent/30 bg-accent/5 text-accent/50 cursor-not-allowed'
                : coverImage
                  ? 'border-border text-muted hover:border-subtle hover:text-white'
                  : 'border-accent/50 bg-accent/10 text-white hover:bg-accent/20'}`}
          >
            {coverImage ? '재생성' : '이미지 생성'}
          </button>
        </div>

      </div>
    </div>
  )
}
