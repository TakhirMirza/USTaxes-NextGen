import React from 'react'
import ReactDOM from 'react-dom'
import { HashRouter } from 'react-router-dom'
import NextGenAppRouter from './components/NextGenAppRouter'
import './standalone.css'
ReactDOM.render(<React.StrictMode><HashRouter><NextGenAppRouter /></HashRouter></React.StrictMode>, document.getElementById('root'))
