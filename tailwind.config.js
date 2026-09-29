// Tailwind собирается заранее в public/css/tailwind.css (npm run build:css).
// Раньше стили компилировались прямо в браузере через cdn.tailwindcss.com — на каждое
// обновление экрана, что заметно тормозило слабые устройства.
// После правки классов в public/**/*.js или *.html пересоберите CSS.
module.exports = {
    content: ['./public/**/*.html', './public/**/*.js'],
    theme: {
        extend: {
            colors: {
                'corp': {
                    'black': '#0a0a0a',
                    'dark': '#141414',
                    'graphite': '#1e1e1e',
                    'card': '#252525',
                    'border': '#2e2e2e',
                    'muted': '#8a8a9a',
                    'dim': '#b0b0c0',
                    'text': '#d4d4e0',
                    'light': '#ededf5',
                    'white': '#f5f5f0',
                },
                'accent': {
                    'brand': '#ffc72c',
                    'blue': '#00b4ff',
                    'blue-dim': 'rgba(0, 180, 255, 0.12)',
                    'blue-glow': 'rgba(0, 180, 255, 0.4)',
                    'cyan': '#22d3ee',
                    'red': '#ff3b3b',
                    'red-dim': 'rgba(255, 59, 59, 0.15)',
                    'gold': '#ffd700',
                    'gold-dim': 'rgba(255, 215, 0, 0.12)',
                    'green': '#22c55e',
                    'green-dim': 'rgba(34, 197, 94, 0.12)',
                },
            },
            fontFamily: {
                'display': ['Montserrat', 'Inter', 'sans-serif'],
                'body': ['Inter', 'system-ui', 'sans-serif'],
                'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease forwards',
                'slide-up': 'slideUp 0.6s ease forwards',
                'glow-pulse': 'glowPulse 2s ease-in-out infinite',
                'card-deal': 'cardDeal 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                'float': 'float 6s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(40px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                glowPulse: {
                    '0%, 100%': { boxShadow: '0 0 5px rgba(0,180,255,0.2)' },
                    '50%': { boxShadow: '0 0 25px rgba(0,180,255,0.5), 0 0 50px rgba(0,180,255,0.2)' },
                },
                cardDeal: {
                    '0%': { opacity: '0', transform: 'translateY(-80px) rotateX(40deg) scale(0.8)' },
                    '100%': { opacity: '1', transform: 'translateY(0) rotateX(0deg) scale(1)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
            },
        },
    },
    plugins: [],
};
