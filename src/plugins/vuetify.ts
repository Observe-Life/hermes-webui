import { createVuetify } from 'vuetify'
import 'vuetify/styles'

export default createVuetify({
  theme: {
    defaultTheme: 'paper',
    themes: {
      paper: {
        dark: false,
        colors: {
          background: '#ffffff',
          surface: '#f6f5f4',
          primary: '#0075de',
          secondary: '#005bab',
          'warm-ink': 'rgba(0,0,0,0.95)',
          'warm-sub': '#615d59',
          'warm-mut': '#a39e98',
          'warm-line': 'rgba(0,0,0,0.1)',
          'badge-bg': '#f2f9ff',
          'badge-ink': '#097fe8',
          success: '#1aae39',
          warning: '#dd5b00'
        }
      }
    }
  },
  defaults: {
    VBtn: { rounded: 'lg', variant: 'flat' }
  }
})
