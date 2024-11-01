import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import { Provider } from 'react-redux'
import { detectionstore } from './features/detection/detectionStore'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider store={detectionstore}>
      <App />
    </Provider>
  </React.StrictMode>
)
