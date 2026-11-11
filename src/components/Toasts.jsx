import React from 'react';

/** Messages temporaires, en bas de l'écran ; un appui les ferme. */
export default function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <button type="button" key={t.id} className={'toast ' + t.tone} onClick={() => onDismiss(t.id)}>{t.text}</button>
      ))}
    </div>
  );
}
