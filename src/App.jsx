import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, Settings as SettingsIcon, LogOut, Sun, Moon, Wifi, WifiOff, RefreshCw, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { totaux } from './lib/calculs';
import { newId, enqueue, applyOp, flushQueue, readQueue } from './lib/storage';
import { normalizeSettings, readLocalSettings, saveLocalSettings, pushSettings, pullSettings } from './lib/settings';
import { TABLES, EMPTY_DATA, cleanRow } from './lib/tables';
import { ownWorkspace, cachedWorkspace, resolveWorkspace, preferWorkspace, addMember, removeMember, readDataCache, writeDataCache, clearLocalData } from './lib/workspace';
import Logo from './components/Logo.jsx';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import TableView from './components/TableView.jsx';
import Editor from './components/Editor.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import Legal from './components/Legal.jsx';

const NAV = [
  ['dashboard', 'Tableau de bord', 'Accueil', LayoutDashboard],
  ...Object.entries(TABLES).map(([k, v]) => [k, v.label, v.short, v.icon]),
  ['settings', 'Paramètres', 'Réglages', SettingsIcon]
];
const TITLES = { dashboard: 'Vue d’ensemble', settings: 'Paramètres' };

export default function App() {
  const [session, setSession] = useState(null);
  const [data, setData] = useState(EMPTY_DATA);
  const [tab, setTab] = useState('dashboard');
  const [online, setOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState(null);
  const [settings, setSettings] = useState(readLocalSettings);
  const [theme, setTheme] = useState(() => localStorage.getItem('gestion-agence-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [installEvent, setInstallEvent] = useState(null);
  const [legal, setLegal] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const loadedUid = useRef(null);
  const uid = session?.user.id;
  const wid = workspace?.id;
  const canEdit = workspace?.canEdit !== false;

  const notify = (text, tone = 'pos') => setNotice({ text, tone });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('gestion-agence-theme', theme);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#0d1b22' : '#082f49');
  }, [theme]);

  useEffect(() => {
    const h = e => { e.preventDefault(); setInstallEvent(e); };
    addEventListener('beforeinstallprompt', h);
    return () => removeEventListener('beforeinstallprompt', h);
  }, []);

  // Session : un seul chargement par utilisateur (les rafraîchissements de jeton ne rechargent plus l'écran).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) { loadedUid.current = null; setData(EMPTY_DATA); setWorkspace(null); }
      else if (loadedUid.current !== s.user.id) { loadedUid.current = s.user.id; setTimeout(() => load(s.user.id), 0); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const h = () => { setOnline(navigator.onLine); if (navigator.onLine && uid) load(uid, true); };
    addEventListener('online', h); addEventListener('offline', h);
    return () => { removeEventListener('online', h); removeEventListener('offline', h); };
  }, [uid]);

  // Retour au premier plan : on récupère ce qui a été saisi sur un autre appareil.
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'visible' && navigator.onLine && uid && !modal && tab !== 'settings') load(uid, true); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [uid, modal, tab]);

  useEffect(() => {
    if (!notice || notice.tone !== 'pos') return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  // Copie locale : chaque changement des dossiers est gardé pour une ouverture sans réseau.
  useEffect(() => { if (wid && !loading) writeDataCache(wid, data); }, [wid, data, loading]);

  async function load(userId, silent = false) {
    let shown = silent;
    if (!silent) {
      // Affichage immédiat de la dernière copie locale, puis mise à jour en arrière-plan.
      const ws = cachedWorkspace(userId) || ownWorkspace(userId);
      const cached = readDataCache(ws.id);
      if (cached) { setWorkspace(ws); setData({ ...EMPTY_DATA, ...cached.data }); setLoading(false); shown = true; }
      else setLoading(true);
    }
    setRefreshing(shown);
    try {
      const q = navigator.onLine ? await flushQueue(supabase) : { kept: 0, rejected: [] };
      const ws = await resolveWorkspace(supabase, userId);
      const tables = Object.keys(EMPTY_DATA);
      const r = await Promise.all(tables.map(t => supabase.from(t).select('*').eq('user_id', ws.id)));
      const failed = r.find(x => x.error);
      if (failed) throw new Error(failed.error.message);
      setWorkspace(ws);
      setData(Object.fromEntries(tables.map((t, i) => [t, r[i].data || []])));
      const ps = await pullSettings(supabase, ws.id);
      if (ps.settings) setSettings(ps.settings);
      if (q.rejected.length) notify('Modifications hors ligne refusées par la base : ' + q.rejected[0], 'neg');
      else if (q.kept) notify(q.kept + ' modification(s) hors ligne en attente d’envoi.', 'warn');
      else if (ps.notice && ws.canEdit) notify(ps.notice, 'warn');
      else if (!silent) notify('Données à jour.');
    } catch (e) {
      setWorkspace(w => w || cachedWorkspace(userId) || ownWorkspace(userId));
      if (shown && !navigator.onLine) notify('Hors ligne : affichage des dernières données enregistrées sur cet appareil.', 'warn');
      else notify('Impossible de charger la base : ' + e.message, 'neg');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }

  async function signOut() {
    if (readQueue().length && !confirm('Des modifications hors ligne ne sont pas encore envoyées et seront perdues. Se déconnecter quand même ?')) return;
    await supabase.auth.signOut({ scope: 'local' });
    clearLocalData();
    setSettings(readLocalSettings());
  }

  function switchWorkspace(id) { preferWorkspace(id); setTab('dashboard'); load(uid, true); }

  async function shareWith(email, edit) {
    const r = await addMember(supabase, email, edit);
    if (r.error) notify('Invitation impossible : ' + r.error, 'neg');
    else { notify('Accès accordé à ' + email.trim().toLowerCase() + '.'); load(uid, true); }
    return !r.error;
  }

  async function unshare(email) {
    if (!confirm('Retirer l’accès de ' + email + ' ?')) return;
    const r = await removeMember(supabase, uid, email);
    if (r.error) notify('Retrait impossible : ' + r.error, 'neg'); else { notify('Accès retiré.'); load(uid, true); }
  }

  async function save(table, row) {
    const clean = { ...cleanRow(table, row), id: row.id || newId(), user_id: wid };
    setData(d => ({ ...d, [table]: d[table].some(x => x.id === clean.id) ? d[table].map(x => (x.id === clean.id ? clean : x)) : [...d[table], clean] }));
    setModal(null);
    const op = { table, kind: 'upsert', row: clean };
    if (!online) { enqueue(op); notify('Enregistré hors ligne ; envoi au retour de la connexion.', 'warn'); return; }
    const r = await applyOp(supabase, op);
    if (r.network) { enqueue(op); notify('Connexion instable : modification gardée en attente d’envoi.', 'warn'); }
    else if (r.error) notify('Enregistrement refusé par la base : ' + r.error, 'neg');
    else notify('Enregistré.');
  }

  async function remove(table, row) {
    if (!confirm('Supprimer cet élément ?')) return;
    setData(d => ({ ...d, [table]: d[table].filter(x => x.id !== row.id) }));
    const op = { table, kind: 'delete', row: { id: row.id } };
    if (!online) { enqueue(op); return; }
    const r = await applyOp(supabase, op);
    if (r.network) enqueue(op);
    else if (r.error) { notify('Suppression refusée par la base : ' + r.error, 'neg'); load(uid, true); }
  }

  async function saveSettings(raw) {
    const next = normalizeSettings(raw);
    setSettings(next);
    const ts = saveLocalSettings(next, wid);
    if (!online) { notify('Paramètres enregistrés sur cet appareil ; ils seront envoyés au retour de la connexion.', 'warn'); return; }
    const r = await pushSettings(supabase, wid, next, ts);
    if (r.error) notify('Paramètres enregistrés sur cet appareil seulement — synchronisation impossible : ' + r.error, 'neg');
    else notify('Paramètres enregistrés et synchronisés.');
  }

  const totals = useMemo(() => totaux({ ...data, parametres: settings }), [data, settings]);

  if (!session) return <Login settings={settings} />;
  if (loading) return <div className="loading"><RefreshCw className="spin" size={22} /> Chargement de vos données…</div>;

  return (
    <div className="app">
      <aside>
        <div className="side-brand"><Logo settings={settings} small /><b>{settings.agencyName}</b></div>
        <nav aria-label="Navigation principale">
          {NAV.map(([k, label, short, Icon]) => (
            <button className={tab === k ? 'nav active' : 'nav'} onClick={() => setTab(k)} key={k} aria-current={tab === k ? 'page' : undefined}>
              <Icon size={20} /><span className="nav-long">{label}</span><span className="nav-short">{short}</span>
            </button>
          ))}
        </nav>
        <button className="nav nav-logout" onClick={signOut}><LogOut size={20} /><span className="nav-long">Déconnexion</span></button>
      </aside>

      <main className="content">
        <header className="topbar">
          <div><span className="eyebrow">{settings.agencyName}{workspace && !workspace.own ? ` · partagé par ${workspace.ownerEmail}` : ''}</span><h1>{TITLES[tab] || TABLES[tab].label}</h1></div>
          <div className="header-actions">
            <span className={online ? 'status' : 'status off'} title={online ? 'En ligne' : 'Hors ligne'}>{online ? <Wifi size={15} /> : <WifiOff size={15} />}<span>{online ? 'En ligne' : 'Hors ligne'}</span></span>
            <button className="icon-btn" onClick={() => load(uid, true)} disabled={!online || refreshing} aria-label="Actualiser les données"><RefreshCw size={18} className={refreshing ? 'spin' : ''} /></button>
            <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </header>

        {notice && (
          <div className={'alert ' + notice.tone} role="status">
            <span>{notice.text}</span>
            <button className="alert-close" onClick={() => setNotice(null)} aria-label="Fermer le message"><X size={16} /></button>
          </div>
        )}

        {tab === 'dashboard' ? <Dashboard totals={totals} />
          : tab === 'settings' ? (
            <SettingsPanel
              settings={settings} email={session.user.email} online={online} onSave={saveSettings}
              workspace={workspace || ownWorkspace(uid)} uid={uid} onSwitch={switchWorkspace} onShare={shareWith} onUnshare={unshare}
              onRefresh={() => load(uid, true)} onSignOut={signOut}
              onInstall={installEvent ? async () => { await installEvent.prompt(); setInstallEvent(null); } : null}
            />
          ) : (
            <TableView
              key={tab} table={tab} rows={data[tab]} settings={settings} readOnly={!canEdit}
              onAdd={() => setModal({ table: tab })} onEdit={row => setModal({ table: tab, row })} onDelete={row => remove(tab, row)}
            />
          )}

        {modal && <Editor config={TABLES[modal.table]} row={modal.row} onClose={() => setModal(null)} onSave={row => save(modal.table, row)} />}

        <footer>
          © {new Date().getFullYear()} {settings.agencyName} · <button onClick={() => setLegal('privacy')}>Confidentialité</button> · <button onClick={() => setLegal('terms')}>Conditions d’utilisation</button> · v4.8
        </footer>
        {legal && <Legal type={legal} onClose={() => setLegal(null)} />}
      </main>
    </div>
  );
}
