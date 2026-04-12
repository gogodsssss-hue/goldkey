import React, { useState } from 'react'
import { useStore } from '../../store/useStore'

/**
 * DNA → 미드저니 프롬프트 자동 생성
 * crefUrl이 있으면 --cref [url] 을 파라미터 앞에 삽입
 */
function dnaToPrompt(name, dna, crefUrl) {
  const parts = []

  parts.push('cinematic portrait')

  if (dna.nationality) parts.push(dna.nationality)

  const ageGender = [dna.age, dna.gender].filter(Boolean).join(', ')
  if (ageGender) parts.push(ageGender)

  if (dna.face) parts.push(dna.face)
  if (dna.eyes) parts.push(dna.eyes)
  if (dna.hair) parts.push(dna.hair)
  if (dna.build) parts.push(dna.build)
  if (dna.style) parts.push(`wearing ${dna.style}`)

  if (dna.personality) {
    const mood = dna.personality.slice(0, 40)
    parts.push(`${mood} expression`)
  }

  if (dna.traits) parts.push(dna.traits.slice(0, 60))

  const base = parts.filter(Boolean).join(', ')
  const params = crefUrl
    ? `--cref ${crefUrl} --ar 2:3 --style raw --v 6.1`
    : `--ar 2:3 --style raw --v 6.1`

  return `${base} ${params}`
}

