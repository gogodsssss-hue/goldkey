import React, { useState } from 'react'
import { useStore } from '../../store/useStore'

// 프레임 코너 마커 — 작업창 느낌
function CornerMarkers() {
  const s = 'absolute w-4 h-4 border-border'
  return (
    <>
      <span className={`${s} top-0 left-0   border-t border-l`} />
      <span className={`${s} top-0 right-0  border-t border-r`} />
      <span className={`${s} bottom-0 left-0  border-b border-l`} />
      <span className={`${s} bottom-0 right-0 border-b border-r`} />
    </>
  )
}

export default function CentralCanvas({ showCharEdit = false, onToggleCharEdit }) {
  const characters = useStore((s) => s.characters)
  const selectedId = useStore((s) => s.selectedId)
  const char       = characters.find((c) => c.id === selectedId)

  // activeImg: 사용자가 명시적으로 클릭한 이미지만 — 자동 표시 없음
  const [activeImg, setActiveImg] = useState(null)
  const [lightbox,  setLightbox]  = useState(null)

  // 캐릭터가 바뀌면 activeImg 초기화
  const [lastCharId, setLastCharId] = useState(null)
  if (char?.id !== lastCharId) {
    setLastCharId(char?.id ?? null)
    setActiveImg(null)
  }

  // ── 캐릭터 미선택 상태 ──────────────────────────────────────────
  if (!char) {
    return (
      <div className="flex flex-col h-full bg-canvas">
        <div className="flex items-center justify-between px-5 h-10 border-b border-border bg-surface-1 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted tracking-[0.18em] uppercase font-bold">Canvas</span>
            <span className="text-[10px] text-surface-4 font-mono">— 캐릭터를 선택하세요</span>
          </div>
          {onToggleCharEdit && (
            <button
              onClick={onToggleCharEdit}
              className={`text-xs px-3 py-1 rounded border transition-colors duration-150
                ${showCharEdit
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : 'border-border text-muted hover:border-subtle hover:text-white'}`}
            >
              {showCharEdit ? '편집 닫기 ×' : '캐릭터 편집 ▶'}
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="relative w-full h-full border border-border flex flex-col items-center justify-center gap-4 select-none">
            <CornerMarkers />
            <div className="w-px h-12 bg-border" />
            <p className="text-sm text-muted tracking-wide">캐릭터를 선택하면 작업 공간이 활성화됩니다</p>
            <div className="w-px h-12 bg-border" />
          </div>
        </div>
      </div>
    )
  }

  const images    = char.images    ?? []
  const crefLinks = char.crefLinks ?? []
  const dnaTags   = [char.dna.gender, char.dna.age, char.dna.nationality, char.dna.face, char.dna.hair].filter(Boolean)

  // ── 캐릭터 선택 상태 ───────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-canvas">

      {/* ── 타이틀 바 ── */}
      <div className="flex items-center justify-between px-5 h-10 border-b border-border bg-surface-1 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-muted tracking-[0.18em] uppercase font-bold">Canvas</span>
          <div className="w-px h-5 bg-border" />
          <span className="text-base font-semibold text-white">{char.name}</span>
          {dnaTags.length > 0 && (
            <div className="flex items-center gap-1.5">
              {dnaTags.map((tag, i) => (
                <span key={i} className="text-xs text-muted border border-border px-2 py-0.5">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {images.length > 0    && <span>{images.length} img</span>}
          {crefLinks.length > 0 && <span>{crefLinks.length} cref</span>}
          {activeImg && (
            <button
              className="text-xs text-muted hover:text-white border border-border px-2 py-0.5 transition-colors"
              onClick={() => setActiveImg(null)}
            >
              닫기
            </button>
          )}
          {onToggleCharEdit && (
            <button
              onClick={onToggleCharEdit}
              className={`text-xs px-3 py-1 rounded border transition-colors duration-150
                ${showCharEdit
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : 'border-border text-muted hover:border-subtle hover:text-white'}`}
            >
              {showCharEdit ? '편집 닫기 ×' : '캐릭터 편집 ▶'}
            </button>
          )}
        </div>
      </div>

      {/* ── 메인 캔버스 영역 ── */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-10">

        {activeImg ? (
          /* 이미지 뷰: 사용자가 썸네일을 클릭했을 때만 */
          <div className="relative border border-border flex flex-col" style={{ maxHeight: 'calc(100vh - 240px)' }}>
            <div
              className="border-b border-border px-3 py-1.5 flex items-center justify-between bg-surface-1 flex-shrink-0"
            >
              <span className="text-xs text-muted truncate max-w-xs">{activeImg.name}</span>
              <button
                className="text-xs text-muted hover:text-white ml-4 flex-shrink-0"
                onClick={() => setLightbox(activeImg)}
              >
                전체 보기
              </button>
            </div>
            <img
              src={activeImg.dataUrl}
              alt={activeImg.name}
              className="block object-contain"
              style={{ maxHeight: 'calc(100vh - 290px)', maxWidth: '100%' }}
            />
            {activeImg.note && (
              <div className="border-t border-border px-3 py-1.5 text-xs text-muted bg-surface-1 flex-shrink-0">
                {activeImg.note}
              </div>
            )}
          </div>
        ) : (
          /* 빈 작업 프레임: 기본 상태 */
          <div className="relative w-full h-full border border-border flex flex-col select-none"
               style={{ maxHeight: 'calc(100vh - 240px)' }}>
            <CornerMarkers />

            {/* 가로 중심선 */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-px h-px bg-border opacity-30" />
            {/* 세로 중심선 */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-px w-px bg-border opacity-30" />

            {/* 중앙 콘텐츠 */}
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl font-black tracking-tighter"
                      style={{ color: '#1e2d42', letterSpacing: '-0.04em' }}>
                  {char.name}
                </span>
                <div className="w-8 h-px bg-border" />
                {dnaTags.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
                    {dnaTags.map((tag, i) => (
                      <span key={i} className="text-xs text-muted border border-border px-2 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted">DNA 정보를 입력하세요</span>
                )}
              </div>

              {images.length > 0 && (
                <p className="text-xs text-muted mt-2">
                  아래 썸네일을 클릭하면 이미지가 표시됩니다
                </p>
              )}
            </div>

            {/* 우측 하단 좌표 표시 — 툴 느낌 */}
            <div className="absolute bottom-3 right-4 text-xs font-mono opacity-20 select-none">
              {char.name} · W — H
            </div>
          </div>
        )}
      </div>

      {/* ── 하단 바: 썸네일 + cref ── */}
      {(images.length > 0 || crefLinks.length > 0) && (
        <div className="flex-shrink-0 border-t border-border bg-surface-1">

          {/* 썸네일 열 */}
          {images.length > 0 && (
            <div className="flex items-center overflow-x-auto border-b border-border">
              {images.map((img) => {
                const isActive = activeImg?.id === img.id
                return (
                  <button
                    key={img.id}
                    onClick={() => setActiveImg(isActive ? null : img)}
                    title={img.note || img.name}
                    className={`
                      flex-shrink-0 w-12 h-12 border-r border-border overflow-hidden transition-opacity
                      ${isActive
                        ? 'outline outline-1 outline-accent outline-offset-[-1px] opacity-100'
                        : 'opacity-40 hover:opacity-80'}
                    `}
                  >
                    <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                  </button>
                )
              })}
              <span className="px-3 text-xs text-muted flex-shrink-0">
                클릭하여 표시
              </span>
            </div>
          )}

          {/* cref 열 */}
          {crefLinks.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
              <span className="text-xs text-accent font-mono flex-shrink-0">--cref</span>
              {[...crefLinks].reverse().map((link, idx) => (
                <div key={link.id} className="flex items-center gap-1 flex-shrink-0">
                  {idx === 0 && <span className="text-accent text-xs">★</span>}
                  <span
                    className="text-xs font-mono text-muted border border-border px-2 py-0.5 max-w-[200px] truncate"
                    title={link.url}
                  >
                    {link.url}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 라이트박스 ── */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => setLightbox(null)}
        >
          <div className="relative border border-border" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.dataUrl}
              alt={lightbox.name}
              className="block max-w-full max-h-[88vh] object-contain"
            />
            <button
              className="absolute top-2 right-2 bg-surface-1 border border-border text-white w-7 h-7 flex items-center justify-center text-xs hover:bg-surface-2"
              onClick={() => setLightbox(null)}
            >
              ✕
            </button>
            {lightbox.note && (
              <div className="border-t border-border px-3 py-1.5 text-xs text-muted bg-surface-1">
                {lightbox.note}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
