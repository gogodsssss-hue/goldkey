import React, { useRef, useState } from 'react'
import { useStore } from '../../store/useStore'

export default function ImageManager({ charId, images }) {
  const addImage = useStore((s) => s.addImage)
  const removeImage = useStore((s) => s.removeImage)
  const updateImageNote = useStore((s) => s.updateImageNote)

  const fileInputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  const processFiles = (files) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (e) => {
        addImage(charId, {
          name: file.name,
          dataUrl: e.target.result,
          note: '',
        })
      }
      reader.readAsDataURL(file)
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    processFiles(e.dataTransfer.files)
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageItems = Array.from(items).filter((i) => i.type.startsWith('image/'))
    if (imageItems.length === 0) return
    imageItems.forEach((item) => {
      const file = item.getAsFile()
      if (file) processFiles([file])
    })
  }

  return (
    <div className="flex flex-col gap-4" onPaste={handlePaste}>
      {/* 드롭존 */}
      <div
        className={`
          border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
          ${dragging ? 'border-accent bg-accent/10' : 'border-border hover:border-surface-4'}
        `}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="text-2xl mb-2 opacity-40">🖼️</div>
        <p className="text-xs text-muted">
          이미지를 드래그하거나 클릭하여 업로드<br />
          <span className="text-surface-4">또는 Ctrl+V로 클립보드에서 붙여넣기</span>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => processFiles(e.target.files)}
        />
      </div>

      {/* 이미지 그리드 */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img) => (
            <div key={img.id} className="card overflow-hidden flex flex-col">
              {/* 썸네일 */}
              <div
                className="relative aspect-square overflow-hidden cursor-pointer group"
                onClick={() => setLightbox(img)}
              >
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <button
                  className="absolute top-1 right-1 bg-black/60 text-white rounded text-xs px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  onClick={(e) => { e.stopPropagation(); removeImage(charId, img.id) }}
                >
                  ✕
                </button>
              </div>

              {/* 노트 */}
              <div className="p-2">
                <input
                  className="input-base text-xs py-1"
                  placeholder="기준 이미지 메모..."
                  value={img.note || ''}
                  onChange={(e) => updateImageNote(charId, img.id, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <p className="text-xs text-muted text-center">
            캐릭터 기준 이미지를 업로드하면<br />
            미드저니 레퍼런스로 활용할 수 있습니다.
          </p>
        </div>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox.dataUrl}
              alt={lightbox.name}
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
            />
            <button
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/80"
              onClick={() => setLightbox(null)}
            >
              ✕
            </button>
            {lightbox.note && (
              <p className="mt-2 text-sm text-center text-subtle">{lightbox.note}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
