/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#000000',
        card:    '#1c1c1e',
        card2:   '#2c2c2e',
        border:  '#38383a',
        bull:    '#30d158',
        bear:    '#ff453a',
        neutral: '#ffd60a',
        info:    '#0a84ff',
        ai:      '#bf5af2',
        text:    '#ffffff',
        muted:   '#8e8e93',
        accent:  '#0a84ff',
        surface: '#1c1c1e',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl:    '10px',
        '2xl': '14px',
        '3xl': '20px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)',
        glow: '0 0 20px rgba(48,209,88,0.15)',
      },
      letterSpacing: {
        tight:   '-0.3px',
        tighter: '-0.5px',
      },
    }
  },
  plugins: []
}
