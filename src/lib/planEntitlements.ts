export type FeatureFlag =
  | 'commissions'
  | 'advanced_reports'
  | 'professional_portal';

export interface PlanEntitlements {
  planLabel: string;
  professionalLimit: number;
  appointmentLimit: number;
  hasCommissions: boolean;
  features: Record<FeatureFlag, boolean>;
}

const SOLO_FEATURES: Record<FeatureFlag, boolean> = {
  commissions: false,
  advanced_reports: false,
  professional_portal: false,
};

const STUDIO_FEATURES: Record<FeatureFlag, boolean> = {
  commissions: true,
  advanced_reports: true,
  professional_portal: true,
};

const PRO_FEATURES: Record<FeatureFlag, boolean> = {
  commissions: true,
  advanced_reports: true,
  professional_portal: true,
};

/** Human-readable labels for feature flags */
export const FEATURE_LABELS: Record<FeatureFlag, { title: string; description: string; minPlan: string }> = {
  commissions: {
    title: 'Gestão de Comissões',
    description: 'Gerencie comissões e repasses dos seus profissionais automaticamente.',
    minPlan: 'Studio',
  },
  advanced_reports: {
    title: 'Relatórios de Desempenho',
    description: 'Acesse relatórios detalhados de desempenho e financeiro do seu estabelecimento.',
    minPlan: 'Studio',
  },
  professional_portal: {
    title: 'Portal do Profissional',
    description: 'Permita que seus profissionais acessem a agenda individual com login próprio.',
    minPlan: 'Studio',
  },
};

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
        return { planLabel: 'Pro', professionalLimit: Infinity, appointmentLimit: Infinity, hasCommissions: true, features: PRO_FEATURES };
      case 'studio':
        return { planLabel: 'Studio', professionalLimit: 4, appointmentLimit: Infinity, hasCommissions: true, features: STUDIO_FEATURES };
      case 'solo':
      default:
        return { planLabel: 'Solo', professionalLimit: 1, appointmentLimit: Infinity, hasCommissions: false, features: SOLO_FEATURES };
    }
  }

  // past_due, canceled, or unknown — fallback to most restrictive
  return { planLabel: 'Sem plano', professionalLimit: 0, appointmentLimit: 0, hasCommissions: false, features: SOLO_FEATURES };
}

/** Format limit for display: Infinity -> "Ilimitados", number -> number */
export function formatLimit(limit: number): string {
  return limit === Infinity ? 'Ilimitados' : String(limit);
}
