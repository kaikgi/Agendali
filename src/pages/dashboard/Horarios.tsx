import { useState, useEffect } from 'react';
import { Clock, Save, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { useToast } from '@/hooks/use-toast';

interface HourRow {
  weekday: number;
  open_time: string;
  close_time: string;
  closed: boolean;
}

const DEFAULT_HOURS: HourRow[] = [
  { weekday: 0, open_time: '', close_time: '', closed: true },
  { weekday: 1, open_time: '09:00', close_time: '18:00', closed: false },
  { weekday: 2, open_time: '09:00', close_time: '18:00', closed: false },
  { weekday: 3, open_time: '09:00', close_time: '18:00', closed: false },
  { weekday: 4, open_time: '09:00', close_time: '18:00', closed: false },
  { weekday: 5, open_time: '09:00', close_time: '18:00', closed: false },
  { weekday: 6, open_time: '09:00', close_time: '13:00', closed: false },
];

export default function Horarios() {
  const { data: establishment, isLoading: estLoading, error: estError, refetch: refetchEst } = useUserEstablishment();
  const { hours, isLoading, error, refetch, upsert, isUpdating, WEEKDAYS } = useBusinessHours(establishment?.id);
  const { toast } = useToast();
  
  const [localHours, setLocalHours] = useState<HourRow[]>(DEFAULT_HOURS);

  useEffect(() => {
    if (hours.length > 0) {
      const mapped = DEFAULT_HOURS.map((def) => {
        const found = hours.find((h) => h.weekday === def.weekday);
        if (found) {
          return {
            weekday: found.weekday,
            open_time: found.open_time || '',
            close_time: found.close_time || '',
            closed: found.closed,
          };
        }
        return def;
      });
      setLocalHours(mapped);
    }
  }, [hours]);

  const handleToggleClosed = (weekday: number, closed: boolean) => {
    setLocalHours((prev) =>
      prev.map((h) =>
        h.weekday === weekday ? { ...h, closed } : h
      )
    );
  };

  const handleTimeChange = (weekday: number, field: 'open_time' | 'close_time', value: string) => {
    setLocalHours((prev) =>
      prev.map((h) =>
        h.weekday === weekday ? { ...h, [field]: value } : h
      )
    );
  };

  const handleSave = async () => {
    if (!establishment?.id) throw new Error('missing establishment');

    try {
      const toUpsert = localHours.map((h) => ({
        establishment_id: establishment.id,
        weekday: h.weekday,
        open_time: h.closed ? null : h.open_time || null,
        close_time: h.closed ? null : h.close_time || null,
        closed: h.closed,
      }));

      await upsert(toUpsert);
      toast({ title: 'Horários salvos com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao salvar horários', variant: 'destructive' });
      throw error;
    }
  };

  const handleRetry = () => {
    if (estError) refetchEst();
    else refetch();
  };

  if (estLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (estError || error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Erro ao carregar horários</p>
        <Button variant="outline" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Horários de Funcionamento</h1>
          <p className="text-muted-foreground">
            Configure os horários em que seu estabelecimento está aberto
          </p>
        </div>
        <ActionButton
          onClick={handleSave}
          icon={<Save className="h-4 w-4" />}
          loadingLabel="Salvando..."
          successLabel="Salvo!"
          className="w-full sm:w-auto"
        >
          Salvar
        </ActionButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horários por Dia da Semana
          </CardTitle>
          <CardDescription>
            Defina os horários de abertura e fechamento para cada dia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {localHours.map((row) => (
              <div
                key={row.weekday}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b border-border last:border-0"
              >
                <div className="w-24 font-medium shrink-0">{WEEKDAYS[row.weekday]}</div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!row.closed}
                    onCheckedChange={(open) => handleToggleClosed(row.weekday, !open)}
                  />
                  <span className="text-sm text-muted-foreground w-16">
                    {row.closed ? 'Fechado' : 'Aberto'}
                  </span>
                </div>

                {!row.closed && (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={row.open_time}
                      onChange={(e) => handleTimeChange(row.weekday, 'open_time', e.target.value)}
                      className="w-28 sm:w-32"
                    />
                    <span className="text-muted-foreground text-sm">até</span>
                    <Input
                      type="time"
                      value={row.close_time}
                      onChange={(e) => handleTimeChange(row.weekday, 'close_time', e.target.value)}
                      className="w-28 sm:w-32"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
