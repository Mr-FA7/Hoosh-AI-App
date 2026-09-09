import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { LocaleProvider } from './i18n/LocaleContext'
import { AuthProvider } from './auth/AuthContext'
import AuthBoundary from './auth/AuthBoundary'
import { bootstrapRuntimeAuth, installRuntimeAuthInterceptors } from './lib/runtimeBootstrap'
import './index.css'

installRuntimeAuthInterceptors()
void bootstrapRuntimeAuth()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <AuthProvider>
        <AuthBoundary>
          <App />
        </AuthBoundary>
      </AuthProvider>
    </LocaleProvider>
  </React.StrictMode>,
)
