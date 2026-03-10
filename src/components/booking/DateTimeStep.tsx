import { useState } from 'react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Loader2, Clock, CalendarX, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { SlotResult } from '@/hooks/useAvailableSlots';

interface DateTimeStepProps {
  selectedDate: Date | undefined;
  selectedTime: string | null;
  onSelectDate: (date: Date | undefined) => void;
  onSelectTime: (time: string) => void;
  slotResult: SlotResult | undefined;
  isLoadingSlots: boolean;
  maxFutureDays: number;
}

function getEmptyMessage(reason?: string): { icon: React.ReactNode; title: string; description: string } {
  switch (reason) {
    case 'closed':
      return {
        icon: <CalendarX className="h-5 w-5 text-muted-foreground" />,
        title: 'Estabelecimento fechado',
        description: 'O estabelecimento não abre neste dia. Escolha outra data.',
      };
    case 'professional_closed':
      return {
        icon: <CalendarX className="h-5 w-5 text-muted-foreground" />,
        title: 'Profissional de folga',
        description: 'Este profissional não atende neste dia. Escolha outra data.',
      };
    case 'all_past':
      return {
        icon: <Clock className="h-5 w-5 text-muted-foreground" />,
        title: 'Horários encerrados',
        description: 'Todos os horários de hoje já passaram. Escolha outro dia.',
      };
    case 'all_booked':
      return {
        icon: <AlertCircle className="h-5 w-5 text-muted-foreground" />,
        title: 'Agenda lotada',
        description: 'Todos os horários deste dia estão ocupados. Tente outra data.',
      };
    default:
      return {
        icon: <CalendarX className="h-5 w-5 text-muted-foreground" />,
        title: 'Nenhum horário disponível',
        description: 'Não há horários disponíveis nesta data. Tente outra data.',
      };
  }
}

export function DateTimeStep({
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  slotResult,
  isLoadingSlots,
  maxFutureDays,
}: DateTimeStepProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  const today = startOfDay(new Date());
  const maxDate = addDays(today, maxFutureDays);

  const availableSlots = slotResult?.slots ?? [];
  const emptyReason = slotResult?.reason;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Escolha a data e horário</h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Data</label>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !selectedDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, "d 'de' MMMM, yyyy", { locale: ptBR })
                ) : (
                  <span>Selecione uma data</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  onSelectDate(date);
                  setIsCalendarOpen(false);
                }}
                disabled={(date) =>
                  isBefore(date, today) || isBefore(maxDate, date)
                }
                initialFocus
                locale={ptBR}
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>

        {selectedDate && (
          <div>
            <label className="text-sm font-medium mb-2 block">Horário</label>
            {isLoadingSlots ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Carregando horários...</span>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                {(() => {
                  const msg = getEmptyMessage(emptyReason);
                  return (
                    <>
                      {msg.icon}
                      <p className="font-medium text-sm">{msg.title}</p>
                      <p className="text-sm text-muted-foreground max-w-xs">{msg.description}</p>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {availableSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => onSelectTime(time)}
                    className={cn(
                      'py-3 px-3 rounded-md text-sm font-medium transition-colors',
                      'border',
                      selectedTime === time
                        ? 'bg-foreground text-background border-foreground'
                        : 'border-border hover:border-foreground/50'
                    )}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
