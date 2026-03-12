import { useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  addMonths,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { statusColors, dotColors } from '@/lib/appointmentStatus';

interface ProfessionalCalendarViewProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  appointments: PortalAppointment[];
  onAppointmentClick: (appointment: PortalAppointment) => void;
  isLoading?: boolean;
}

export function ProfessionalCalendarView({
  currentMonth,
  onMonthChange,
  appointments,
  onAppointmentClick,
  isLoading,
}: ProfessionalCalendarViewProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, PortalAppointment[]>();
    for (const apt of appointments) {
      const key = format(parseISO(apt.start_at), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    }
    // Sort each day's appointments
    for (const [, apts] of map) {
      apts.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    }
    return map;
  }, [appointments]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => onMonthChange(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <h3 className="text-lg font-semibold capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 bg-muted">
          {weekDays.map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayApts = appointmentsByDay.get(key) || [];
            const inMonth = isSameMonth(day, currentMonth);

            return (
              <div
                key={key}
                className={cn(
                  'min-h-[80px] sm:min-h-[100px] border-t border-r p-1 relative',
                  !inMonth && 'bg-muted/30',
                  isToday(day) && 'bg-primary/5'
                )}
              >
                <span
                  className={cn(
                    'text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full',
                    !inMonth && 'text-muted-foreground/50',
                    isToday(day) && 'bg-primary text-primary-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>

                {/* Appointments */}
                <div className="space-y-0.5 mt-0.5">
                  {dayApts.slice(0, 3).map((apt) => (
                    <button
                      key={apt.id}
                      onClick={() => onAppointmentClick(apt)}
                      className={cn(
                        'w-full text-left text-[10px] sm:text-xs px-1 py-0.5 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity',
                        statusColors[apt.status]
                      )}
                    >
                      <span className="hidden sm:inline">
                        {format(parseISO(apt.start_at), 'HH:mm')} {apt.customer_name}
                      </span>
                      <span className="sm:hidden flex items-center gap-0.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[apt.status])} />
                        {format(parseISO(apt.start_at), 'HH:mm')}
                      </span>
                    </button>
                  ))}
                  {dayApts.length > 3 && (
                    <p className="text-[10px] text-muted-foreground text-center">
                      +{dayApts.length - 3}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
