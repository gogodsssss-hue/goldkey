/**
 * generateImage.js
 * 지원 provider: 'openai' (DALL-E 3) | 'gemini' (Gemini Flash → Imagen 3 fallback)
 */

// ────────────────────────────────────────────────────────────────
//  공통 헬퍼
// ────────────────────────────────────────────────────────────────

/** API 키 마스킹 (앞 8자리만 노출) */
function maskKey(key) {
  if (!key) return '(없음)'
  if (key.length <= 8) return key.slice(0, 4) + '...'
  return key.slice(0, 8) + '...'
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** HTTP 상태 코드 → 사람이 읽을 수 있는 에러 구분 */
function classifyHttpError(status, provider) {
  const tag = `[${provider.toUpperCase()}]`
  if (status === 400) return `${tag} 요청 형식 오류 (400) — API 요청 구조 문제`
  if (status === 401) return `${tag} 인증 실패 (401) — API 키가 잘못되었습니다`
  if (status === 403) return `${tag} 권한 없음 (403) — API 미활성화 또는 결제 필요`
  if (status === 404) return `${tag} 모델 없음 (404) — 모델명 오류 또는 접근 불가`
  if (status === 429) return `${tag} 요청 한도 초과 (429) — 잠시 후 다시 시도하세요`
  if (status >= 500)  return `${tag} 서버 오류 (${status}) — Google/OpenAI 서버 문제`
  return `${tag} HTTP ${status}`
}

// ────────────────────────────────────────────────────────────────
//  OpenAI — DALL-E 3
// ────────────────────────────────────────────────────────────────
export async function callDallE(prompt, apiKey) {
  console.log('[OpenAI] ▶ 요청 시작')
  console.log('[OpenAI] prompt:', prompt.slice(0, 100))

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
    }),
  })

  console.log('[OpenAI] 응답 status:', res.status)

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('[OpenAI] 오류 raw:', JSON.stringify(err).slice(0, 300))
    const apiMsg = err?.error?.message
    throw new Error(apiMsg ?? classifyHttpError(res.status, 'OpenAI'))
  }

  const data = await res.json()
  console.log('[OpenAI] raw 응답:', JSON.stringify(data).slice(0, 200))

  const item = data?.data?.[0]
  if (!item) throw new Error('[OpenAI] 응답 파싱 실패 — data.data[0] 없음')

  // b64_json 우선
  if (item.b64_json) {
    const dataUrl = `data:image/png;base64,${item.b64_json}`
    console.log('[OpenAI] ✅ b64_json 추출 — 길이:', dataUrl.length)
    return dataUrl
  }

  // URL → blob 변환
  if (item.url) {
    console.log('[OpenAI] URL 추출:', item.url.slice(0, 80))
    try {
      const imgRes = await fetch(item.url)
      const blob   = await imgRes.blob()
      const dataUrl = await blobToDataUrl(blob)
      console.log('[OpenAI] ✅ blob→dataUrl 완료 — 길이:', dataUrl.length)
      return dataUrl
    } catch (e) {
      console.warn('[OpenAI] blob 변환 실패, URL 직접 반환:', e.message)
      console.log('[OpenAI] ✅ URL 직접 반환 — src:', item.url.slice(0, 80))
      return item.url
    }
  }

  throw new Error('[OpenAI] 응답에 url/b64_json 필드 모두 없음')
}

