/**
 * 대본 텍스트에서 등장인물 이름을 추출합니다.
 *
 * 지원 패턴:
 *   1. 한국어 대본: "홍길동 :" 또는 "홍길동:" (콜론 앞 이름)
 *   2. 영문 대본: 줄 전체가 대문자인 단어 (ROMEO, JULIET)
 *   3. 괄호 지시 패턴: "[홍길동]" 또는 "(ROMEO)"
 *   4. 지문 제외: #으로 시작하는 줄, S#, C# 등
 */
export function parseCharacters(text) {
  if (!text || !text.trim()) return []

  const nameSet = new Set()

  const lines = text.split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // S#, C#, INT., EXT., 장면 번호 줄 제외
    if (/^(S#|C#|INT\.|EXT\.|장면|#\d)/i.test(line)) continue
    // 지문 설명 줄 제외 (괄호로 시작하는 지시문)
    if (/^\(.*\)$/.test(line)) continue

    // 패턴 1: "이름 :" 또는 "이름:" — 한국어/영문 대본 공통
    const colonMatch = line.match(/^([가-힣A-Za-z][가-힣A-Za-z\s·]{0,20}?)\s*:/)
    if (colonMatch) {
      const name = colonMatch[1].trim()
      if (isValidName(name)) {
        nameSet.add(normalize(name))
        continue
      }
    }

    // 패턴 2: 줄 전체가 영문 대문자 (HAMLET, KING LEAR)
    if (/^[A-Z][A-Z\s\-']{1,30}$/.test(line) && line.length <= 30) {
      const name = line.trim()
      if (isValidName(name)) {
        nameSet.add(normalize(name))
        continue
      }
    }

    // 패턴 3: [이름] 또는 (이름) 형식
    const bracketMatch = line.match(/^[\[(]([가-힣A-Za-z][가-힣A-Za-z\s·]{0,20}?)[\])]/)
    if (bracketMatch) {
      const name = bracketMatch[1].trim()
      if (isValidName(name)) {
        nameSet.add(normalize(name))
        continue
      }
    }
  }

  return Array.from(nameSet).sort()
}

const EXCLUDED = new Set([
  // 한국어 일반 단어
  '나레이션', '내레이션', '나레이터', '해설', '자막', '효과음',
  '음악', '배경', '장면', '지문', '지시',
  // 영문 일반 단어
  'INT', 'EXT', 'CUT', 'FADE', 'SCENE', 'ACT', 'THE', 'AND', 'OR',
  'NARRATOR', 'NARRATION', 'VOICE', 'NOTE',
  // HTML / XML / 코드 토큰
  'XMLNS', 'XML', 'HTML', 'HEAD', 'BODY', 'DIV', 'SPAN', 'META',
  'LINK', 'HREF', 'SRC', 'ALT', 'CLASS', 'TYPE', 'DATA', 'STYLE',
  'SCRIPT', 'INPUT', 'FORM', 'TITLE', 'TABLE', 'TBODY', 'TR', 'TD',
  'SVG', 'PATH', 'RECT', 'IMG', 'A', 'P', 'H', 'LI', 'UL', 'OL',
])

function isValidName(name) {
  if (!name || name.length < 1 || name.length > 25) return false
  if (EXCLUDED.has(name.toUpperCase())) return false

  // 숫자로 시작하거나 숫자/기호만으로 구성된 경우 제외
  if (/^\d/.test(name)) return false
  if (/^[^가-힣A-Za-z]+$/.test(name)) return false

  // 1자 영문 단독은 제외 (한글 1자는 허용)
  if (/^[A-Za-z]$/.test(name)) return false

  // 소문자 시작 토큰 제외 (camelCase, 코드 변수명 패턴)
  if (/^[a-z]/.test(name)) return false

  // 특수문자 포함 제외 (일부 한자 부호 제외)
  if (/[<>\/\\=&"'{}[\]@#$%^*+|~`]/.test(name)) return false

  // 한글 또는 영문 포함
  if (!/[가-힣A-Za-z]/.test(name)) return false

  return true
}

function normalize(name) {
  // 영문이면 Title Case로, 한글은 그대로
  if (/^[A-Z\s]+$/.test(name)) {
    return name
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }
  return name
}
