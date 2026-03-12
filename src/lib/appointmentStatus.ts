/**
 * Centralized appointment status configuration.
 * ALL status colors, labels, variants, and dot colors are defined here.
 * No other file should define its own status maps.
 */

export type AppointmentStatus =
  | 'pending_approval'
  | 'paid_pending_confirmation'
  | 'pending_payment'
  | 'booked'
  | 'confirmed'
  | 'arrived'
  | 'in_service'
  | 'completed'
  | 'no_show'
  | 'canceled'
  | 'canceled_by_customer'
  | 'canceled_by_establishment'
  | 'rejected';

interface StatusConfig {
  label: string;
  /** Badge classes: bg + text + border — each status has unique colors */
  badgeClasses: string;
  /** Dot color for calendar views */
  dotColor: string;
  /** shadcn Badge variant for client-facing views */
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending_approval: {
    label: 'Aguardando aprovação',
    badgeClasses: 'bg-amber-100 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-500',
    variant: 'outline',
  },
  paid_pending_confirmation: {
    label: 'Pago — aguardando confirmação',
    badgeClasses: 'bg-violet-100 text-violet-800 border-violet-300',
    dotColor: 'bg-violet-500',
    variant: 'outline',
  },
  pending_payment: {
    label: 'Aguardando pagamento',
    badgeClasses: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    dotColor: 'bg-yellow-500',
    variant: 'outline',
  },
  booked: {
    label: 'Agendado',
    badgeClasses: 'bg-blue-100 text-blue-800 border-blue-300',
    dotColor: 'bg-blue-500',
    variant: 'outline',
  },
  confirmed: {
    label: 'Confirmado',
    badgeClasses: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-500',
    variant: 'default',
  },
  arrived: {
    label: 'Chegou',
    badgeClasses: 'bg-purple-100 text-purple-800 border-purple-300',
    dotColor: 'bg-purple-500',
    variant: 'default',
  },
  in_service: {
    label: 'Em atendimento',
    badgeClasses: 'bg-sky-100 text-sky-800 border-sky-300',
    dotColor: 'bg-sky-500',
    variant: 'default',
  },
  completed: {
    label: 'Concluído',
    badgeClasses: 'bg-slate-100 text-slate-600 border-slate-300',
    dotColor: 'bg-slate-400',
    variant: 'secondary',
  },
  no_show: {
    label: 'Não compareceu',
    badgeClasses: 'bg-rose-100 text-rose-800 border-rose-300',
    dotColor: 'bg-rose-500',
    variant: 'destructive',
  },
  canceled: {
    label: 'Cancelado',
    badgeClasses: 'bg-red-100 text-red-700 border-red-300',
    dotColor: 'bg-red-400',
    variant: 'destructive',
  },
  canceled_by_customer: {
    label: 'Cancelado pelo cliente',
    badgeClasses: 'bg-orange-100 text-orange-800 border-orange-300',
    dotColor: 'bg-orange-500',
    variant: 'destructive',
  },
  canceled_by_establishment: {
    label: 'Cancelado pelo estabelecimento',
    badgeClasses: 'bg-pink-100 text-pink-800 border-pink-300',
    dotColor: 'bg-pink-500',
    variant: 'destructive',
  },
  rejected: {
    label: 'Recusado',
    badgeClasses: 'bg-stone-200 text-stone-800 border-stone-400',
    dotColor: 'bg-stone-500',
    variant: 'destructive',
  },
};

/** Get the full config for a status */
export function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? {
    label: status,
    badgeClasses: 'bg-muted text-muted-foreground border-border',
    dotColor: 'bg-muted-foreground',
    variant: 'outline' as const,
  };
}

/** Get the display label for a status */
export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label ?? status;
}

/** Get badge classes for a status (bg + text + border) */
export function getStatusBadgeClasses(status: string): string {
  return STATUS_CONFIG[status]?.badgeClasses ?? 'bg-muted text-muted-foreground border-border';
}

/** Get dot color for calendar views */
export function getStatusDotColor(status: string): string {
  return STATUS_CONFIG[status]?.dotColor ?? 'bg-muted-foreground';
}

/** Get shadcn Badge variant */
export function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  return STATUS_CONFIG[status]?.variant ?? 'outline';
}

/** All status labels as a record (for backwards compat) */
export const statusLabels: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])
);

/** All badge classes as a record (for backwards compat) */
export const statusColors: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.badgeClasses])
);

/** All dot colors as a record */
export const dotColors: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.dotColor])
);

/** All Badge variants as a record */
export const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.variant])
);
export const dotColors: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.dotColor])
);

/** Legend items for status bars */
export const legendStatuses = [
  { key: 'pending_approval', label: 'Aguardando aprovação' },
  { key: 'booked', label: 'Agendado' },
  { key: 'confirmed', label: 'Confirmado' },
  { key: 'arrived', label: 'Chegou' },
  { key: 'in_service', label: 'Em atendimento' },
  { key: 'completed', label: 'Concluído' },
  { key: 'no_show', label: 'Não compareceu' },
  { key: 'canceled', label: 'Cancelado' },
];
