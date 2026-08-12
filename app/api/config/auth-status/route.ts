import { NextResponse } from 'next/server';
import { isAuthEnabled, getProviderId, getProviderName } from '@/lib/auth/config';

export async function GET() {
  const authEnabled = isAuthEnabled();

  return NextResponse.json({
    authEnabled,
    // The client must not hardcode the provider id: it is configurable and forms
    // part of the callback URL. Only meaningful when auth is enabled.
    providerId: authEnabled ? getProviderId() : null,
    providerName: authEnabled ? getProviderName() : null,
  });
}
