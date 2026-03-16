/**
 * Dynamic booking terms generator.
 *
 * Produces legally-clear terms text based on the establishment's
 * current payment and cancellation configuration.
 */

export type TermsType = 'no_payment' | 'deposit' | 'full_payment_online';

export interface TermsParams {
  establishmentName: string;
  rescheduleMinHours: number;
  depositRequired?: boolean;
  depositType?: 'fixed' | 'percentage';
  depositValue?: number;
  fullPaymentOnline?: boolean;
  refundOnCancellation?: boolean;
  refundDeadlineHours?: number;
  servicePriceCents?: number;
}

export interface GeneratedTerms {
  type: TermsType;
  text: string;
  params: TermsParams;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function resolveTermsType(params: TermsParams): TermsType {
  if (params.fullPaymentOnline) return 'full_payment_online';
  if (params.depositRequired) return 'deposit';
  return 'no_payment';
}

function buildDepositTerms(p: TermsParams): string {
  const depositDesc = p.depositType === 'percentage'
    ? `${p.depositValue}% do valor do serviço`
    : formatCurrency((p.depositValue || 0) * 100);

  return `Termos de Agendamento — ${p.establishmentName}

Ao confirmar este agendamento, você declara estar ciente e de acordo com os seguintes termos:

1. PAGAMENTO ANTECIPADO DE SINAL
Este agendamento requer o pagamento antecipado de um sinal no valor de ${depositDesc}. O sinal é cobrado no momento da confirmação do agendamento e garante a reserva do horário escolhido.

2. POLÍTICA DE CANCELAMENTO
• Cancelamentos ou reagendamentos podem ser solicitados com no mínimo ${p.rescheduleMinHours} hora(s) de antecedência em relação ao horário agendado.
• Em caso de cancelamento, o valor do sinal NÃO será devolvido, independentemente do motivo.
• Após o prazo de ${p.rescheduleMinHours} hora(s) antes do atendimento, cancelamentos e reagendamentos ficam sujeitos à análise do estabelecimento e devem ser solicitados diretamente ao ${p.establishmentName}.

3. NÃO COMPARECIMENTO
O não comparecimento sem aviso prévio (no-show) resultará na perda do valor do sinal e poderá implicar restrições para futuros agendamentos.

4. REAGENDAMENTO
Reagendamentos estão sujeitos à disponibilidade de horários na agenda do profissional.

Ao prosseguir, você confirma que leu, compreendeu e aceita integralmente estes termos.`;
}

function buildFullPaymentTerms(p: TermsParams): string {
  return `Termos de Agendamento — ${p.establishmentName}

Ao confirmar este agendamento, você declara estar ciente e de acordo com os seguintes termos:

1. PAGAMENTO INTEGRAL ANTECIPADO
Este agendamento requer o pagamento integral do valor do serviço no momento da confirmação. O pagamento garante a reserva do horário escolhido.

2. POLÍTICA DE CANCELAMENTO E REEMBOLSO
• Cancelamentos podem ser solicitados com no mínimo ${p.rescheduleMinHours} hora(s) de antecedência em relação ao horário agendado.
• Em caso de cancelamento dentro do prazo, o cliente deverá entrar em contato diretamente com ${p.establishmentName} para solicitar cancelamento, reagendamento ou reembolso.
• O processo de reembolso NÃO é automático pelo sistema. O estabelecimento é o único responsável pela análise e eventual devolução de valores.
• Após o prazo de ${p.rescheduleMinHours} hora(s) antes do atendimento, cancelamentos ficam sujeitos à política interna do estabelecimento.

3. NÃO COMPARECIMENTO
O não comparecimento sem aviso prévio (no-show) resultará na perda do valor pago e poderá implicar restrições para futuros agendamentos.

4. REAGENDAMENTO
Reagendamentos estão sujeitos à disponibilidade e devem ser solicitados diretamente ao estabelecimento.

Ao prosseguir, você confirma que leu, compreendeu e aceita integralmente estes termos.`;
}

function buildNoPaymentTerms(p: TermsParams): string {
  return `Termos de Agendamento — ${p.establishmentName}

Ao confirmar este agendamento, você declara estar ciente e de acordo com os seguintes termos:

1. POLÍTICA DE CANCELAMENTO
• Cancelamentos ou reagendamentos devem ser solicitados com no mínimo ${p.rescheduleMinHours} hora(s) de antecedência em relação ao horário agendado.
• Dentro do prazo, o cancelamento pode ser realizado normalmente pelo sistema ou pelo link enviado por e-mail.
• Após o prazo de ${p.rescheduleMinHours} hora(s) antes do atendimento, o cliente deverá entrar em contato diretamente com ${p.establishmentName} para solicitar cancelamento ou reagendamento.

2. REAGENDAMENTO
Reagendamentos estão sujeitos à disponibilidade de horários na agenda do profissional.

3. NÃO COMPARECIMENTO
Cancelamentos frequentes ou faltas recorrentes sem aviso prévio poderão resultar em limitações para novos agendamentos.

Ao prosseguir, você confirma que leu, compreendeu e aceita integralmente estes termos.`;
}

export function generateBookingTerms(params: TermsParams): GeneratedTerms {
  const type = resolveTermsType(params);

  let text: string;
  switch (type) {
    case 'deposit':
      text = buildDepositTerms(params);
      break;
    case 'full_payment_online':
      text = buildFullPaymentTerms(params);
      break;
    default:
      text = buildNoPaymentTerms(params);
  }

  return { type, text, params };
}