// ────────────────────────────────────────────────────────────────
//  OpenAI — 키 유효성 사전 검증 (GET /v1/models)
//  반환: { ok: true } | { ok: false, reason: string }
// ────────────────────────────────────────────────────────────────
export async function validateOpenAIKey(apiKey) {
  if (!apiKey) return { ok: false, reason: 'API 키가 입력되지 않았습니다' }
  if (!apiKey.startsWith('sk-')) {
    return { ok: false, reason: 'OpenAI API 키 형식이 올바르지 않습니다 (sk-... 형식)' }
  }

  console.log('[OpenAI/Validate] ▶ 키 검증 시작 — key:', maskKey(apiKey))

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    console.log('[OpenAI/Validate] 응답 status:', res.status)

    if (res.ok) {
      console.log('[OpenAI/Validate] ✅ 키 유효함')
      return { ok: true }
    }

    const err = await res.json().catch(() => ({}))
    const msg = err?.error?.message ?? `HTTP ${res.status}`
    console.warn('[OpenAI/Validate] ❌ 실패:', msg)

    if (res.status === 401) return { ok: false, reason: '인증 실패 — API 키가 잘못되었거나 만료되었습니다' }
    if (res.status === 403) return { ok: false, reason: '권한 없음 — 결제 또는 조직 설정을 확인하세요' }
    return { ok: false, reason: `오류 (${res.status}) — ${msg.slice(0, 60)}` }
  } catch (e) {
    console.error('[OpenAI/Validate] 네트워크 오류:', e.message)
    return { ok: false, reason: `네트워크 오류 — ${e.message}` }
  }
}

