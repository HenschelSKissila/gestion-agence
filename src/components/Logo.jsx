import React from 'react';
import { APP_NAME, LOGO_URL } from '../lib/app';

export default function Logo({ small = false }) {
  return <img className={small ? 'logo logo-small' : 'logo'} src={LOGO_URL} alt={APP_NAME} width={small ? 38 : 64} height={small ? 38 : 64} />;
}
