import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useProfessionalHours } from '@/hooks/useProfessionalHours';
import { useToast } from '@/hooks/use-toast';

interface HourRow {
  weekday: number;
  start_time: string;
  end_time: string;
  closed: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: string;
  professionalName: string;
}

const DEFAULT_HOURS: HourRow[] = [
  { weekday: 0, start_time: '', end_time: '', closed: true },
  { weekday: 1, start_time: '09:00', end_time: '18:00', closed: false },
  { weekday: 2, start_time: '09:00', end_time: '18:00', closed: false },
  { weekday: 3, start_time: '09:00', end_time: '18:00', closed: false },
  { weekday: 4, start_time: '09:00', end_time: '18:00', closed: false },
  { weekday: 5, start_time: '09:00', end_time: '18:00', closed: false },
  { weekday: 6, start_time: '09:00', end_time: '13:00', closed: false },
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function ProfessionalHoursDialog({ open, onOpenChange, professionalId, professionalName }: Props) {
  const { hours, isLoading, upsert, isUpdating } = useProfessionalHours(professionalId);
  const { toast } = useToast();
  
  const [useCustomHours, setUseCustomHours] = useState(false);
  const [localHours, setLocalHours] = useState<HourRow[]>(DEFAULT_HOURS);

  useEffect(() => {
    if (hours.length > 0) {
      setUseCustomHours(true);
      const mapped = DEFAULT_HOURS.map((def) => {
        const found = hours.find((h) => h.weekday === def.weekday);
        if (found) {
          return {
            weekday: found.weekday,
            start_time: found.start_time || '',
            end_time: found.end_time || '',
            closed: found.closed,
          };
        }
        return def;
      });
      setLocalHours(mapped);
    } else {
      setUseCustomHours(false);
      setLocalHours(DEFAULT_HOURS);
    }
  }, [hours, professionalId]);

  const handleToggleClosed = (weekday: number, closed: boolean) => {
    setLocalHours((prev) =>
      prev.map((h) =>
        h.weekday === weekday ? { ...h, closed } : h
      )
    );
  };

  const handleTimeChange = (weekday: number, field: 'start_time' | 'end_time', value: string) => {
    setLocalHours((prev) =>
      prev.map((h) =>
        h.weekday === weekday ? { ...h, [field]: value } : h
      )
    );
  };

  const handleSave = async () => {
    try {
      if (useCustomHours) {
        const toUpsert = localHours.map((h) => ({
          professional_id: professionalId,
          weekday: h.weekday,
          start_time: h.closed ? null : h.start_time || null,
          end_time: h.closed ? null : h.end_time || null,
          closed: h.closed,
        }));
        await upsert(toUpsert);
      } else {
        // Remove custom hours - use establishment hours
        await upsert([]);
      }
      toast({ title: 'Horários salvos!' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Erro ao salvar horários', variant: 'destructive' });
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horários de {professionalName}
          </DialogTitle>
          <DialogDescription>
            Configure os horários individuais deste profissional
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Checkbox
              id="customHours"
              checked={useCustomHours}
              onCheckedChange={(checked) => setUseCustomHours(!!checked)}
            />
            <div>
              <Label htmlFor="customHours" className="font-medium">
                Usar horários personalizados
              </Label>
              <p className="text-sm text-muted-foreground">
                Se desativado, usa os horários do estabelecimento
              </p>
            </div>
          </div>

          {useCustomHours && (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {localHours.map((row) => (
                <div
                  key={row.weekday}
                  className="flex items-center gap-3 py-2"
                >
                  <div className="w-12 text-sm font-medium">{WEEKDAYS[row.weekday]}</div>
                  
                  <Switch
                    checked={!row.closed}
                    onCheckedChange={(open) => handleToggleClosed(row.weekday, !open)}
                  />

                  {!row.closed ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={row.start_time}
                        onChange={(e) => handleTimeChange(row.weekday, 'start_time', e.target.value)}
                        className="h-8"
                      />
                      <span className="text-muted-foreground text-sm">-</span>
                      <Input
                        type="time"
                        value={row.end_time}
                        onChange={(e) => handleTimeChange(row.weekday, 'end_time', e.target.value)}
                        className="h-8"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Folga</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <ActionButton onClick={handleSave} loadingLabel="Salvando..." successLabel="Salvo!">
            Salvar
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
