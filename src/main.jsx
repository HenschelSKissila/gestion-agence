import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const SW_VERSION = '4.8.0';

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  const reloadOnce = () => {
    if (!hadController || reloaded || sessionStorage.getItem(`sw-reloaded-${SW_VERSION}`)) return;
    reloaded = true;
    sessionStorage.setItem(`sw-reloaded-${SW_VERSION}`, '1');
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
  navigator.serviceWorker.register('/sw.js').then(registration => {
    const checkForUpdate = () => registration.update().catch(() => {});
    checkForUpdate();
    window.setInterval(checkForUpdate, 60_000);
    window.addEventListener('focus', checkForUpdate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          worker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  }).catch(() => {});
}

createRoot(document.getElementById('root')).render(<App />);
registerServiceWorker();
