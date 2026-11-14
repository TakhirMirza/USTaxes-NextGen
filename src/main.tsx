import React from 'react'
import ReactDOM from 'react-dom'
import { HashRouter } from 'react-router-dom'
import App from './app/App'
import '@fontsource/public-sans/400.css'
import '@fontsource/public-sans/500.css'
import '@fontsource/public-sans/600.css'
import '@fontsource/public-sans/700.css'
import '@fontsource/public-sans/800.css'
import '@fontsource/public-sans/400-italic.css'

ReactDOM.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
  document.getElementById('root')
)

// Keep a copy of the app and the IRS forms on this device so it works offline (published site only).
if ('serviceWorker' in navigator && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => undefined) })
}
