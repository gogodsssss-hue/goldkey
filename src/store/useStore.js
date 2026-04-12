import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const EMPTY_DNA = {
  gender: '',
  age: '',
  nationality: '',
  face: '',
  hair: '',
  eyes: '',
  build: '',
  style: '',
  personality: '',
  traits: '',
  notes: '',
}

const makeCharacter = (name) => ({
  id: crypto.randomUUID(),
  name,
  starred: false,
  dna: { ...EMPTY_DNA },
  prompts: [],        // [{ id, version, text, createdAt }]
  images: [],         // [{ id, name, dataUrl, note }]
  crefLinks: [],      // [{ id, url, note, createdAt }]
  createdAt: Date.now(),
})

export const useStore = create(
  persist(
    (set, get) => ({
      // 대본
      scriptText: '',
      setScriptText: (text) => set({ scriptText: text }),

      // 캐릭터 목록
      characters: [],
      selectedId: null,

      // 캐릭터 선택
      selectCharacter: (id) => set({ selectedId: id }),

      // 대본 파싱 결과로 캐릭터 추가 (기존 이름 유지)
      importCharacters: (names) => {
        const { characters } = get()
        const existing = new Set(characters.map((c) => c.name.trim().toLowerCase()))
        const newChars = names
          .filter((n) => !existing.has(n.trim().toLowerCase()))
          .map(makeCharacter)
        set({ characters: [...characters, ...newChars] })
      },

      // 캐릭터 수동 추가
      addCharacter: (name) => {
        const char = makeCharacter(name.trim())
        set((s) => ({
          characters: [...s.characters, char],
          selectedId: char.id,
        }))
      },

      // 캐릭터 삭제
      removeCharacter: (id) =>
        set((s) => ({
          characters: s.characters.filter((c) => c.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        })),

      // 이름 변경
      renameCharacter: (id, name) =>
        set((s) => ({
          characters: s.characters.map((c) => (c.id === id ? { ...c, name } : c)),
        })),

      // 즐겨찾기 토글
      toggleStar: (id) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === id ? { ...c, starred: !c.starred } : c
          ),
        })),

      // DNA 업데이트
      updateDna: (id, patch) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === id ? { ...c, dna: { ...c.dna, ...patch } } : c
          ),
        })),

      // 프롬프트 추가
      addPrompt: (id, text) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === id
              ? {
                  ...c,
                  prompts: [
                    ...c.prompts,
                    {
                      id: crypto.randomUUID(),
                      version: `v${c.prompts.length + 1}`,
                      text,
                      createdAt: Date.now(),
                    },
                  ],
                }
              : c
          ),
        })),

      // 프롬프트 삭제
      removePrompt: (charId, promptId) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === charId
              ? { ...c, prompts: c.prompts.filter((p) => p.id !== promptId) }
              : c
          ),
        })),

      // 프롬프트 텍스트 수정
      updatePrompt: (charId, promptId, text) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === charId
              ? {
                  ...c,
                  prompts: c.prompts.map((p) =>
                    p.id === promptId ? { ...p, text } : p
                  ),
                }
              : c
          ),
        })),

      // 이미지 추가
      addImage: (id, img) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === id ? { ...c, images: [...c.images, { id: crypto.randomUUID(), ...img }] } : c
          ),
        })),

      // 이미지 삭제
      removeImage: (charId, imgId) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === charId
              ? { ...c, images: c.images.filter((i) => i.id !== imgId) }
              : c
          ),
        })),

      // 이미지 노트 수정
      updateImageNote: (charId, imgId, note) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === charId
              ? {
                  ...c,
                  images: c.images.map((i) => (i.id === imgId ? { ...i, note } : i)),
                }
              : c
          ),
        })),

      // cref URL 추가
      addCrefLink: (charId, url, note = '') =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === charId
              ? {
                  ...c,
                  crefLinks: [
                    ...(c.crefLinks ?? []),
                    { id: crypto.randomUUID(), url, note, createdAt: Date.now() },
                  ],
                }
              : c
          ),
        })),

      // cref URL 삭제
      removeCrefLink: (charId, linkId) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === charId
              ? { ...c, crefLinks: (c.crefLinks ?? []).filter((l) => l.id !== linkId) }
              : c
          ),
        })),

      // cref URL 필드 수정 (범용 patch)
      updateCrefLink: (charId, linkId, patch) =>
        set((s) => ({
          characters: s.characters.map((c) =>
            c.id === charId
              ? {
                  ...c,
                  crefLinks: (c.crefLinks ?? []).map((l) =>
                    l.id === linkId ? { ...l, ...patch } : l
                  ),
                }
              : c
          ),
        })),

      // 전체 내보내기
      exportData: () => {
        const { scriptText, characters } = get()
        return JSON.stringify({ scriptText, characters }, null, 2)
      },

      // 전체 불러오기
      importData: (json) => {
        try {
          const data = JSON.parse(json)
          set({
            scriptText: data.scriptText || '',
            characters: data.characters || [],
            selectedId: null,
          })
          return true
        } catch {
          return false
        }
      },
    }),
    {
      name: 'irir4r-store',
    }
  )
)
