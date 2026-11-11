/* Paramètres de l'agence : cache local + synchronisation Supabase par utilisateur.
 *
 * Tous les paramètres (banques, associés, taux, frais) sont stockés dans UNE ligne JSON par
 * agence (table parametres_utilisateur). Si cette table n'existe pas encore dans Supabase,
 * ils sont enregistrés dans le profil du compte (Supabase Auth) : dans les deux cas, ils
 * suivent le compte de connexion sur tous ses appareils, sans aucune étape manuelle. Le dernier enregistrement gagne :
 * chaque sauvegarde porte un horodatage, et une modification faite hors ligne reste
 * marquée « à envoyer » jusqu'à ce que Supabase l'ait acceptée.
 */
export const DEFAULTS = {
  pct_refus: 100 / 3,
  associe1Nom: 'Associé 1',
  associe1Investissement: 0,
  associe1Part: 50,
  associe2Nom: 'Associé 2',
  associe2Investissement: 0,
  associe2Part: 50,
  n26: 0,
  sparkasse: 0,
  commerzbank: 0,
  wise: 0,
  fraisBancairesCompteBloqueVisa: 127,
  commissionSurRefus: false
};

export const SETTINGS_TABLE = 'parametres_utilisateur';
const KEY = 'gestion-agence-settings';
const META_KEY = 'gestion-agence-settings-meta';
const PROFILE_KEY = 'gestion_agence';

/** Ne garde que les clés connues ; les champs numériques saisis en texte redeviennent des nombres. */
export function normalizeSettings(raw = {}) {
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    const v = raw?.[k];
    if (v === undefined || v === null) continue;
    if (typeof DEFAULTS[k] === 'boolean') {
      out[k] = v === true || v === 'true';
    } else if (typeof DEFAULTS[k] === 'number') {
      const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
      if (v !== '' && Number.isFinite(n)) out[k] = n;
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function writeLocal(settings, meta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch { /* quota dépassé : la copie Supabase reste la référence */ }
}

export function readLocalSettings() {
  return normalizeSettings(readJson(KEY) || {});
}

/** Enregistre localement et marque la modification comme « à envoyer ». Retourne l'horodatage. */
export function saveLocalSettings(settings, uid) {
  const updated_at = new Date().toISOString();
  writeLocal(settings, { uid, updated_at, dirty: true });
  return updated_at;
}

const stamp = v => Date.parse(v || '') || 0;

/** Copie des paramètres rangée dans le profil du compte (solution de secours sans table). */
async function readProfile(client) {
  try {
    const r = await client.auth.getUser();
    const p = r.data?.user?.user_metadata?.[PROFILE_KEY];
    return p?.data ? { data: p.data, updated_at: p.updated_at } : null;
  } catch { return null; }
}

async function writeProfile(client, settings, updated_at) {
  try {
    const r = await client.auth.updateUser({ data: { [PROFILE_KEY]: { data: settings, updated_at } } });
    return r.error ? r.error.message : null;
  } catch (e) { return e.message; }
}

/** `own` : vrai quand on enregistre les paramètres de sa propre agence (et non celle d'un associé). */
export async function pushSettings(client, uid, settings, updated_at, { own = true } = {}) {
  const data = normalizeSettings(settings);
  let error;
  try {
    const r = await client.from(SETTINGS_TABLE).upsert({ user_id: uid, data, updated_at });
    error = r.error ? r.error.message : null;
  } catch (e) { error = e.message; }
  if (error && own) error = await writeProfile(client, data, updated_at);
  if (error) return { error };
  writeLocal(data, { uid, updated_at, dirty: false });
  return {};
}

/**
 * Réconcilie le cache local et Supabase au chargement : la version la plus récente gagne.
 * Retourne { settings?, notice? } : `settings` est défini quand l'état affiché doit changer.
 */
export async function pullSettings(client, uid, { own = true } = {}) {
  let row = null, tableOk = false;
  try {
    const r = await client.from(SETTINGS_TABLE).select('data,updated_at').eq('user_id', uid).maybeSingle();
    tableOk = !r.error;
    row = r.data || null;
  } catch { /* réseau : on garde le cache local */ }
  const profile = own ? await readProfile(client) : null;
  const remote = [row, profile].filter(Boolean).sort((a, b) => stamp(b.updated_at) - stamp(a.updated_at))[0] || null;
  if (!tableOk && !profile && !navigator.onLine) return {};

  const meta = readJson(META_KEY);
  const hasLocal = Boolean(readJson(KEY));
  const localPending = Boolean(meta && meta.uid === uid && meta.dirty);

  if (remote && !(localPending && stamp(meta.updated_at) >= stamp(remote.updated_at))) {
    const settings = normalizeSettings(remote.data);
    writeLocal(settings, { uid, updated_at: remote.updated_at, dirty: false });
    // Les paramètres n'existaient que dans le profil : on les recopie dans la table dès qu'elle existe.
    if (own && tableOk && remote !== row) await pushSettings(client, uid, settings, remote.updated_at, { own });
    return { settings };
  }
  if (localPending) {
    const p = await pushSettings(client, uid, readLocalSettings(), meta.updated_at, { own });
    return p.error ? { notice: 'Paramètres en attente d’envoi : ' + p.error } : {};
  }
  if (!remote && hasLocal && !meta && own) {
    // Ancienne version : des paramètres existent seulement sur cet appareil. On n'envoie rien
    // automatiquement pour qu'un appareil aux valeurs périmées n'écrase pas le bon.
    return { notice: 'Montants présents uniquement sur cet appareil : ouvrez Paramètres puis « Enregistrer » sur l’appareil qui contient les bons montants.' };
  }
  return {};
}