// ────────────────────────────────────────────────────────────────
//  Gemini — 키 유효성 사전 검증
//  방식: GET /v1/models (모델 목록 조회 — 모델명 선택 불필요)
//  반환: { ok: true }
//        | { ok: false, type: 'key'|'permission'|'config'|'network', reason: string }
//
//  type 의미:
//    key        — API 키 자체가 잘못됨 (400 API key / 401)
//    permission — 권한/결제 문제 (403)
//    config     — 모델명·엔드포인트·API버전 설정 문제 (404 / 모델 미발견)
//    network    — 네트워크 오류
// ────────────────────────────────────────────────────────────────
export async function validateGeminiKey(apiKey) {
  if (!apiKey) return { ok: false, type: 'key', reason: 'API 키가 입력되지 않았습니다' }

  // GET /v1/models: 키 인증만 확인, 특정 모델에 의존하지 않음
  const API_VERSION = 'v1'
  const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models?key=${apiKey}`

  console.log('[Gemini/Validate] ▶ 키 검증 시작')
  console.log('[Gemini/Validate] key:', maskKey(apiKey))
  console.log('[Gemini/Validate] API version:', API_VERSION)
  console.log('[Gemini/Validate] URL:', url.replace(apiKey, maskKey(apiKey)))
  console.log('[Gemini/Validate] 방식: GET /v1/models (모델 목록 — 모델 선택 없음)')

  try {
    const res = await fetch(url, { method: 'GET' })

    console.log('[Gemini/Validate] 응답 status:', res.status)

    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      const modelCount = data?.models?.length ?? '?'
      console.log('[Gemini/Validate] ✅ 키 유효 — 조회된 모델 수:', modelCount)
      return { ok: true }
    }

    const err = await res.json().catch(() => ({}))
    const msg = err?.error?.message ?? `HTTP ${res.status}`
    console.warn('[Gemini/Validate] ❌ 실패 — status:', res.status)
    console.warn('[Gemini/Validate] raw error:', JSON.stringify(err).slice(0, 300))

    // ── 에러 종류 분류 ─────────────────────────────────────────
    const msgLower = msg.toLowerCase()

    // 400 + "api key" 포함 → 키 자체 오류
    if (res.status === 400 && msgLower.includes('api key')) {
      return { ok: false, type: 'key', reason: 'Gemini API 키가 올바르지 않습니다' }
    }
    // 401 → 인증 실패 = 키 오류
    if (res.status === 401) {
      return { ok: false, type: 'key', reason: 'Gemini API 키가 올바르지 않습니다 (인증 실패)' }
    }
    // 403 → 권한/결제 문제
    if (res.status === 403) {
      return { ok: false, type: 'permission', reason: 'Gemini 연결 확인 요청에 실패했습니다 (권한 없음 — API 활성화 또는 결제 필요)' }
    }
    // 404 → 엔드포인트/모델 설정 문제
    if (res.status === 404 || msgLower.includes('not found')) {
      return { ok: false, type: 'config', reason: 'Gemini 연결 확인 모델 또는 API 버전 설정이 잘못되었습니다' }
    }
    // 기타
    return { ok: false, type: 'network', reason: `Gemini 연결 확인 요청에 실패했습니다 (${res.status})` }

  } catch (e) {
    console.error('[Gemini/Validate] 네트워크 오류:', e.message)
    return { ok: false, type: 'network', reason: `Gemini 연결 확인 요청에 실패했습니다 (네트워크 오류)` }
  }
}

// ────────────────────────────────────────────────────────────────
//  에러 분류 헬퍼
// ────────────────────────────────────────────────────────────────

/** 401 / 403 / "api key" 포함 → 키/인증 오류 */
function isAuthError(status, msg = '') {
  const m = msg.toLowerCase()
  return status === 401 || status === 403 ||
    (status === 400 && m.includes('api key')) ||
    m.includes('인증') || m.includes('유효하지 않')
}

/** 404 / "not found" / "deprecated" → 모델·엔드포인트 오류 */
function isModelNotFoundError(status, msg = '') {
  const m = msg.toLowerCase()
  return status === 404 ||
    m.includes('not found') ||
    m.includes('deprecated') ||
    m.includes('no longer') ||
    m.includes('does not exist')
}

// ────────────────────────────────────────────────────────────────
//  Gemini 이미지 생성 모델 레지스트리
//
//  codename: UI 표시용 이름 (상태 문구에 사용)
//  model:    Google AI API 실제 모델 ID
//  gen:      세대 표시 (콘솔 로그용)
//
//  우선순위 (위에서 아래, 첫 성공 반환):
//   1. Nano Banana 2  — gemini-3.1-flash-preview-image-generation  ← 기본 (최신)
//   2. Nano Banana    — gemini-2.5-flash-preview-image-generation   ← 1세대 fallback
//   3. Gemini 3 Pro   — gemini-3-pro-image-preview                  ← Pro 옵션
//   4. Gemini 2.5 base— gemini-2.5-flash                            ← 최후 base 시도
//
//  * gemini-2.0-* exp/preview 계열은 deprecated → 목록에서 완전 제거
// ────────────────────────────────────────────────────────────────
export const GEMINI_IMAGE_MODEL_REGISTRY = [
  { model: 'gemini-3.1-flash-preview-image-generation', codename: 'Nano Banana 2', gen: '3.1' },
  { model: 'gemini-2.5-flash-preview-image-generation', codename: 'Nano Banana',   gen: '2.5' },
  { model: 'gemini-3-pro-image-preview',                codename: 'Gemini 3 Pro',  gen: '3'   },
  { model: 'gemini-2.5-flash',                          codename: 'Gemini 2.5',    gen: '2.5' },
]

/** 현재 우선순위 기본 codename (UI 상태 문구용) */
export const GEMINI_PRIMARY_CODENAME = GEMINI_IMAGE_MODEL_REGISTRY[0].codename  // 'Nano Banana 2'

/** model ID 배열 (callGeminiNativeModel 반복 호출용) */
const GEMINI_IMAGE_MODELS = GEMINI_IMAGE_MODEL_REGISTRY.map(r => r.model)

/** model ID → codename 역참조 */
function getCodename(model) {
  return GEMINI_IMAGE_MODEL_REGISTRY.find(r => r.model === model)?.codename ?? model
}

// ────────────────────────────────────────────────────────────────
//  실제 사용 가능한 Gemini 이미지 모델 목록 조회
//  GET /v1/models 로 전체 모델 목록을 가져와
//  이미지 생성 관련 모델만 필터링해서 반환
// ────────────────────────────────────────────────────────────────
export async function discoverGeminiImageModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
  console.log('[Discover] ▶ 모델 목록 조회 시작')
  console.log('[Discover] url:', url.replace(apiKey, maskKey(apiKey)))

  try {
    const res = await fetch(url, { method: 'GET' })
    console.log('[Discover] status:', res.status)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[Discover] 오류:', JSON.stringify(err))
      return { ok: false, error: err?.error?.message ?? `HTTP ${res.status}`, all: [], imageModels: [] }
    }

    const data   = await res.json()
    const all    = data.models ?? []
    console.log('[Discover] 전체 모델 수:', all.length)

    // 이미지 생성 관련 필터: 이름/description/supportedMethods 기준
    const imageModels = all.filter(m => {
      const name    = (m.name ?? '').toLowerCase()
      const display = (m.displayName ?? '').toLowerCase()
      const desc    = (m.description ?? '').toLowerCase()
      const methods = m.supportedGenerationMethods ?? []
      return name.includes('image') || name.includes('imagen') ||
             display.includes('image') || display.includes('imagen') ||
             desc.includes('image generation') ||
             methods.includes('generateImage') || methods.includes('predict')
    })

    console.log('[Discover] 이미지 관련 모델:')
    imageModels.forEach(m => {
      console.log(`[Discover]   name: ${m.name}`)
      console.log(`[Discover]   displayName: ${m.displayName}`)
      console.log(`[Discover]   supportedMethods: ${(m.supportedGenerationMethods ?? []).join(', ')}`)
    })
    if (imageModels.length === 0) {
      console.warn('[Discover] ⚠ 이미지 생성 모델이 목록에 없습니다')
      console.log('[Discover] 전체 모델 이름 목록:')
      all.forEach(m => console.log(`[Discover]   ${m.name}`))
    }

    return { ok: true, all, imageModels }
  } catch (e) {
    console.error('[Discover] 네트워크 오류:', e.message)
    return { ok: false, error: e.message, all: [], imageModels: [] }
  }
}

/**
 * 단일 Gemini 모델로 이미지 생성 시도
 * 성공: dataUrl 반환
 * 실패: errorKind + rawError 가 달린 Error throw
 */
export async function callGeminiNativeModel(prompt, apiKey, model) {
  const codename = getCodename(model)
  const API_VER  = 'v1beta'
  const url      = `https://generativelanguage.googleapis.com/${API_VER}/models/${model}:generateContent?key=${apiKey}`

  console.log(`[Gemini] ${'─'.repeat(56)}`)
  console.log(`[Gemini] selected label  : ${codename}`)
  console.log(`[Gemini] actual model id : ${model}`)
  console.log(`[Gemini] api version     : ${API_VER}`)
  console.log(`[Gemini] request url     : ${url.replace(apiKey, maskKey(apiKey))}`)
  console.log(`[Gemini] key             : ${maskKey(apiKey)}`)
  console.log(`[Gemini] prompt (앞120)  : ${prompt.slice(0, 120)}`)

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  }
  console.log(`[Gemini] request body    :`, JSON.stringify(body))

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  console.log(`[Gemini] response status : ${res.status}`)

  if (!res.ok) {
    // raw 본문 전체 출력 (잘림 없음)
    const rawText = await res.text().catch(() => '')
    console.error(`[Gemini] error body (full) :`)
    console.error(rawText)

    let err = {}
    try { err = JSON.parse(rawText) } catch (_) {}
    const apiMsg   = err?.error?.message ?? rawText.slice(0, 200)
    const apiCode  = err?.error?.code ?? res.status
    const apiStatus = err?.error?.status ?? ''

    console.error(`[Gemini] error.code    : ${apiCode}`)
    console.error(`[Gemini] error.status  : ${apiStatus}`)
    console.error(`[Gemini] error.message : ${apiMsg}`)

    // 원인 분류
    if (isAuthError(res.status, apiMsg)) {
      throw Object.assign(new Error(`Gemini API 키가 유효하지 않습니다.`), { errorKind: 'auth', rawError: apiMsg })
    }
    if (res.status === 404 || apiStatus === 'NOT_FOUND' || apiMsg.toLowerCase().includes('not found')) {
      throw Object.assign(
        new Error(`모델명을 찾지 못했습니다 — ${model} (${res.status})`),
        { errorKind: 'model_not_found', rawError: apiMsg }
      )
    }
    if (apiStatus === 'INVALID_ARGUMENT' || apiMsg.toLowerCase().includes('not support') || apiMsg.toLowerCase().includes('modality')) {
      throw Object.assign(
        new Error(`이미지 생성 엔드포인트가 아닙니다 — 이 모델은 IMAGE modality 미지원 (${model})`),
        { errorKind: 'not_image_model', rawError: apiMsg }
      )
    }
    if (res.status === 403 || apiStatus === 'PERMISSION_DENIED') {
      throw Object.assign(
        new Error(`Gemini 이미지 생성 권한이 없습니다 (403) — API 활성화 또는 결제 필요`),
        { errorKind: 'permission', rawError: apiMsg }
      )
    }
    throw Object.assign(
      new Error(`Gemini 이미지 생성 응답 형식이 예상과 다릅니다 (${res.status}) — ${apiMsg.slice(0, 100)}`),
      { errorKind: 'unknown', rawError: apiMsg }
    )
  }

  // ── 성공 응답 파싱 ────────────────────────────────────────────
  const rawText = await res.text().catch(() => '{}')
  console.log(`[Gemini] raw response (full):`)
  console.log(rawText)

  let data = {}
  try { data = JSON.parse(rawText) } catch (_) {
    throw Object.assign(
      new Error(`Gemini 이미지 생성 응답 형식이 예상과 다릅니다 — JSON 파싱 실패`),
      { errorKind: 'parse' }
    )
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? []
  console.log(`[Gemini] parts count     : ${parts.length}`)
  parts.forEach((p, i) => {
    console.log(`[Gemini] parts[${i}] keys  : ${Object.keys(p).join(', ')}`)
    if (p.inlineData) {
      console.log(`[Gemini] parts[${i}] mimeType : ${p.inlineData.mimeType}`)
      console.log(`[Gemini] parts[${i}] data len : ${p.inlineData.data?.length ?? 0}`)
    }
    if (p.text) console.log(`[Gemini] parts[${i}] text  : ${p.text.slice(0, 80)}`)
  })

  // inlineData 이미지 추출
  const imagePart = parts.find(p => p.inlineData?.data)
  if (imagePart) {
    const { mimeType, data: b64 } = imagePart.inlineData
    const dataUrl = `data:${mimeType};base64,${b64}`
    console.log(`[Gemini] extracted image data : mimeType=${mimeType} / length=${dataUrl.length}`)
    console.log(`[Gemini] render src prepared  : ${dataUrl.slice(0, 60)}`)
    return dataUrl
  }

  // 이미지 없음 — 텍스트만 있거나 빈 응답
  const textPart = parts.find(p => p.text)
  if (textPart) {
    throw Object.assign(
      new Error(`응답에서 이미지 데이터를 찾지 못했습니다 — 텍스트만 반환됨: "${textPart.text.slice(0, 60)}"`),
      { errorKind: 'not_image_model' }
    )
  }
  throw Object.assign(
    new Error(`응답에서 이미지 데이터를 찾지 못했습니다 — parts가 비어 있거나 inlineData 없음`),
    { errorKind: 'no_image_data' }
  )
}

