export interface HardcodedPlan {
  code: string;
  name: string;
  description: string;
  prices: {
    monthly: number;
    quarterly: number;
    yearly: number;
  };
  checkoutUrls: {
    monthly: string;
    quarterly: string;
    yearly: string;
  };
  maxProfessionals: number | null;
  features: string[];
  popular: boolean;
}

export type BillingPeriod = 'monthly' | 'quarterly' | 'yearly';

export const PLANS: HardcodedPlan[] = [
  {
    code: 'solo',
    name: 'Solo',
    description: 'Ideal para profissionais autônomos.',
    prices: { monthly: 3900, quarterly: 10530, yearly: 35100 },
    maxProfessionals: 1,
    features: [
      '1 profissional',
      'Agendamentos ilimitados',
      'Página pública de agendamento',
      'Lembretes automáticos por e-mail',
      'Pagamento online via Mercado Pago',
      'Controle simples da agenda',
    ],
    popular: false,
    checkoutUrls: {
      monthly: 'https://pay.kiwify.com.br/3Zeym7r',
      quarterly: 'https://pay.kiwify.com.br/73RMrpB',
      yearly: 'https://pay.kiwify.com.br/ImV5cuf',
    },
  },
  {
    code: 'studio',
    name: 'Studio',
    description: 'Para barbearias e salões com equipe.',
    prices: { monthly: 7900, quarterly: 21330, yearly: 71100 },
    maxProfessionals: 4,
    features: [
      'Até 4 profissionais',
      'Agendamentos ilimitados',
      'Pagamento online via Mercado Pago',
      'Gestão de comissões e repasses',
      'Relatórios de desempenho',
      'Portal do profissional',
    ],
    popular: true,
    checkoutUrls: {
      monthly: 'https://pay.kiwify.com.br/uc7CCUY',
      quarterly: 'https://pay.kiwify.com.br/dQip57V',
      yearly: 'https://pay.kiwify.com.br/g4qeKkm',
    },
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'Para negócios que precisam escalar.',
    prices: { monthly: 14900, quarterly: 40230, yearly: 134100 },
    maxProfessionals: null,
    features: [
      'Profissionais ilimitados',
      'Agendamentos ilimitados',
      'Pagamento online via Mercado Pago',
      'Gestão de comissões e repasses',
      'Relatórios de desempenho avançados',
      'Portal do profissional',
    ],
    popular: false,
    checkoutUrls: {
      monthly: 'https://pay.kiwify.com.br/i9OOO1',
      quarterly: 'https://pay.kiwify.com.br/oQ2rGRC',
      yearly: 'https://pay.kiwify.com.br/kIinvfN',
    },
  },
];

/** Returns plan limits based on plan code. */
export function getPlanLimits(planCode: string | undefined) {
  const code = (planCode || '').toLowerCase();
  const plan = PLANS.find(p => p.code === code) || PLANS[0];
  
  // Custom override for Pro plan (unlimited)
  if (code === 'pro') {
    return { maxProfessionals: null };
  }
  
  return { maxProfessionals: plan.maxProfessionals };
}

export function formatCentsBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
