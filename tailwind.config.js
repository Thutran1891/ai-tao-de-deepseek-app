/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: '#2563eb',   // Xanh chủ đạo (Nút bấm, tiêu đề)
          success: '#22c55e',   // Xanh lá (Thông báo đúng)
          error: '#ef4444',     // Đỏ (Thông báo sai)
          surface: '#f8fafc',   // Màu nền
        }
      },
    },
    plugins: [],
  }