import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'
import App from './App.jsx'

// FORCE UNREGISTER ALL SERVICE WORKERS (Cache Busting)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('UNREGISTERED SERVICE WORKER!');
    }
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
