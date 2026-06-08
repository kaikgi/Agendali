// Centralized environment configuration
// All URLs should use this to ensure consistency across the app

export const APP_URL = import.meta.env.VITE_APP_URL || 'https://www.agendali.online';

export const getAppUrl = (path: string = ''): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${APP_URL}${cleanPath}`;
};

// Helper to get OAuth redirect URL
export const getAuthCallbackUrl = (): string => {
  return getAppUrl('/auth/callback');
};

// Helper to get password reset URL
export const getPasswordResetUrl = (isClient: boolean = false): string => {
  return isClient ? getAppUrl('/cliente/resetar-senha') : getAppUrl('/resetar-senha');
};

// Helper to get email confirmation URL
export const getEmailConfirmUrl = (): string => {
  return getAppUrl('/auth/confirm');
};
