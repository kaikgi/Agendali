export type FeatureFlag =
  | 'commissions'
  | 'advanced_reports'
  | 'professional_portal'
  | 'unlimited_professionals';

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
  unlimited_professionals: false,
};

const STUDIO_FEATURES: Record<FeatureFlag, boolean> = {
  commissions: true,
  advanced_reports: true,
  professional_portal: true,
  unlimited_professionals: false,
};

const PRO_FEATURES: Record<FeatureFlag, boolean> = {
  commissions: true,
  advanced_reports: true,
  professional_portal: true,
  unlimited_professionals: true,
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
  unlimited_professionals: {
    title: 'Profissionais Ilimitados',
    description: 'Cadastre quantos profissionais desejar no seu estabelecimento.',
    minPlan: 'Pro',
  },
};

/**
 * Centralized entitlements for each plan/status.
 * Fonte principal da verdade para recursos e limites do sistema.
 */
export function getPlanEntitlements(
  status: string | undefined | null,
  plano: string | undefined | null,
  periodEnd?: string | null | undefined,
  trialEndsAt?: string | null | undefined,
): PlanEntitlements {
  const normalizedStatus = (status || '').toLowerCase();
  const normalizedPlano = (plano || '').toLowerCase();
  const now = new Date();

  // Check trial validity
  const trialActive = trialEndsAt ? new Date(trialEndsAt) > now : false;
  
  // Check period end for past_due (grace period)
  // If current_period_end exists and is in the past, it's actually expired.
  // We'll allow a 3-day grace period for past_due status.
  const isWithinGracePeriod = (dateStr: string | null | undefined) => {
    if (!dateStr) return true; // No date means we don't block
    const endDate = new Date(dateStr);
    const graceDate = new Date(endDate.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 days grace
    return graceDate > now;
  };

  const isActive = 
    normalizedStatus === 'active' || 
    (normalizedStatus === 'trialing' && trialActive) ||
    (normalizedStatus === 'past_due' && isWithinGracePeriod(periodEnd)) ||
    normalizedStatus === ''; // Legacy/Initial

  if (isActive) {
    switch (normalizedPlano) {
      case 'pro':
        return { 
          planLabel: 'Pro', 
          professionalLimit: Infinity, 
          appointmentLimit: Infinity, 
          hasCommissions: true, 
          features: PRO_FEATURES 
        };
      case 'studio':
        return { 
          planLabel: 'Studio', 
          professionalLimit: 4, 
          appointmentLimit: Infinity, 
          hasCommissions: true, 
          features: STUDIO_FEATURES 
        };
      case 'solo':
      default:
        return { 
          planLabel: 'Solo', 
          professionalLimit: 1, 
          appointmentLimit: Infinity, 
          hasCommissions: false, 
          features: SOLO_FEATURES 
        };
    }
  }

  // Canceled, expired past_due, or unknown — fallback to most restrictive
  return { 
    planLabel: normalizedStatus === 'past_due' ? 'Pagamento Pendente' : 'Sem plano', 
    professionalLimit: 0, 
    appointmentLimit: 0, 
    hasCommissions: false, 
    features: SOLO_FEATURES 
  };
}

/** Format limit for display: Infinity -> "Ilimitados", number -> number */
export function formatLimit(limit: number): string {
  return limit === Infinity ? 'Ilimitados' : String(limit);
}
