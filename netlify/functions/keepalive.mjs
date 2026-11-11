// Anti-pause Supabase : un projet gratuit est mis en pause après environ 7 jours sans activité.
// Netlify exécute cette fonction tous les jours ; elle fait une petite lecture dans la base
// (aucune donnée n'est renvoyée : les règles d'accès masquent tout à un visiteur non connecté).
const URL_ = process.env.VITE_SUPABASE_URL || 'https://cnmnqfeihfrwtixjjwpi.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_iVoNU6d1oIc-O5g96gXtdA_nT9WPxj_';

export default async () => {
  try {
    const r = await fetch(`${URL_}/rest/v1/comptes?select=id&limit=1`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    console.log(`keepalive Supabase : HTTP ${r.status}`);
    return new Response(`keepalive ${r.status}`, { status: r.ok ? 200 : 502 });
  } catch (e) {
    console.error('keepalive Supabase : échec', e.message);
    return new Response('keepalive failed', { status: 502 });
  }
};

export const config = { schedule: '17 5 * * *' };
