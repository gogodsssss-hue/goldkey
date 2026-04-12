/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0b1220',   // 앱 전체 배경 — 어두운 네이비
          1: '#0f1724',   // 헤더 / 하단 패널
          2: '#111827',   // 좌측 패널 배경
          3: '#162033',   // 입력 필드 / 카드 내부
          4: '#1e2d42',   // 호버 상태
        },
        canvas: '#0d1623', // 메인 캔버스 내부
        accent: {
          DEFAULT: '#7c6af7',
          hover: '#9585f9',
          muted: '#2e2866',
        },
        border: '#2a3444', // 선 — 네이비 기반, 대비 확보
        muted: '#4a5a72',
        subtle: '#7a90aa',
      },
    },
  },
  plugins: [],
}
