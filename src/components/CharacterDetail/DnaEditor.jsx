import React from 'react'
import { useStore } from '../../store/useStore'

const DNA_FIELDS = [
  { key: 'gender',      label: '성별',     placeholder: '예: 여성, 남성, 중성적' },
  { key: 'age',         label: '나이',     placeholder: '예: 20대 초반, 40대' },
  { key: 'nationality', label: '국적/배경', placeholder: '예: 한국인, 조선시대, 미국 남부' },
  { key: 'face',        label: '얼굴',     placeholder: '예: 갸름한 얼굴, 강한 턱선, 큰 눈' },
  { key: 'hair',        label: '헤어',     placeholder: '예: 짧은 검정 단발, 긴 웨이브 금발' },
  { key: 'eyes',        label: '눈',       placeholder: '예: 날카로운 쌍꺼풀, 온화한 갈색 눈' },
  { key: 'build',       label: '체형',     placeholder: '예: 마른 체형, 170cm 단단한 근육' },
  { key: 'style',       label: '의상/스타일', placeholder: '예: 조선 관복, 현대적 수트' },
  { key: 'personality', label: '성격',     placeholder: '예: 내성적이고 냉철한, 활발하고 충동적인', textarea: true },
  { key: 'traits',      label: '특징/버릇', placeholder: '예: 왼쪽 눈에 흉터, 항상 부채를 들고 다님', textarea: true },
  { key: 'notes',       label: '추가 메모', placeholder: '기타 참고사항...', textarea: true },
]

export default function DnaEditor({ charId, dna }) {
  const updateDna = useStore((s) => s.updateDna)

  const completedCount = DNA_FIELDS.filter((f) => dna[f.key]?.trim()).length
  const pct = Math.round((completedCount / DNA_FIELDS.length) * 100)

  return (
    <div className="flex flex-col gap-4">
      {/* 진행률 바 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-surface-3 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted flex-shrink-0">
          DNA {completedCount}/{DNA_FIELDS.length}
        </span>
      </div>

      {/* 필드 그리드 */}
      <div className="grid grid-cols-1 gap-3">
        {DNA_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-subtle">{field.label}</label>
            {field.textarea ? (
              <textarea
                className="input-base resize-none text-sm leading-relaxed"
                rows={2}
                placeholder={field.placeholder}
                value={dna[field.key] || ''}
                onChange={(e) => updateDna(charId, { [field.key]: e.target.value })}
              />
            ) : (
              <input
                className="input-base text-sm"
                placeholder={field.placeholder}
                value={dna[field.key] || ''}
                onChange={(e) => updateDna(charId, { [field.key]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
