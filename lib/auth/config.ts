export function isAuthEnabled(): boolean {
  return !!(
    process.env.AUTH_OIDC_ISSUER &&
    process.env.AUTH_OIDC_CLIENT_ID &&
    process.env.AUTH_OIDC_CLIENT_SECRET
  );
}
