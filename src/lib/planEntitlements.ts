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
  _trialEndsAt?: string | null | undefined,
): PlanEntitlements {
  const normalizedStatus = (status || '').toLowerCase();
  const normalizedPlano = (plano || '').toLowerCase();

  // Consider active if status is active, empty (legacy), or billing is verified
  const isActive = ['active', 'past_due', ''].includes(normalizedStatus);

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
        return { 
          planLabel: 'Solo', 
          professionalLimit: 1, 
          appointmentLimit: Infinity, 
          hasCommissions: false, 
          features: SOLO_FEATURES 
        };
      default:
        // Default to Solo for any other case if status is active
        return { 
          planLabel: 'Solo', 
          professionalLimit: 1, 
          appointmentLimit: Infinity, 
          hasCommissions: false, 
          features: SOLO_FEATURES 
        };
    }
  }

  // Canceled or unknown — fallback to most restrictive
  return { 
    planLabel: 'Sem plano', 
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