/**
 * GEMINI_IMAGE_MODELS 목록을 순서대로 시도 — 첫 성공 반환
 * 반환: { dataUrl, model, codename }
 */
async function callGeminiNative(prompt, apiKey) {
  const errors = []
  for (const model of GEMINI_IMAGE_MODELS) {
    const codename = getCodename(model)
    try {
      const dataUrl = await callGeminiNativeModel(prompt, apiKey, model)
      console.log(`[Gemini] ✅ 성공 — model: ${model} (${codename})`)
      return { dataUrl, model, codename }
    } catch (e) {
      if (e.errorKind === 'auth' || e.errorKind === 'permission') throw e
      console.warn(`[Gemini] ✗ ${codename} — ${e.errorKind}: ${e.message.slice(0, 80)}`)
      errors.push({ model, codename, kind: e.errorKind, msg: e.message })
    }
  }

  const summary = errors.map(e => `  • ${e.codename}: ${e.msg.slice(0, 80)}`).join('\n')
  throw Object.assign(
    new Error(`모든 Gemini 이미지 모델 실패\n${summary}`),
    { errorKind: 'all_failed', errors }
  )
}

// ────────────────────────────────────────────────────────────────
//  Imagen 3 — 보조 옵션
//  (권한/지역 제한으로 막힐 수 있으므로 native 실패 후 선택적 시도)
//  모델: imagen-3.0-generate-002
//  엔드포인트: v1beta predict
// ────────────────────────────────────────────────────────────────
async function callImagen3(prompt, apiKey) {
  const MODEL   = 'imagen-3.0-generate-002'
  const API_VER = 'v1beta'
  const url     = `https://generativelanguage.googleapis.com/${API_VER}/models/${MODEL}:predict?key=${apiKey}`

  console.log(`[Imagen3] ─── Imagen 3 시도`)
  console.log(`[Imagen3] selected model  :`, MODEL)
  console.log(`[Imagen3] request url     :`, url.replace(apiKey, maskKey(apiKey)))

  const body = {
    instances:  [{ prompt }],
    parameters: { sampleCount: 1, outputMimeType: 'image/jpeg' },
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  console.log(`[Imagen3] response status :`, res.status)

  if (!res.ok) {
    const err    = await res.json().catch(() => ({}))
    console.error(`[Imagen3] raw response    :`, JSON.stringify(err))
    const apiMsg = err?.error?.message ?? ''
    if (isAuthError(res.status, apiMsg)) {
      throw Object.assign(new Error(`Gemini API 키 오류`), { errorKind: 'auth' })
    }
    throw Object.assign(
      new Error(`Imagen 3: ${apiMsg || classifyHttpError(res.status, 'Imagen3')}`),
      { errorKind: isModelNotFoundError(res.status, apiMsg) ? 'model' : 'unknown' }
    )
  }

  const data    = await res.json()
  console.log(`[Imagen3] raw response    :`, JSON.stringify(data).slice(0, 400))
  const pred    = data?.predictions?.[0]
  if (!pred)    throw new Error('[Imagen3] predictions[0] 없음')
  const b64     = pred.bytesBase64Encoded ?? pred.imageBytes
  const mime    = pred.mimeType ?? 'image/jpeg'
  if (!b64)     throw new Error('[Imagen3] base64 이미지 데이터 없음')

  const dataUrl = `data:${mime};base64,${b64}`
  console.log(`[Imagen3] extracted image :`, mime, '/ length:', dataUrl.length)
  console.log(`[Imagen3] render src prep :`, dataUrl.slice(0, 60))
  return dataUrl
}

// ────────────────────────────────────────────────────────────────
//  Gemini 진입점
//  1순위: native Gemini image generation (2.5 → 2.0 순서 시도)
//  2순위: Imagen 3 (보조 — 실패해도 전체 흐름 종료 안 함)
// ────────────────────────────────────────────────────────────────
export async function callGemini(prompt, apiKey) {
  const tryOrder = GEMINI_IMAGE_MODEL_REGISTRY.map(r => `${r.codename}(${r.model})`).join(' → ')
  console.log('[Gemini] ══════════════════════════════════════════')
  console.log('[Gemini] 이미지 생성 시작')
  console.log('[Gemini] key:', maskKey(apiKey))
  console.log('[Gemini] 시도 순서:', tryOrder, '→ Imagen3(보조)')
  console.log('[Gemini] ══════════════════════════════════════════')

  // ── 1순위: native Gemini image models (Nano Banana 2 → fallback) ──
  let nativeErr = null
  try {
    const { dataUrl, model, codename } = await callGeminiNative(prompt, apiKey)
    console.log(`[Gemini] ✅ 최종 성공 — ${codename} (${model})`)
    console.log('[Gemini] extracted image data — length:', dataUrl.length)
    console.log('[Gemini] render src prepared  :', dataUrl.slice(0, 60))
    return dataUrl
  } catch (e) {
    if (e.errorKind === 'auth') throw e
    nativeErr = e
    console.warn('[Gemini] native 전체 실패, Imagen 3 보조 시도...')
    console.warn('[Gemini] 오류:', e.message.slice(0, 200))
  }

  // ── 2순위: Imagen 3 (보조 — 권한/지역 차이로 막힐 수 있음) ────
  try {
    const dataUrl = await callImagen3(prompt, apiKey)
    console.log('[Gemini] ✅ Imagen 3 보조 성공')
    console.log('[Gemini] extracted image data — length:', dataUrl.length)
    console.log('[Gemini] render src prepared  :', dataUrl.slice(0, 60))
    return dataUrl
  } catch (imagenErr) {
    if (imagenErr.errorKind === 'auth') throw imagenErr
    console.error('[Gemini] Imagen 3도 실패:', imagenErr.message)
    throw new Error(
      `${GEMINI_PRIMARY_CODENAME} 이미지 생성 모델 설정 오류\n` +
      `시도: ${GEMINI_IMAGE_MODEL_REGISTRY.map(r => r.codename).join(', ')}, Imagen3\n` +
      `자세한 내용은 콘솔 [Gemini] 로그를 확인하세요.`
    )
  }
}

// ────────────────────────────────────────────────────────────────
//  테스트 이미지 (API 키 없을 때)
// ────────────────────────────────────────────────────────────────
export function generateTestImage(seed = '') {
  const hue  = (seed.charCodeAt(0) * 47 + seed.length * 13) % 360
  const hue2 = (hue + 60) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <radialGradient id="rg" cx="50%" cy="40%" r="70%">
        <stop offset="0%"   stop-color="hsl(${hue},38%,28%)"/>
        <stop offset="100%" stop-color="hsl(${hue2},22%,9%)"/>
      </radialGradient>
      <radialGradient id="rg2" cx="80%" cy="20%" r="40%">
        <stop offset="0%"   stop-color="hsl(${(hue+120)%360},50%,40%)" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#rg)"/>
    <rect width="1024" height="1024" fill="url(#rg2)"/>
    <text x="512" y="496" text-anchor="middle" dominant-baseline="middle"
          font-size="18" fill="rgba(255,255,255,0.35)"
          font-family="monospace" letter-spacing="8">TEST MODE</text>
    <text x="512" y="530" text-anchor="middle" dominant-baseline="middle"
          font-size="13" fill="rgba(255,255,255,0.18)"
          font-family="monospace" letter-spacing="3">API 키 없이 생성된 샘플</text>
  </svg>`
  console.log('[generateImage] 테스트 이미지 생성 (seed:', seed, ')')
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ────────────────────────────────────────────────────────────────
//  캐릭터 DNA → 프롬프트
// ────────────────────────────────────────────────────────────────
export function buildCharacterPrompt(char) {
  const { dna } = char
  const parts   = ['cinematic portrait']
  if (dna.nationality) parts.push(dna.nationality)
  const ag = [dna.age, dna.gender].filter(Boolean).join(' ')
  if (ag)           parts.push(ag)
  if (dna.face)     parts.push(dna.face)
  if (dna.eyes)     parts.push(dna.eyes)
  if (dna.hair)     parts.push(dna.hair)
  if (dna.build)    parts.push(dna.build)
  if (dna.style)    parts.push(`wearing ${dna.style}`)
  if (dna.personality) parts.push(dna.personality.slice(0, 40))
  parts.push('photorealistic, high detail, cinematic lighting, dark background')
  return parts.join(', ')
}

// ────────────────────────────────────────────────────────────────
//  공통 생성 래퍼
//  provider: 'openai' | 'gemini'
// ────────────────────────────────────────────────────────────────
export async function generateImage(prompt, apiKey, testSeed = '', provider = 'openai') {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('[generateImage] provider:', provider, '/ apiKey 있음:', !!apiKey)
  console.log('[generateImage] prompt 길이:', prompt.length)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (apiKey) {
    if (provider === 'gemini') {
      const result = await callGemini(prompt, apiKey)
      console.log('[generateImage] ✅ Gemini 완료 — 최종 길이:', result.length)
      console.log('[generateImage] 렌더링 img src 시작:', result.slice(0, 60))
      return result
    }

    const result = await callDallE(prompt, apiKey)
    console.log('[generateImage] ✅ OpenAI 완료 — 최종 길이:', result.length)
    console.log('[generateImage] 렌더링 img src 시작:', result.slice(0, 60))
    return result
  }

  // 테스트 모드
  console.log('[generateImage] API 키 없음 — 테스트 모드 (0.9s 딜레이)')
  await new Promise((r) => setTimeout(r, 900))
  const testResult = generateTestImage(testSeed || prompt.slice(0, 10))
  console.log('[generateImage] ✅ 테스트 이미지 반환 — 길이:', testResult.length)
  return testResult
}

// ────────────────────────────────────────────────────────────────
//  Gemini 생성 단계별 디버그 함수
//  각 모델을 독립적으로 테스트하고 상세 결과를 반환
//
//  반환 형식:
//  {
//    imagen3:      { status:'success'|'failed'|'skipped', httpStatus, errorKind, msg, image }
//    flashPreview: { status:'success'|'failed'|'skipped', httpStatus, errorKind, msg, image }
//    flashExp:     { status:'success'|'failed'|'skipped', httpStatus, errorKind, msg, image }
//  }
// ────────────────────────────────────────────────────────────────
export async function debugGeminiImageGen(apiKey) {
  const TEST_PROMPT = 'a simple red circle on white background, minimal'
  const results     = {}

  console.log('[DEBUG] ══════════════════════════════════════════════')
  console.log('[DEBUG] Gemini 이미지 생성 단계별 디버그 시작')
  console.log('[DEBUG] key:', maskKey(apiKey))
  console.log('[DEBUG] test prompt:', TEST_PROMPT)
  console.log('[DEBUG] 시도 모델:')
  GEMINI_IMAGE_MODEL_REGISTRY.forEach((r, i) => console.log(`[DEBUG]   ${i+1}. ${r.codename} — ${r.model}`))
  console.log(`[DEBUG]   ${GEMINI_IMAGE_MODEL_REGISTRY.length + 1}. Imagen3 — imagen-3.0-generate-002`)
  console.log('[DEBUG] ══════════════════════════════════════════════')

  // ── STEP 1~N: native Gemini 모델 각각 개별 테스트 ────────────
  for (let i = 0; i < GEMINI_IMAGE_MODEL_REGISTRY.length; i++) {
    const { model, codename } = GEMINI_IMAGE_MODEL_REGISTRY[i]
    console.log(`[DEBUG] ─── STEP ${i + 1}: ${codename} (${model})`)
    try {
      const image = await callGeminiNativeModel(TEST_PROMPT, apiKey, model)
      results[model] = { status: 'success', model, codename, image, msg: '성공' }
      console.log(`[DEBUG] ${codename} ✅ 성공 — image 길이:`, image.length)
    } catch (e) {
      results[model] = { status: 'failed', model, codename, errorKind: e.errorKind ?? 'unknown', msg: e.message, image: null }
      console.error(`[DEBUG] ${codename} ❌ 실패 — errorKind:`, e.errorKind, '/', e.message.slice(0, 100))
    }
  }

  // ── 마지막: Imagen 3 ─────────────────────────────────────────
  const imgStep = GEMINI_IMAGE_MODEL_REGISTRY.length + 1
  console.log(`[DEBUG] ─── STEP ${imgStep}: imagen-3.0-generate-002`)
  try {
    const image = await callImagen3(TEST_PROMPT, apiKey)
    results.imagen3 = { status: 'success', model: 'imagen-3.0-generate-002', image, msg: '성공' }
    console.log('[DEBUG] Imagen 3 ✅ 성공 — image 길이:', image.length)
  } catch (e) {
    results.imagen3 = { status: 'failed', model: 'imagen-3.0-generate-002', errorKind: e.errorKind ?? 'unknown', msg: e.message, image: null }
    console.error('[DEBUG] Imagen 3 ❌ 실패 — errorKind:', e.errorKind, '/', e.message.slice(0, 100))
  }

  // ── 최종 요약 ─────────────────────────────────────────────
  console.log('[DEBUG] ══════════════════════════════════════════════')
  console.log('[DEBUG] 최종 결과 요약:')
  Object.values(results).forEach(r => {
    console.log(`[DEBUG]  ${r.model.padEnd(48)} : ${r.status} / ${r.errorKind ?? '-'}`)
  })
  const anySuccess = Object.values(results).some(r => r.status === 'success')
  console.log('[DEBUG]  이미지 생성 성공:', anySuccess ? '✅ 하나 이상 성공' : '❌ 전체 실패')
  console.log('[DEBUG] ══════════════════════════════════════════════')

  return results
}
