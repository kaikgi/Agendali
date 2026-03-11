export interface PlanEntitlements {
  planLabel: string;
  professionalLimit: number;
  appointmentLimit: number;
  hasCommissions: boolean;
}

/**
 * Centralized entitlements for each plan/status.
 * No trial — only paid plans.
 */
export function getPlanEntitlements(
  status: string | undefined | null,
  plano: string | undefined | null,
  _trialEndsAt?: string | null | undefined,
): PlanEntitlements {
  const normalizedStatus = (status || '').toLowerCase();
  const normalizedPlano = (plano || '').toLowerCase();

  // Active paid plans
  if (normalizedStatus === 'active' || normalizedStatus === '') {
    switch (normalizedPlano) {
      case 'pro':
        return { planLabel: 'Pro', professionalLimit: Infinity, appointmentLimit: Infinity, hasCommissions: true };
      case 'studio':
        return { planLabel: 'Studio', professionalLimit: 4, appointmentLimit: Infinity, hasCommissions: true };
      case 'solo':
      default:
        return { planLabel: 'Solo', professionalLimit: 1, appointmentLimit: Infinity, hasCommissions: false };
    }
  }

  // past_due, canceled, or unknown — fallback to most restrictive
  return { planLabel: 'Sem plano', professionalLimit: 0, appointmentLimit: 0, hasCommissions: false };
}

/** Format limit for display: Infinity -> "Ilimitados", number -> number */
export function formatLimit(limit: number): string {
  return limit === Infinity ? 'Ilimitados' : String(limit);
}
