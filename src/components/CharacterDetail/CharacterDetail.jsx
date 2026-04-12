import React, { useState } from 'react'
import { useStore } from '../../store/useStore'
import DnaEditor from './DnaEditor'
import PromptEditor from './PromptEditor'
import ImageManager from './ImageManager'

const TABS = [
  { id: 'dna',    label: 'DNA' },
  { id: 'prompt', label: '프롬프트' },
  { id: 'images', label: '이미지' },
]

export default function CharacterDetail({ onClose }) {
  const selectedId = useStore((s) => s.selectedId)
  const characters = useStore((s) => s.characters)

  const [activeTab, setActiveTab] = useState('dna')

  const char = characters.find((c) => c.id === selectedId)

  if (!char) {
    return (
      <div className="flex flex-col h-full">
        {/* 패널 헤더 */}
        <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-surface-1 flex-shrink-0">
          <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted">캐릭터 편집</span>
          {onClose && (
            <button onClick={onClose}
                    className="text-muted hover:text-white text-sm px-1.5 transition-colors">×</button>
          )}
        </div>
        {/* 탭 바 */}
        <div className="flex border-b border-border flex-shrink-0">
          {TABS.map((tab) => (
            <button key={tab.id} className="flex-1 h-8 text-xs font-mono text-surface-4 border-r border-border last:border-r-0">
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted font-mono">캐릭터를 선택하세요</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-surface-1 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted">캐릭터 편집</span>
          <span className="text-[11px] font-semibold text-white">{char.name}</span>
        </div>
        {onClose && (
          <button onClick={onClose}
                  className="text-muted hover:text-white text-sm px-1.5 transition-colors">×</button>
        )}
      </div>
      {/* 탭 바 — 창틀 스타일 */}
      <div className="flex border-b border-border flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 h-9 text-sm border-r border-border last:border-r-0
              transition-colors duration-100 relative font-medium tracking-wide
              ${activeTab === tab.id
                ? 'text-white bg-surface-3 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent'
                : 'text-muted hover:text-subtle hover:bg-surface-2'}
            `}
          >
            {tab.label}
            {tab.id === 'prompt' && (char.prompts.length > 0 || (char.crefLinks ?? []).length > 0) && (
              <span className="ml-1 text-xs opacity-40 font-normal">
                {char.prompts.length}
                {(char.crefLinks ?? []).length > 0 && `+${(char.crefLinks ?? []).length}`}
              </span>
            )}
            {tab.id === 'images' && char.images.length > 0 && (
              <span className="ml-1 text-xs opacity-40 font-normal">{char.images.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'dna' && <DnaEditor charId={char.id} dna={char.dna} />}
        {activeTab === 'prompt' && <PromptEditor charId={char.id} char={char} />}
        {activeTab === 'images' && <ImageManager charId={char.id} images={char.images} />}
      </div>
    </div>
  )
}
