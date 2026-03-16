/**
 * Cancellation rules engine.
 * Determines what actions a client can take based on the accepted terms
 * and the appointment's payment type.
 */

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type CancellationScenario = 'no_payment' | 'deposit' | 'full_payment_online';

export interface CancellationContext {
  termsType: CancellationScenario | null;
  termsParams: {
    rescheduleMinHours?: number;
    establishmentName?: string;
  } | null;
  appointmentStartAt: string;
  establishmentPhone: string | null;
  establishmentName: string;
  serviceName: string;
  professionalName: string;
  customerName?: string;
  appointmentStatus: string;
}

export interface CancellationDecision {
  /** Whether the client can cancel directly through the system */
  canCancelDirectly: boolean;
  /** Whether the client can reschedule through the system */
  canReschedule: boolean;
  /** Whether to show WhatsApp contact as primary/only option */
  showWhatsAppContact: boolean;
  /** Title for the cancel dialog */
  cancelTitle: string;
  /** Description for the cancel dialog */
  cancelDescription: string;
  /** WhatsApp message (pre-filled) */
  whatsAppMessage: string;
  /** WhatsApp URL */
  whatsAppUrl: string | null;
  /** Whether within the deadline */
  withinDeadline: boolean;
  /** Hours remaining until deadline */
  hoursUntilAppointment: number;
  /** Configured minimum hours */
  minHours: number;
}

function formatPhone(phone: string | null): string | null {
  if (!phone) return null;
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // Ensure country code
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

function buildWhatsAppUrl(phone: string | null, message: string): string | null {
  const formatted = formatPhone(phone);
  if (!formatted) return null;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

export function evaluateCancellation(ctx: CancellationContext): CancellationDecision {
  const now = new Date();
  const appointmentDate = new Date(ctx.appointmentStartAt);
  const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const minHours = ctx.termsParams?.rescheduleMinHours ?? 2;
  const withinDeadline = hoursUntil >= minHours;
  const scenario = ctx.termsType ?? 'no_payment';

  const dateStr = format(appointmentDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const baseWhatsAppMsg = `Olá, ${ctx.establishmentName}! Preciso de ajuda com meu agendamento.\n\n` +
    `📋 Serviço: ${ctx.serviceName}\n` +
    `👤 Profissional: ${ctx.professionalName}\n` +
    `📅 Data: ${dateStr}\n` +
    (ctx.customerName ? `🙋 Cliente: ${ctx.customerName}\n` : '') +
    `\n`;

  const whatsAppUrl = buildWhatsAppUrl(ctx.establishmentPhone, '');

  // --- SCENARIO: Full payment online ---
  if (scenario === 'full_payment_online') {
    const cancelMsg = baseWhatsAppMsg +
      `Gostaria de solicitar o cancelamento e reembolso deste agendamento.`;

    return {
      canCancelDirectly: false,
      canReschedule: true, // Can reschedule without re-charging
      showWhatsAppContact: true,
      cancelTitle: 'Cancelamento — Agendamento com Pagamento Online',
      cancelDescription:
        'Como este agendamento foi pago online, o cancelamento e eventual reembolso devem ser solicitados diretamente ao estabelecimento. ' +
        'Use o botão abaixo para entrar em contato via WhatsApp.',
      whatsAppMessage: cancelMsg,
      whatsAppUrl: buildWhatsAppUrl(ctx.establishmentPhone, cancelMsg),
      withinDeadline,
      hoursUntilAppointment: hoursUntil,
      minHours,
    };
  }

  // --- SCENARIO: Deposit ---
  if (scenario === 'deposit') {
    if (withinDeadline) {
      return {
        canCancelDirectly: true,
        canReschedule: true,
        showWhatsAppContact: false,
        cancelTitle: 'Cancelar Agendamento com Sinal',
        cancelDescription:
          `Conforme os termos aceitos, o valor do sinal não será devolvido em caso de cancelamento. ` +
          `Deseja continuar com o cancelamento?`,
        whatsAppMessage: '',
        whatsAppUrl: null,
        withinDeadline: true,
        hoursUntilAppointment: hoursUntil,
        minHours,
      };
    } else {
      const contactMsg = baseWhatsAppMsg +
        `O prazo de cancelamento de ${minHours}h já expirou. Gostaria de solicitar o cancelamento deste agendamento.`;
      return {
        canCancelDirectly: false,
        canReschedule: false,
        showWhatsAppContact: true,
        cancelTitle: 'Prazo de Cancelamento Expirado',
        cancelDescription:
          `O prazo mínimo de ${minHours} hora(s) de antecedência para cancelamento já expirou. ` +
          `Entre em contato com o estabelecimento para solicitar o cancelamento.`,
        whatsAppMessage: contactMsg,
        whatsAppUrl: buildWhatsAppUrl(ctx.establishmentPhone, contactMsg),
        withinDeadline: false,
        hoursUntilAppointment: hoursUntil,
        minHours,
      };
    }
  }

  // --- SCENARIO: No payment ---
  if (withinDeadline) {
    return {
      canCancelDirectly: true,
      canReschedule: true,
      showWhatsAppContact: false,
      cancelTitle: 'Cancelar Agendamento',
      cancelDescription:
        'Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.',
      whatsAppMessage: '',
      whatsAppUrl: null,
      withinDeadline: true,
      hoursUntilAppointment: hoursUntil,
      minHours,
    };
  } else {
    const contactMsg = baseWhatsAppMsg +
      `O prazo de cancelamento de ${minHours}h já expirou. Gostaria de solicitar o cancelamento.`;
    return {
      canCancelDirectly: false,
      canReschedule: false,
      showWhatsAppContact: true,
      cancelTitle: 'Prazo de Cancelamento Expirado',
      cancelDescription:
        `O prazo mínimo de ${minHours} hora(s) de antecedência para cancelamento já expirou. ` +
        `Entre em contato com o estabelecimento para solicitar o cancelamento.`,
      whatsAppMessage: contactMsg,
      whatsAppUrl: buildWhatsAppUrl(ctx.establishmentPhone, contactMsg),
      withinDeadline: false,
      hoursUntilAppointment: hoursUntil,
      minHours,
    };
  }
}
