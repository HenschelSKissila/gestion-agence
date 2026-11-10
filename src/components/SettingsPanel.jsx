import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, LogOut, Save } from 'lucide-react';
import { fileToLogo } from '../lib/settings';

const BANKS = [['n26', 'N26'], ['sparkasse', 'Sparkasse Bremen'], ['commerzbank', 'Commerzbank'], ['wise', 'Wise']];
const shown = v => (typeof v === 'number' ? Math.round(v * 100) / 100 : v ?? '');

export default function SettingsPanel({ settings, email, online, onSave, onRefresh, onInstall, onSignOut }) {
  const [s, setS] = useState(settings);
  useEffect(() => setS(settings), [settings]);
  const set = (k, v) => setS(x => ({ ...x, [k]: v }));
  const numField = (k, label, extra = {}) => (
    <label key={k}>{label}
      <input type="number" step="0.01" min="0" inputMode="decimal" value={shown(s[k])} onChange={e => set(k, e.target.value)} {...extra} />
    </label>
  );

  return (
    <form className="settings" onSubmit={e => { e.preventDefault(); onSave(s); }}>
      <section className="panel">
        <span className="eyebrow">Agence</span><h2>Identité et règles</h2>
        <div className="form-grid">
          <label>Nom de l’agence<input value={s.agencyName} onChange={e => set('agencyName', e.target.value)} /></label>
          {numField('pct_refus', 'Taux gardé sur un refus (%)', { max: '100' })}
          {numField('fraisBancairesCompteBloqueVisa', 'Frais par compte bloqué visa (€)')}
          <label>Logo (PNG, JPEG ou SVG)
            <input type="file" accept="image/*,.svg" onChange={e => { const f = e.target.files?.[0]; if (f) fileToLogo(f).then(logo => set('logo', logo)).catch(() => {}); }} />
          </label>
        </div>
        {s.logo && <div className="logo-row"><img className="preview-logo" src={s.logo} alt="Aperçu du logo" /><button type="button" className="btn ghost" onClick={() => set('logo', '')}>Retirer le logo</button></div>}
      </section>

      <section className="panel">
        <span className="eyebrow">Trésorerie</span><h2>Soldes bancaires</h2>
        <div className="form-grid">{BANKS.map(([k, label]) => numField(k, label))}</div>
      </section>

      <section className="panel">
        <span className="eyebrow">Associés</span><h2>Investissements et parts</h2>
        {[1, 2].map(i => (
          <div className="form-grid three" key={i}>
            <label>Nom associé {i}<input value={s[`associe${i}Nom`]} onChange={e => set(`associe${i}Nom`, e.target.value)} /></label>
            {numField(`associe${i}Investissement`, 'Investissement de départ (€)')}
            {numField(`associe${i}Part`, 'Part (%)')}
          </div>
        ))}
      </section>

      <div className="save-bar">
        <span className="muted">{online ? 'Enregistré dans Supabase et partagé entre vos appareils.' : 'Hors ligne : envoi automatique au retour de la connexion.'}</span>
        <button className="btn primary"><Save size={16} /> Enregistrer</button>
      </div>

      <section className="panel">
        <span className="eyebrow">Compte</span><h2>Application</h2>
        {email && <p className="muted">Connecté en tant que <b>{email}</b></p>}
        <div className="button-row">
          <button type="button" className="btn secondary" onClick={onRefresh}><RefreshCw size={16} /> Vérifier la base</button>
          {onInstall && <button type="button" className="btn secondary" onClick={onInstall}><Download size={16} /> Installer l’application</button>}
          <button type="button" className="btn danger" onClick={onSignOut}><LogOut size={16} /> Déconnexion</button>
        </div>
        <p className="footnote"><b>iPhone / iPad :</b> ouvrir dans Safari, toucher Partager puis « Sur l’écran d’accueil ».</p>
      </section>
    </form>
  );
}
