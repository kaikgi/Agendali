import { CalendarCheck, CalendarDays, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { isToday, parseISO, isAfter, isBefore, addDays, startOfMonth, endOfMonth } from 'date-fns';

interface PortalAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  service_duration: number;
  customer_notes: string | null;
}

interface ProfessionalSummaryCardsProps {
  appointments: PortalAppointment[];
}

export function ProfessionalSummaryCards({ appointments }: ProfessionalSummaryCardsProps) {
  const now = new Date();
  const todayCount = appointments.filter(
    (a) => isToday(parseISO(a.start_at)) && ['booked', 'confirmed'].includes(a.status)
  ).length;

  const next7Days = appointments.filter((a) => {
    const d = parseISO(a.start_at);
    return isAfter(d, now) && isBefore(d, addDays(now, 7)) && ['booked', 'confirmed'].includes(a.status);
  }).length;

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const completedMonth = appointments.filter((a) => {
    const d = parseISO(a.start_at);
    return isAfter(d, monthStart) && isBefore(d, monthEnd) && a.status === 'completed';
  }).length;

  const cards = [
    { label: 'Hoje', value: todayCount, icon: CalendarCheck, color: 'text-primary' },
    { label: 'Próximos 7 dias', value: next7Days, icon: CalendarDays, color: 'text-blue-600' },
    { label: 'Concluídos no mês', value: completedMonth, icon: CheckCircle2, color: 'text-green-600' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex items-center gap-4 p-4">
            <c.icon className={`h-8 w-8 ${c.color} shrink-0`} />
            <div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
