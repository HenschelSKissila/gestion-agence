/* Espace de travail = l'agence dont on affiche les données.
 * Par défaut la sienne ; si un propriétaire a invité cet email, on peut ouvrir la sienne (table agence_membres).
 */
const PREF_KEY = 'gestion-agence-workspace';
const CACHE_KEY = 'gestion-agence-workspace-cache';
const TABLE = 'agence_membres';

const readJson = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ } };

export const ownWorkspace = uid => ({ id: uid, own: true, canEdit: true, ownerEmail: '', shared: [], members: [] });

/** Choisit l'espace à afficher à partir des lignes agence_membres visibles par l'utilisateur. */
export function chooseWorkspace(uid, rows = [], preferred = null) {
  const members = rows.filter(r => r.owner_id === uid);
  const shared = rows.filter(r => r.owner_id !== uid);
  const pick = preferred === uid ? null : shared.find(r => r.owner_id === preferred) || shared[0];
  const target = preferred === uid ? null : pick;
  return target
    ? { id: target.owner_id, own: false, canEdit: Boolean(target.peut_modifier), ownerEmail: target.owner_email, shared, members }
    : { ...ownWorkspace(uid), shared, members };
}

export function cachedWorkspace(uid) {
  const c = readJson(CACHE_KEY);
  return c && c.uid === uid ? c.workspace : null;
}

export function preferWorkspace(id) { writeJson(PREF_KEY, id); }

/** Résout l'espace en ligne ; hors ligne ou table absente, retombe sur le dernier espace connu. */
export async function resolveWorkspace(client, uid) {
  try {
    const r = await client.from(TABLE).select('*');
    if (r.error) throw new Error(r.error.message);
    const workspace = chooseWorkspace(uid, r.data || [], readJson(PREF_KEY));
    writeJson(CACHE_KEY, { uid, workspace });
    return workspace;
  } catch {
    return cachedWorkspace(uid) || ownWorkspace(uid);
  }
}

const describe = error => (error.code === 'PGRST205' || error.code === '42P01' ? 'table agence_membres absente — exécutez schema.sql dans Supabase.' : error.code === '23505' ? 'cette personne est déjà invitée.' : error.message);

export async function addMember(client, email, canEdit) {
  const member_email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member_email)) return { error: 'adresse email invalide.' };
  const r = await client.from(TABLE).insert({ member_email, peut_modifier: Boolean(canEdit) });
  return r.error ? { error: describe(r.error) } : {};
}

export async function removeMember(client, uid, member_email) {
  const r = await client.from(TABLE).delete().eq('owner_id', uid).eq('member_email', member_email);
  return r.error ? { error: describe(r.error) } : {};
}

/* Copie locale des dossiers, par espace : l'application s'ouvre avec ses données même sans réseau. */
const dataKey = id => `gestion-agence-data-${id}`;
export function readDataCache(id) { return readJson(dataKey(id)); }
export function writeDataCache(id, data) { writeJson(dataKey(id), { saved_at: new Date().toISOString(), data }); }

/** À la déconnexion : aucune donnée financière ne reste sur l'appareil. */
export function clearLocalData() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('gestion-agence-') && k !== 'gestion-agence-theme')
      .forEach(k => localStorage.removeItem(k));
  } catch { /* stockage indisponible */ }
}
