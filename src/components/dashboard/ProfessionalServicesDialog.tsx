import { useState, useEffect } from 'react';
import { Scissors, Check } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfessionalServices } from '@/hooks/useProfessionalServices';
import { useManageServices } from '@/hooks/useManageServices';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: string;
  professionalName: string;
  establishmentId: string;
}

export function ProfessionalServicesDialog({
  open,
  onOpenChange,
  professionalId,
  professionalName,
  establishmentId,
}: Props) {
  const { services, isLoading: servicesLoading } = useManageServices(establishmentId);
  const { serviceIds, isLoading: linksLoading, update, isUpdating } = useProfessionalServices(professionalId);
  const { toast } = useToast();

  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSelected(serviceIds);
  }, [serviceIds]);

  const handleToggle = (serviceId: string) => {
    setSelected((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSelectAll = () => {
    if (selected.length === services.length) {
      setSelected([]);
    } else {
      setSelected(services.map((s) => s.id));
    }
  };

  const handleSave = async () => {
    try {
      await update(selected);
      toast({ title: 'Serviços vinculados com sucesso!' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Erro ao vincular serviços', variant: 'destructive' });
      throw error;
    }
  };

  const isLoading = servicesLoading || linksLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Serviços de {professionalName}
          </DialogTitle>
          <DialogDescription>
            Selecione quais serviços este profissional pode realizar
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum serviço cadastrado. Cadastre serviços primeiro.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b">
                <span className="text-sm font-medium">
                  {selected.length} de {services.length} selecionados
                </span>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selected.length === services.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </Button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleToggle(service.id)}
                  >
                    <Checkbox
                      checked={selected.includes(service.id)}
                      onCheckedChange={() => handleToggle(service.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <Label className="font-medium cursor-pointer">{service.name}</Label>
                      <p className="text-xs text-muted-foreground">
                        {service.duration_minutes} min
                        {service.price_cents && ` • R$ ${(service.price_cents / 100).toFixed(2)}`}
                      </p>
                    </div>
                    {selected.includes(service.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <ActionButton onClick={handleSave} disabled={services.length === 0} loadingLabel="Salvando..." successLabel="Salvo!">
            Salvar
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
