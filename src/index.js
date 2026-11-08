import { StrictMode } from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import * as serviceWorker from './serviceWorker'
import { BrowserRouter, HashRouter } from 'react-router-dom'

// GitHub Pages needs hash routes for deep-link refreshes.
const Router = process.env.REACT_APP_GITHUB_PAGES === 'true' ? HashRouter : BrowserRouter


import './index.css'

ReactDOM.render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
  document.getElementById('root')
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()
