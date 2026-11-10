import React from 'react';

export default function Logo({ settings, small = false }) {
  if (settings.logo) return <img className={small ? 'logo logo-small' : 'logo'} src={settings.logo} alt={settings.agencyName} />;
  const initials = settings.agencyName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'GA';
  return <div className={small ? 'brand-mark small' : 'brand-mark'} aria-hidden="true">{initials}</div>;
}
