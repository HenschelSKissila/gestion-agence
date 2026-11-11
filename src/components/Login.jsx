import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Logo from './Logo.jsx';
import { APP_NAME, APP_VERSION } from '../lib/app';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const r = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (r.error) setError(/invalid login credentials/i.test(r.error.message || '') ? 'Identifiants incorrects.' : r.error.message);
  }

  return (
    <main className="login">
      <div className="login-card">
        <Logo />
        <p className="eyebrow">{APP_NAME} · v{APP_VERSION}</p>
        <h1>Votre agence, en clair.</h1>
        <p className="muted">Dossiers, capital et remboursements réunis au même endroit, sur tous vos appareils.</p>
        <form onSubmit={submit}>
          <label>Email
            <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required placeholder="vous@agence.fr" />
          </label>
          <label>Mot de passe
            <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          {error && <div className="alert neg" role="alert">{error}</div>}
          <button className="btn primary block" disabled={busy}><LogIn size={17} /> {busy ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </div>
    </main>
  );
}
