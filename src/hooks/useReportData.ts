import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserEstablishment } from './useUserEstablishment';
import { startOfDay, endOfDay, subDays, format, parseISO, getDay, getHours } from 'date-fns';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  professionalId?: string;
  serviceId?: string;
  status?: string;
}

interface AppointmentRow {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  professional_id: string;
  service_id: string;
  customer_id: string;
  customer_email: string | null;
}

interface ServiceRow {
  id: string;
  name: string;
  price_cents: number | null;
}

interface ProfessionalRow {
  id: string;
  name: string;
}

interface PaymentRow {
  id: string;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  status: string;
  payment_type: string;
  paid_at: string | null;
  refunded_at: string | null;
  appointment_id: string;
}

interface CommissionRow {
  id: string;
  commission_amount_cents: number;
  status: string;
  professional_id: string;
  professional_name: string;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function useReportData(filters: ReportFilters) {
  const { data: establishment } = useUserEstablishment();
  const estId = establishment?.id;

  const dateFrom = filters.dateFrom || format(subDays(new Date(), 29), 'yyyy-MM-dd');
  const dateTo = filters.dateTo || format(new Date(), 'yyyy-MM-dd');
  const fromISO = startOfDay(parseISO(dateFrom)).toISOString();
  const toISO = endOfDay(parseISO(dateTo)).toISOString();

  // ─── Appointments ───────────────────────────────
  const appointmentsQuery = useQuery({
    queryKey: ['report-appointments', estId, dateFrom, dateTo, filters.professionalId, filters.serviceId],
    queryFn: async () => {
      let q = supabase
        .from('appointments')
        .select('id, start_at, end_at, status, professional_id, service_id, customer_id, customer_email')
        .eq('establishment_id', estId!)
        .gte('start_at', fromISO)
        .lte('start_at', toISO);
      if (filters.professionalId) q = q.eq('professional_id', filters.professionalId);
      if (filters.serviceId) q = q.eq('service_id', filters.serviceId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AppointmentRow[];
    },
    enabled: !!estId,
    staleTime: 30000,
  });

  // ─── Services lookup ────────────────────────────
  const servicesQuery = useQuery({
    queryKey: ['report-services', estId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price_cents')
        .eq('establishment_id', estId!);
      if (error) throw error;
      return (data || []) as ServiceRow[];
    },
    enabled: !!estId,
    staleTime: 60000,
  });

  // ─── Professionals lookup ───────────────────────
  const professionalsQuery = useQuery({
    queryKey: ['report-professionals', estId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('establishment_id', estId!)
        .eq('active', true);
      if (error) throw error;
      return (data || []) as ProfessionalRow[];
    },
    enabled: !!estId,
    staleTime: 60000,
  });

  // ─── Payments ───────────────────────────────────
  const paymentsQuery = useQuery({
    queryKey: ['report-payments', estId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_payments')
        .select('id, amount_cents, fee_cents, net_amount_cents, status, payment_type, paid_at, refunded_at, appointment_id')
        .eq('establishment_id', estId!)
        .gte('created_at', fromISO)
        .lte('created_at', toISO);
      if (error) throw error;
      return (data || []) as PaymentRow[];
    },
    enabled: !!estId,
    staleTime: 30000,
  });

  // ─── Commissions ────────────────────────────────
  const commissionsQuery = useQuery({
    queryKey: ['report-commissions', estId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_entries')
        .select('id, commission_amount_cents, status, professional_id, professional_name')
        .eq('establishment_id', estId!)
        .gte('appointment_date', fromISO)
        .lte('appointment_date', toISO);
      if (error) throw error;
      return (data || []) as CommissionRow[];
    },
    enabled: !!estId,
    staleTime: 30000,
  });

  // ─── Computed metrics ───────────────────────────
  const appointments = appointmentsQuery.data || [];
  const services = servicesQuery.data || [];
  const professionals = professionalsQuery.data || [];
  const payments = paymentsQuery.data || [];
  const commissions = commissionsQuery.data || [];

  const serviceMap = Object.fromEntries(services.map(s => [s.id, s]));
  const profMap = Object.fromEntries(professionals.map(p => [p.id, p]));

  // Filter by status if set
  const filtered = filters.status
    ? appointments.filter(a => a.status === filters.status)
    : appointments;

  const total = filtered.length;
  const confirmed = filtered.filter(a => ['confirmed', 'booked', 'completed'].includes(a.status)).length;
  const canceled = filtered.filter(a => a.status === 'canceled').length;
  const noShow = filtered.filter(a => a.status === 'no_show').length;
  const completed = filtered.filter(a => a.status === 'completed').length;

  const confirmationRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const cancellationRate = total > 0 ? Math.round((canceled / total) * 100) : 0;
  const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;

  // Revenue (from service prices of completed appointments)
  const completedAppointments = appointments.filter(a => a.status === 'completed');
  const grossRevenue = completedAppointments.reduce((sum, a) => {
    return sum + (serviceMap[a.service_id]?.price_cents || 0);
  }, 0);
  const avgTicket = completedAppointments.length > 0 ? Math.round(grossRevenue / completedAppointments.length) : 0;

  // Top services
  const serviceCount: Record<string, number> = {};
  const serviceRevenue: Record<string, number> = {};
  filtered.forEach(a => {
    serviceCount[a.service_id] = (serviceCount[a.service_id] || 0) + 1;
  });
  completedAppointments.forEach(a => {
    serviceRevenue[a.service_id] = (serviceRevenue[a.service_id] || 0) + (serviceMap[a.service_id]?.price_cents || 0);
  });
  const topServices = Object.entries(serviceCount)
    .map(([id, count]) => ({
      id,
      name: serviceMap[id]?.name || 'Removido',
      count,
      revenue: serviceRevenue[id] || 0,
    }))
    .sort((a, b) => b.count - a.count);

  // By professional
  const profCount: Record<string, number> = {};
  const profRevenue: Record<string, number> = {};
  filtered.forEach(a => {
    profCount[a.professional_id] = (profCount[a.professional_id] || 0) + 1;
  });
  completedAppointments.forEach(a => {
    profRevenue[a.professional_id] = (profRevenue[a.professional_id] || 0) + (serviceMap[a.service_id]?.price_cents || 0);
  });
  const byProfessional = Object.entries(profCount)
    .map(([id, count]) => ({
      id,
      name: profMap[id]?.name || 'Removido',
      count,
      revenue: profRevenue[id] || 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Peak hours
  const hourCounts: Record<number, number> = {};
  filtered.forEach(a => {
    const h = getHours(parseISO(a.start_at));
    hourCounts[h] = (hourCounts[h] || 0) + 1;
  });
  const peakHours = Object.entries(hourCounts)
    .map(([h, count]) => ({ hour: `${h}:00`, count }))
    .sort((a, b) => b.count - a.count);

  // Peak weekdays
  const weekdayCounts: Record<number, number> = {};
  filtered.forEach(a => {
    const d = getDay(parseISO(a.start_at));
    weekdayCounts[d] = (weekdayCounts[d] || 0) + 1;
  });
  const peakWeekdays = Array.from({ length: 7 }, (_, i) => ({
    day: WEEKDAY_LABELS[i],
    count: weekdayCounts[i] || 0,
  }));

  // New vs recurring customers
  const customerAppointments: Record<string, string[]> = {};
  appointments.forEach(a => {
    if (!customerAppointments[a.customer_id]) customerAppointments[a.customer_id] = [];
    customerAppointments[a.customer_id].push(a.start_at);
  });
  const uniqueCustomers = Object.keys(customerAppointments).length;
  const recurringCustomers = Object.values(customerAppointments).filter(dates => dates.length > 1).length;
  const newCustomers = uniqueCustomers - recurringCustomers;

  // ─── Financial ──────────────────────────────────
  const paidPayments = payments.filter(p => p.status === 'approved');
  const totalReceived = paidPayments.reduce((s, p) => s + p.net_amount_cents, 0);
  const totalDeposits = paidPayments.filter(p => p.payment_type === 'deposit').reduce((s, p) => s + p.amount_cents, 0);
  const totalFullPayments = paidPayments.filter(p => p.payment_type === 'full').reduce((s, p) => s + p.amount_cents, 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount_cents, 0);
  const totalRefunded = payments.filter(p => p.refunded_at).reduce((s, p) => s + p.amount_cents, 0);
  const totalFees = paidPayments.reduce((s, p) => s + p.fee_cents, 0);

  const pendingCommissions = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount_cents, 0);
  const totalCommissions = commissions.reduce((s, c) => s + c.commission_amount_cents, 0);

  // Commission by professional
  const commissionByProf: Record<string, { name: string; pending: number; total: number }> = {};
  commissions.forEach(c => {
    if (!commissionByProf[c.professional_id]) {
      commissionByProf[c.professional_id] = { name: c.professional_name, pending: 0, total: 0 };
    }
    commissionByProf[c.professional_id].total += c.commission_amount_cents;
    if (c.status === 'pending') commissionByProf[c.professional_id].pending += c.commission_amount_cents;
  });

  // Revenue by service
  const revenueByService = topServices.map(s => ({
    ...s,
    revenue: serviceRevenue[s.id] || 0,
  }));

  return {
    // Loading
    isLoading: appointmentsQuery.isLoading || servicesQuery.isLoading || professionalsQuery.isLoading,
    isFinancialLoading: paymentsQuery.isLoading || commissionsQuery.isLoading,

    // Lookups
    services,
    professionals,

    // Performance metrics
    total,
    confirmed,
    canceled,
    noShow,
    completed,
    confirmationRate,
    cancellationRate,
    noShowRate,
    avgTicket,
    topServices,
    byProfessional,
    peakHours,
    peakWeekdays,
    uniqueCustomers,
    newCustomers,
    recurringCustomers,

    // Financial metrics
    grossRevenue,
    totalReceived,
    totalDeposits,
    totalFullPayments,
    totalPending,
    totalRefunded,
    totalFees,
    pendingCommissions,
    totalCommissions,
    commissionByProf: Object.values(commissionByProf),
    revenueByService,

    // Raw data for tables
    appointments: filtered,
    payments,
  };
}
