/* Paramètres de l'agence : cache local + synchronisation Supabase par utilisateur.
 *
 * Tous les paramètres (banques, associés, taux, nom, logo) sont stockés dans UNE ligne
 * JSON par compte (table parametres_utilisateur). Le dernier enregistrement gagne :
 * chaque sauvegarde porte un horodatage, et une modification faite hors ligne reste
 * marquée « à envoyer » jusqu'à ce que Supabase l'ait acceptée.
 */
export const DEFAULTS = {
  agencyName: 'Gestion Agence',
  pct_refus: 100 / 3,
  associe1Nom: 'Associé 1',
  associe1Investissement: 0,
  associe1Part: 50,
  associe2Nom: 'Associé 2',
  associe2Investissement: 0,
  associe2Part: 50,
  logo: '',
  n26: 0,
  sparkasse: 0,
  commerzbank: 0,
  wise: 0,
  fraisBancairesCompteBloqueVisa: 127,
  commissionSurRefus: true
};

export const SETTINGS_TABLE = 'parametres_utilisateur';
const KEY = 'gestion-agence-settings';
const META_KEY = 'gestion-agence-settings-meta';
const LOGO_MAX_BYTES = 150_000;
const LOGO_MAX_SIDE = 256;

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

export async function pushSettings(client, uid, settings, updated_at) {
  try {
    const r = await client.from(SETTINGS_TABLE).upsert({ user_id: uid, data: normalizeSettings(settings), updated_at });
    if (r.error) return { error: describeError(r.error) };
    writeLocal(normalizeSettings(settings), { uid, updated_at, dirty: false });
    return {};
  } catch (e) {
    return { error: e.message };
  }
}

function describeError(error) {
  const missing = error.code === 'PGRST205' || error.code === '42P01' || /parametres_utilisateur/.test(error.message || '');
  return missing
    ? 'la table parametres_utilisateur est absente ou inaccessible — exécutez schema.sql dans Supabase (SQL Editor).'
    : error.message;
}

/**
 * Réconcilie le cache local et Supabase au chargement.
 * Retourne { settings?, notice? } : `settings` est défini quand l'état affiché doit changer.
 */
export async function pullSettings(client, uid) {
  let r;
  try {
    r = await client.from(SETTINGS_TABLE).select('data,updated_at').eq('user_id', uid).maybeSingle();
  } catch (e) {
    return { notice: 'Paramètres non synchronisés : ' + e.message };
  }
  if (r.error) return { notice: 'Paramètres non synchronisés : ' + describeError(r.error) };

  const meta = readJson(META_KEY);
  const hasLocal = Boolean(readJson(KEY));
  const mine = meta && meta.uid === uid;
  const localPending = mine && meta.dirty;
  const remote = r.data;

  if (remote && !(localPending && Date.parse(meta.updated_at) > Date.parse(remote.updated_at))) {
    const settings = normalizeSettings(remote.data);
    writeLocal(settings, { uid, updated_at: remote.updated_at, dirty: false });
    return { settings };
  }
  if (localPending) {
    const p = await pushSettings(client, uid, readLocalSettings(), meta.updated_at);
    return p.error ? { notice: 'Paramètres en attente d’envoi : ' + p.error } : {};
  }
  if (!remote && hasLocal && !meta) {
    // Ancienne version : des paramètres existent seulement sur cet appareil. On n'envoie rien
    // automatiquement pour qu'un appareil aux valeurs périmées n'écrase pas le bon.
    return { notice: 'Paramètres présents uniquement sur cet appareil. Ouvrez Paramètres puis « Enregistrer » sur l’appareil qui contient les bons montants pour les synchroniser.' };
  }
  return {};
}

/** Lit un fichier logo ; les images lourdes sont réduites pour rester synchronisables. */
export function fileToLogo(file) {
  const asDataUrl = new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  if (file.size <= LOGO_MAX_BYTES) return asDataUrl;
  return asDataUrl.then(src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(img.width, img.height, 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(src);
    img.src = src;
  }));
}
