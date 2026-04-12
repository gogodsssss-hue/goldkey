import React, { useState } from 'react'
import { useStore } from '../../store/useStore'

export default function CharacterCard({ char, compact = false }) {
  const selectedId = useStore((s) => s.selectedId)
  const selectCharacter = useStore((s) => s.selectCharacter)
  const removeCharacter = useStore((s) => s.removeCharacter)
  const toggleStar = useStore((s) => s.toggleStar)
  const renameCharacter = useStore((s) => s.renameCharacter)

  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState(char.name)

  const isSelected = selectedId === char.id

  const handleRename = () => {
    if (nameInput.trim()) renameCharacter(char.id, nameInput.trim())
    setEditing(false)
  }

  const dnaFilled = Object.values(char.dna).filter(Boolean).length
  const totalDna = Object.keys(char.dna).length
  const pct = Math.round((dnaFilled / totalDna) * 100)

  return (
    <div
      onClick={() => selectCharacter(char.id)}
      className={`
        group relative cursor-pointer transition-all duration-150 rounded
        border
        ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5'}
        ${isSelected
          ? 'border-accent/60 bg-surface-3'
          : 'border-transparent hover:border-border hover:bg-surface-3'}
      `}
    >
      <div className="flex items-center gap-2">
        {/* 즐겨찾기 */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleStar(char.id) }}
          className={`flex-shrink-0 text-base leading-none transition-colors ${char.starred ? 'text-yellow-400' : 'text-surface-4 hover:text-yellow-400'}`}
        >
          ★
        </button>

        {/* 이름 */}
        {editing ? (
          <input
            autoFocus
            className="input-base flex-1 py-0.5 h-6 text-sm"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') { setNameInput(char.name); setEditing(false) }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`flex-1 font-medium text-white truncate ${compact ? 'text-[12px]' : 'text-sm'}`}
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
          >
            {char.name}
          </span>
        )}

        {/* DNA 진행률 배지 */}
        {!editing && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${
            pct === 100 ? 'bg-green-900/50 text-green-400' :
            pct > 0 ? 'bg-accent-muted/50 text-accent' :
            'bg-surface-4 text-muted'
          }`}>
            {pct}%
          </span>
        )}

        {/* 삭제 버튼 (호버 시) */}
        {!editing && (
          <button
            onClick={(e) => { e.stopPropagation(); removeCharacter(char.id) }}
            className="flex-shrink-0 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none ml-0.5"
            title="삭제"
          >
            ✕
          </button>
        )}
      </div>

      {/* 프롬프트 / 이미지 카운트 */}
      {(char.prompts.length > 0 || char.images.length > 0) && (
        <div className="flex gap-2 mt-1.5 pl-6">
          {char.prompts.length > 0 && (
            <span className="text-xs text-muted">프롬프트 {char.prompts.length}</span>
          )}
          {char.images.length > 0 && (
            <span className="text-xs text-muted">이미지 {char.images.length}</span>
          )}
        </div>
      )}

      {/* 선택 인디케이터 */}
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4/5 bg-accent rounded-r" />
      )}
    </div>
  )
}
