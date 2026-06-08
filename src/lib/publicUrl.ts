/**
 * Single source of truth for public URL generation.
 * Used across the entire application.
 * 
 * IMPORTANT: Always use these functions to ensure links work in production.
 */

// Production base URL - the canonical domain for public links
const PRODUCTION_DOMAIN = 'www.agendali.online';

/**
 * Returns the production base URL (always agendali.online).
 * For critical redirects, ALWAYS use this to avoid supabase.co or lovable.app
 */
export function getProductionUrl(): string {
  return `https://${PRODUCTION_DOMAIN}`;
}

/**
 * Returns the public base URL for the application.
 * In production: uses agendali.online
 * In dev/preview: uses window.location.origin
 */
export function getPublicBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'agendali.online' || hostname === 'www.agendali.online') {
      return getProductionUrl();
    }
    return window.location.origin;
  }
  return getProductionUrl();
}

// Legacy export for compatibility
export const PUBLIC_BASE_URL = getProductionUrl();

/**
 * Builds a public URL by appending a path to the base URL.
 */
export function buildPublicUrl(path: string): string {
  const baseUrl = getPublicBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Generates the public booking URL for an establishment.
 */
export function getPublicUrl(slug: string): string {
  return `${getPublicBaseUrl()}/${slug}`;
}

/**
 * Generates the appointment management URL.
 */
export function getManageAppointmentUrl(slug: string, token: string): string {
  return `${getPublicBaseUrl()}/${slug}/gerenciar/${token}`;
}

/**
 * Generates the professional portal URL.
 */
export function getProfessionalPortalUrl(establishmentSlug: string, professionalSlug: string): string {
  return `${getPublicBaseUrl()}/${establishmentSlug}/p/${professionalSlug}`;
}

/**
 * Generates the client appointments page URL.
 */
export function getClientAppointmentsUrl(): string {
  return `${getPublicBaseUrl()}/client/appointments`;
}
