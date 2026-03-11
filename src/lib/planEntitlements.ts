export type FeatureFlag =
  | 'commissions'
  | 'online_payments'
  | 'advanced_reports'
  | 'custom_branding'
  | 'priority_support';

export interface PlanEntitlements {
  planLabel: string;
  professionalLimit: number;
  appointmentLimit: number;
  hasCommissions: boolean;
  features: Record<FeatureFlag, boolean>;
}

const SOLO_FEATURES: Record<FeatureFlag, boolean> = {
  commissions: false,
  online_payments: false,
  advanced_reports: false,
  custom_branding: false,
  priority_support: false,
};

const STUDIO_FEATURES: Record<FeatureFlag, boolean> = {
  commissions: true,
  online_payments: true,
  advanced_reports: true,
  custom_branding: false,
  priority_support: false,
};

const PRO_FEATURES: Record<FeatureFlag, boolean> = {
  commissions: true,
  online_payments: true,
  advanced_reports: true,
  custom_branding: true,
  priority_support: true,
};

/** Human-readable labels for feature flags */
export const FEATURE_LABELS: Record<FeatureFlag, { title: string; description: string; minPlan: string }> = {
  commissions: {
    title: 'Gestão de Comissões',
    description: 'Gerencie comissões e repasses dos seus profissionais automaticamente.',
    minPlan: 'Studio',
  },
  online_payments: {
    title: 'Pagamento Online e Sinal',
    description: 'Receba pagamentos e sinais antecipados via Mercado Pago.',
    minPlan: 'Studio',
  },
  advanced_reports: {
    title: 'Relatórios Avançados',
    description: 'Acesse relatórios detalhados de desempenho e financeiro.',
    minPlan: 'Studio',
  },
  custom_branding: {
    title: 'Personalização Avançada',
    description: 'Personalize completamente sua página pública de agendamento.',
    minPlan: 'Pro',
  },
  priority_support: {
    title: 'Suporte Prioritário',
    description: 'Atendimento prioritário e canais exclusivos de suporte.',
    minPlan: 'Pro',
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
