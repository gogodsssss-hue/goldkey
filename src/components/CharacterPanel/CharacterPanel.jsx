import React, { useState } from 'react'
import { useStore } from '../../store/useStore'
import CharacterCard from './CharacterCard'

export default function CharacterPanel() {
  const characters   = useStore((s) => s.characters)
  const addCharacter = useStore((s) => s.addCharacter)
  const exportData   = useStore((s) => s.exportData)
  const importData   = useStore((s) => s.importData)

  const [adding,  setAdding]  = useState(false)
  const [newName, setNewName] = useState('')
  const [filter,  setFilter]  = useState('')

  const handleAdd = () => {
    if (newName.trim()) {
      addCharacter(newName.trim())
      setNewName('')
      setAdding(false)
    }
  }

  const handleExport = () => {
    const json = exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = 'irir4r_export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const sorted = [...characters].sort((a, b) => {
    if (a.starred !== b.starred) return b.starred - a.starred
    return a.name.localeCompare(b.name, 'ko')
  })

  const filtered = filter
    ? sorted.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
    : sorted

  const dnaComplete = characters.filter(
    (c) => Object.values(c.dna).filter(Boolean).length === Object.keys(c.dna).length
  ).length

  return (
    <div className="flex flex-col h-full">

      {/* ── 패널 헤더 ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted select-none">
            Characters
          </span>
          {characters.length > 0 && (
            <span className="text-[10px] font-mono text-muted">
              {characters.length}
            </span>
          )}
        </div>
        {characters.length > 0 && (
          <div className="mt-2 flex items-center gap-1">
            {/* DNA 진행 요약 */}
            <div className="flex-1 h-0.5 bg-surface-4 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent/60 rounded-full transition-all duration-300"
                style={{ width: characters.length > 0 ? `${Math.round((dnaComplete / characters.length) * 100)}%` : '0%' }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted ml-1 flex-shrink-0">
              {dnaComplete}/{characters.length} DNA
            </span>
          </div>
        )}
      </div>

      {/* ── 검색 ── */}
      {characters.length > 3 && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-border">
          <input
            className="w-full bg-surface-3 border border-border rounded text-xs text-white
                       placeholder-muted px-2.5 py-1.5 focus:outline-none focus:border-accent
                       transition-colors"
            placeholder="검색..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      )}

      {/* ── 캐릭터 목록 ── */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4 py-8">
            <div className="w-8 h-8 border border-border flex items-center justify-center opacity-30">
              <span className="text-xs font-mono text-muted">0</span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              {characters.length === 0
                ? '대본에서 출연진을\n추출하거나 직접 추가하세요'
                : '검색 결과 없음'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {filtered.map((char) => (
            <CharacterCard key={char.id} char={char} compact />
          ))}
        </div>
      </div>

      {/* ── 추가 입력 ── */}
      {adding && (
        <div className="flex-shrink-0 px-2 py-2 border-t border-border bg-surface-3">
          <div className="flex gap-1.5">
            <input
              autoFocus
              className="flex-1 bg-surface-4 border border-accent/50 rounded text-xs text-white
                         px-2.5 py-1.5 focus:outline-none focus:border-accent transition-colors"
              placeholder="캐릭터 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  handleAdd()
                if (e.key === 'Escape') { setAdding(false); setNewName('') }
              }}
            />
            <button
              className="flex-shrink-0 bg-accent hover:bg-accent-hover text-white text-xs px-2.5 py-1.5 rounded transition-colors"
              onClick={handleAdd}
            >
              추가
            </button>
            <button
              className="flex-shrink-0 text-muted hover:text-white text-xs px-2 py-1.5 rounded hover:bg-surface-4 transition-colors"
              onClick={() => { setAdding(false); setNewName('') }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── 하단 툴바 ── */}
      <div className="flex-shrink-0 border-t border-border px-2 py-2 flex items-center gap-1">
        <button
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px]
                     text-muted hover:text-white hover:bg-surface-3 transition-colors"
          onClick={() => setAdding(true)}
          title="캐릭터 추가"
        >
          <span className="text-accent font-bold">+</span>
          <span>추가</span>
        </button>

        <div className="w-px h-4 bg-border flex-shrink-0" />

        <button
          className="flex items-center justify-center p-1.5 rounded text-muted hover:text-white
                     hover:bg-surface-3 transition-colors"
          onClick={handleExport}
          title="JSON으로 내보내기"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 11h10" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

    </div>
  )
}
