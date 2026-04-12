import React, { useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { parseCharacters } from './ScriptParser'

export default function ScriptPanel() {
  const scriptText = useStore((s) => s.scriptText)
  const setScriptText = useStore((s) => s.setScriptText)
  const importCharacters = useStore((s) => s.importCharacters)
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)

  const [parseResult, setParseResult] = useState(null) // { found: [], added: 0 }
  const fileInputRef = useRef(null)
  const importInputRef = useRef(null)

  const handleParse = () => {
    const found = parseCharacters(scriptText)
    importCharacters(found)
    setParseResult({ found })
    setTimeout(() => setParseResult(null), 4000)
  }

  const handleFileLoad = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setScriptText(ev.target.result)
      setParseResult(null)
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  const handleExport = () => {
    const json = exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `irir4r_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const ok = importData(ev.target.result)
      if (!ok) alert('파일 형식이 올바르지 않습니다.')
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-subtle uppercase tracking-widest">대본</h2>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-xs"
            onClick={() => fileInputRef.current?.click()}
            title="텍스트 파일 불러오기"
          >
            파일 열기
          </button>
          <button className="btn-ghost text-xs" onClick={handleExport} title="JSON으로 저장">
            내보내기
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => importInputRef.current?.click()}
            title="JSON 불러오기"
          >
            불러오기
          </button>
        </div>
      </div>

      {/* 텍스트 에어리어 */}
      <textarea
        className="input-base flex-1 resize-none leading-relaxed text-xs font-mono"
        placeholder={`대본을 여기에 붙여넣으세요.\n\n지원 형식:\n  홍길동 : 대사 내용...\n  ROMEO : 대사 내용...\n  [홍길동] 대사 내용...`}
        value={scriptText}
        onChange={(e) => {
          setScriptText(e.target.value)
          setParseResult(null)
        }}
        spellCheck={false}
      />

      {/* 추출 버튼 + 결과 */}
      <div className="flex items-center gap-3">
        <button
          className="btn-primary flex-shrink-0"
          onClick={handleParse}
          disabled={!scriptText.trim()}
        >
          등장인물 추출
        </button>
        {parseResult && (
          <span className="text-xs text-accent animate-pulse">
            {parseResult.found.length > 0
              ? `${parseResult.found.length}명 발견 — 새 인물이 목록에 추가됐습니다`
              : '인물을 찾지 못했습니다. 수동으로 추가해주세요.'}
          </span>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileLoad} />
      <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </div>
  )
}
