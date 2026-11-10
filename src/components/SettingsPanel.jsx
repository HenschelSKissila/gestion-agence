import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, LogOut, Save, UserPlus, Trash2 } from 'lucide-react';
import { fileToLogo } from '../lib/settings';

const BANKS = [['n26', 'N26'], ['sparkasse', 'Sparkasse Bremen'], ['commerzbank', 'Commerzbank'], ['wise', 'Wise']];
const shown = v => (typeof v === 'number' ? Math.round(v * 100) / 100 : v ?? '');

function Sharing({ workspace, uid, email, onSwitch, onShare, onUnshare }) {
  const [invite, setInvite] = useState('');
  const [edit, setEdit] = useState(true);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    if (await onShare(invite, edit)) setInvite('');
    setBusy(false);
  }
  return (
    <section className="panel">
      <span className="eyebrow">Partage</span><h2>Accès de l’associé</h2>

      {workspace.shared.length > 0 && (
        <div className="chips spaced" role="group" aria-label="Agence affichée">
          <button type="button" className={workspace.own ? 'chip active' : 'chip'} onClick={() => onSwitch(uid)}>Mon agence</button>
          {workspace.shared.map(s => (
            <button type="button" key={s.owner_id} className={workspace.id === s.owner_id ? 'chip active' : 'chip'} onClick={() => onSwitch(s.owner_id)}>Agence de {s.owner_email}</button>
          ))}
        </div>
      )}

      {!workspace.own ? (
        <p className="muted">Vous consultez l’agence de <b>{workspace.ownerEmail}</b> {workspace.canEdit ? 'avec le droit de modifier.' : 'en lecture seule.'}</p>
      ) : (
        <>
          <p className="muted">Invitez votre associé avec l’email de <b>son</b> compte : il se connecte avec ses propres identifiants et voit les mêmes données que vous.</p>
          {workspace.members.length > 0 && (
            <ul className="member-list">
              {workspace.members.map(m => (
                <li key={m.member_email}>
                  <span><b>{m.member_email}</b><small>{m.peut_modifier ? 'Peut modifier' : 'Lecture seule'}</small></span>
                  <button type="button" className="icon-btn danger" onClick={() => onUnshare(m.member_email)} aria-label={`Retirer l’accès de ${m.member_email}`}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )}
          <form className="invite" onSubmit={submit}>
            <label>Email de l’associé
              <input type="email" required value={invite} onChange={e => setInvite(e.target.value)} placeholder="associe@exemple.com" />
            </label>
            <label className="check"><input type="checkbox" checked={edit} onChange={e => setEdit(e.target.checked)} /> Peut modifier</label>
            <button className="btn secondary" disabled={busy || invite.trim().toLowerCase() === (email || '').toLowerCase()}><UserPlus size={16} /> Inviter</button>
          </form>
        </>
      )}
    </section>
  );
}

export default function SettingsPanel({ settings, email, online, workspace, uid, onSave, onRefresh, onInstall, onSignOut, onSwitch, onShare, onUnshare }) {
  const [s, setS] = useState(settings);
  useEffect(() => setS(settings), [settings]);
  const locked = !workspace.canEdit;
  const set = (k, v) => setS(x => ({ ...x, [k]: v }));
  const numField = (k, label, extra = {}) => (
    <label key={k}>{label}
      <input type="number" step="0.01" min="0" inputMode="decimal" value={shown(s[k])} onChange={e => set(k, e.target.value)} {...extra} />
    </label>
  );

  return (
    <div className="settings">
      <form onSubmit={e => { e.preventDefault(); onSave(s); }}>
        <fieldset disabled={locked}>
          <section className="panel">
            <span className="eyebrow">Agence</span><h2>Identité et règles</h2>
            <div className="form-grid">
              <label>Nom de l’agence<input value={s.agencyName} onChange={e => set('agencyName', e.target.value)} /></label>
              {numField('pct_refus', 'Taux gardé sur un refus (%)', { max: '100' })}
              {numField('fraisBancairesCompteBloqueVisa', 'Frais par compte bloqué visa (€)')}
              <label>Logo (PNG, JPEG ou SVG)
                <input type="file" accept="image/*,.svg" onChange={e => { const f = e.target.files?.[0]; if (f) fileToLogo(f).then(logo => set('logo', logo)).catch(() => {}); }} />
              </label>
              <label className="check full"><input type="checkbox" checked={s.commissionSurRefus !== false} onChange={e => set('commissionSurRefus', e.target.checked)} /> La commission du démarcheur est due aussi en cas de refus</label>
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
        </fieldset>

        <div className="save-bar">
          <span className="muted">{locked ? 'Lecture seule : seul le propriétaire peut modifier ces paramètres.' : online ? 'Enregistré dans Supabase et partagé entre vos appareils.' : 'Hors ligne : envoi automatique au retour de la connexion.'}</span>
          {!locked && <button className="btn primary"><Save size={16} /> Enregistrer</button>}
        </div>
      </form>

      <Sharing workspace={workspace} uid={uid} email={email} onSwitch={onSwitch} onShare={onShare} onUnshare={onUnshare} />

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
    </div>
  );
}
