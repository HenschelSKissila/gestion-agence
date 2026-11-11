import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, Settings as SettingsIcon, LogOut, Sun, Moon, RefreshCw } from 'lucide-react';
import { supabase } from './lib/supabase';
import { totaux } from './lib/calculs';
import { newId, enqueue, applyOp, flushQueue, readQueue } from './lib/storage';
import { normalizeSettings, readLocalSettings, saveLocalSettings, pushSettings, pullSettings } from './lib/settings';
import { TABLES, EMPTY_DATA, cleanRow } from './lib/tables';
import { gainsParMois } from './lib/stats';
import { ownWorkspace, cachedWorkspace, resolveWorkspace, preferWorkspace, addMember, removeMember, readDataCache, writeDataCache, clearLocalData } from './lib/workspace';
import { APP_NAME, APP_VERSION } from './lib/app';
import Logo from './components/Logo.jsx';
import SyncStatus from './components/SyncStatus.jsx';
import Toasts from './components/Toasts.jsx';
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
  const [toasts, setToasts] = useState([]);
  const [pending, setPending] = useState(() => readQueue().length);
  const [syncError, setSyncError] = useState('');
  const [settings, setSettings] = useState(readLocalSettings);
  const [theme, setTheme] = useState(() => localStorage.getItem('gestion-agence-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [installEvent, setInstallEvent] = useState(null);
  const [legal, setLegal] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const loadedUid = useRef(null);
  const uid = session?.user.id;
  const wid = workspace?.id;
  const canEdit = workspace?.canEdit !== false;

  // Messages brefs qui disparaissent seuls ; l'état de la synchronisation est porté par le voyant d'en-tête.
  const dismiss = id => setToasts(list => list.filter(t => t.id !== id));
  function notify(text, tone = 'pos') {
    const id = newId();
    setToasts(list => [...list.filter(t => t.text !== text).slice(-2), { id, text, tone }]);
    setTimeout(() => dismiss(id), tone === 'pos' ? 2500 : 6000);
  }
  const refreshPending = () => setPending(readQueue().length);

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
      const ps = await pullSettings(supabase, ws.id, { own: ws.own });
      if (ps.settings) setSettings(ps.settings);
      setSyncError('');
      if (q.rejected.length) notify('Modification hors ligne refusée : ' + q.rejected[0], 'neg');
      else if (ps.notice && ws.canEdit) notify(ps.notice, 'warn');
    } catch (e) {
      setWorkspace(w => w || cachedWorkspace(userId) || ownWorkspace(userId));
      // Hors ligne avec une copie locale : le voyant « Hors ligne » suffit, aucun message.
      if (navigator.onLine || !shown) setSyncError(e.message);
    } finally {
      refreshPending(); setLoading(false); setRefreshing(false);
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
    if (!online) { enqueue(op); refreshPending(); return; }
    const r = await applyOp(supabase, op);
    if (r.network) { enqueue(op); refreshPending(); }
    else if (r.error) notify('Enregistrement refusé par la base : ' + r.error, 'neg');
    else notify('Enregistré.');
  }

  async function remove(table, row) {
    if (!confirm('Supprimer cet élément ?')) return;
    setData(d => ({ ...d, [table]: d[table].filter(x => x.id !== row.id) }));
    const op = { table, kind: 'delete', row: { id: row.id } };
    if (!online) { enqueue(op); refreshPending(); return; }
    const r = await applyOp(supabase, op);
    if (r.network) { enqueue(op); refreshPending(); }
    else if (r.error) { notify('Suppression refusée par la base : ' + r.error, 'neg'); load(uid, true); }
  }

  async function saveSettings(raw) {
    const next = normalizeSettings(raw);
    setSettings(next);
    const ts = saveLocalSettings(next, wid);
    if (!online) { notify('Enregistré ; envoi au retour de la connexion.', 'warn'); return; }
    const r = await pushSettings(supabase, wid, next, ts, { own: workspace?.own !== false });
    if (r.error) notify('Enregistré sur cet appareil seulement : ' + r.error, 'neg');
    else notify('Paramètres enregistrés.');
  }

  const totals = useMemo(() => totaux({ ...data, parametres: settings }), [data, settings]);
  const gains = useMemo(() => gainsParMois(data.comptes, settings), [data.comptes, settings]);

  if (!session) return <Login />;
  if (loading) return <div className="loading"><RefreshCw className="spin" size={22} /> Chargement de vos données…</div>;

  return (
    <div className="app">
      <aside>
        <div className="side-brand"><Logo small /><b>{APP_NAME}</b></div>
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
          <div><span className="eyebrow">{APP_NAME}{workspace && !workspace.own ? ` · partagé par ${workspace.ownerEmail}` : ''}</span><h1>{TITLES[tab] || TABLES[tab].label}</h1></div>
          <div className="header-actions">
            <SyncStatus online={online} busy={refreshing} pending={pending} error={syncError} onSync={() => load(uid, true)} />
            <button className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </header>

        {tab === 'dashboard' ? <Dashboard totals={totals} gains={gains} />
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
          © {new Date().getFullYear()} {APP_NAME} · <button onClick={() => setLegal('privacy')}>Confidentialité</button> · <button onClick={() => setLegal('terms')}>Conditions d’utilisation</button> · v{APP_VERSION}
        </footer>
        {legal && <Legal type={legal} onClose={() => setLegal(null)} />}
        <Toasts toasts={toasts} onDismiss={dismiss} />
      </main>
    </div>
  );
}