function isValidUrl(str) {
  try {
    const u = new URL(str)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export default function PromptEditor({ charId, char }) {
  const addPrompt = useStore((s) => s.addPrompt)
  const removePrompt = useStore((s) => s.removePrompt)
  const addCrefLink = useStore((s) => s.addCrefLink)
  const removeCrefLink = useStore((s) => s.removeCrefLink)
  const updateCrefLink = useStore((s) => s.updateCrefLink)

  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(null)

  // cref URL 입력 상태
  const [crefInput, setCrefInput] = useState('')
  const [crefNoteInput, setCrefNoteInput] = useState('')
  const [crefError, setCrefError] = useState('')

  const crefLinks = char.crefLinks ?? []
  // 자동 생성 시 가장 최근 URL(배열 마지막)을 사용
  const latestCref = crefLinks.length > 0 ? crefLinks[crefLinks.length - 1].url : null

  const dnaHasSomeData = Object.values(char.dna).some(Boolean)

  const handleGenerate = () => {
    const generated = dnaToPrompt(char.name, char.dna, latestCref)
    setDraft(generated)
  }

  const handleSave = () => {
    if (draft.trim()) {
      addPrompt(charId, draft.trim())
      setDraft('')
    }
  }

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const handleAddCref = () => {
    const url = crefInput.trim()
    if (!url) return
    if (!isValidUrl(url)) {
      setCrefError('올바른 URL 형식이 아닙니다. (http:// 또는 https://)')
      return
    }
    addCrefLink(charId, url, crefNoteInput.trim())
    setCrefInput('')
    setCrefNoteInput('')
    setCrefError('')
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── 미드저니 참조 URL (cref) 섹션 ── */}
      <div className="card p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-subtle">
            미드저니 참조 URL
            {crefLinks.length > 0 && (
              <span className="ml-2 text-muted font-normal">({crefLinks.length}개)</span>
            )}
          </span>
          {latestCref && (
            <span className="text-xs text-accent/80 bg-accent/10 px-2 py-0.5 rounded font-mono">
              --cref 자동 반영 중
            </span>
          )}
        </div>

        {/* URL 입력 폼 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              className="input-base flex-1 text-xs font-mono"
              placeholder="https://cdn.midjourney.com/..."
              value={crefInput}
              onChange={(e) => { setCrefInput(e.target.value); setCrefError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCref()}
            />
            <button
              className="btn-primary text-xs px-3 flex-shrink-0"
              onClick={handleAddCref}
              disabled={!crefInput.trim()}
            >
              추가
            </button>
          </div>
          <input
            className="input-base text-xs"
            placeholder="메모 (선택)"
            value={crefNoteInput}
            onChange={(e) => setCrefNoteInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCref()}
          />
          {crefError && (
            <p className="text-xs text-red-400">{crefError}</p>
          )}
        </div>

        {/* 저장된 URL 목록 */}
        {crefLinks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {[...crefLinks].reverse().map((link, idx) => (
              <div
                key={link.id}
                className={`flex flex-col gap-1 rounded-lg p-2 border ${
                  idx === 0
                    ? 'border-accent/40 bg-accent/5'   // 가장 최근 = 자동 반영 대상
                    : 'border-border bg-surface-3'
                }`}
              >
                <div className="flex items-center gap-2">
                  {idx === 0 && (
                    <span className="text-accent text-xs flex-shrink-0 font-semibold">★</span>
                  )}
                  <span className="text-xs font-mono text-subtle truncate flex-1" title={link.url}>
                    {link.url}
                  </span>
                  <button
                    className="flex-shrink-0 text-muted hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-surface-4"
                    onClick={() => handleCopy(link.url, `cref-${link.id}`)}
                  >
                    {copied === `cref-${link.id}` ? '✓' : '복사'}
                  </button>
                  <button
                    className="flex-shrink-0 text-muted hover:text-red-400 text-xs px-1.5 py-0.5 rounded hover:bg-surface-4"
                    onClick={() => removeCrefLink(charId, link.id)}
                  >
                    삭제
                  </button>
                </div>
                {/* 노트 인라인 편집 */}
                <input
                  className="input-base text-xs py-0.5"
                  placeholder="메모..."
                  value={link.note || ''}
                  onChange={(e) => updateCrefLink(charId, link.id, { note: e.target.value })}
                />
              </div>
            ))}
            <p className="text-xs text-muted">
              ★ 표시(가장 최근 URL)가 자동 생성 프롬프트에 <code className="bg-surface-3 px-1 rounded">--cref</code> 로 삽입됩니다.
            </p>
          </div>
        )}
      </div>

      {/* ── DNA → 프롬프트 자동 생성 ── */}
      <div className="card p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-subtle">DNA → 프롬프트 자동 생성</span>
          <button
            className="btn-primary text-xs py-1 px-3"
            onClick={handleGenerate}
            disabled={!dnaHasSomeData}
            title={!dnaHasSomeData ? 'DNA 탭에서 정보를 먼저 입력하세요' : ''}
          >
            생성
          </button>
        </div>
        {!dnaHasSomeData && (
          <p className="text-xs text-muted">DNA 탭에서 캐릭터 정보를 입력하면 프롬프트를 자동 생성합니다.</p>
        )}
        {dnaHasSomeData && latestCref && (
          <p className="text-xs text-accent/70">
            참조 URL이 감지됐습니다. 생성 시 <code className="bg-surface-3 px-1 rounded">--cref</code> 가 자동으로 포함됩니다.
          </p>
        )}
      </div>

      {/* ── 드래프트 편집 ── */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-subtle">프롬프트 작성</label>
        <textarea
          className="input-base resize-none text-xs font-mono leading-relaxed"
          rows={5}
          placeholder="미드저니 프롬프트를 직접 입력하거나 자동 생성 후 편집하세요..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          {draft && (
            <button className="btn-ghost text-xs" onClick={() => handleCopy(draft, 'draft')}>
              {copied === 'draft' ? '복사됨 ✓' : '복사'}
            </button>
          )}
          <button
            className="btn-primary text-xs"
            onClick={handleSave}
            disabled={!draft.trim()}
          >
            버전으로 저장
          </button>
        </div>
      </div>

      {/* ── 저장된 버전 목록 ── */}
      {char.prompts.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-subtle">저장된 버전</span>
          {[...char.prompts].reverse().map((p) => (
            <div key={p.id} className="card p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-accent">{p.version}</span>
                <div className="flex gap-1">
                  <button
                    className="btn-ghost text-xs py-0.5 px-2"
                    onClick={() => setDraft(p.text)}
                    title="드래프트로 가져오기"
                  >
                    편집
                  </button>
                  <button
                    className="btn-ghost text-xs py-0.5 px-2"
                    onClick={() => handleCopy(p.text, p.id)}
                  >
                    {copied === p.id ? '복사됨 ✓' : '복사'}
                  </button>
                  <button
                    className="btn-ghost text-xs py-0.5 px-2 text-red-400 hover:text-red-300"
                    onClick={() => removePrompt(charId, p.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
              <p className="text-xs text-subtle font-mono leading-relaxed break-all">{p.text}</p>
            </div>
          ))}
        </div>
      )}

      {char.prompts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="text-3xl opacity-20">✍️</div>
          <p className="text-xs text-muted text-center">
            아직 저장된 프롬프트가 없습니다.<br />
            위에서 작성 후 버전으로 저장하세요.
          </p>
        </div>
      )}
    </div>
  )
}
