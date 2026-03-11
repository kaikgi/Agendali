import { useState } from 'react';
import { useManageServices, type Service } from '@/hooks/useManageServices';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import {
  useServicePaymentSettings,
  useUpsertServicePaymentSetting,
  useDeleteServicePaymentSetting,
  type ServicePaymentSetting,
} from '@/hooks/usePayments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { MoneyInput } from '@/components/ui/money-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Pencil, Trash2, DollarSign, ShieldCheck } from 'lucide-react';

function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getRuleLabel(sps: ServicePaymentSetting | undefined): string {
  if (!sps) return 'Regra global';
  if (sps.full_payment_online) return 'Pagamento total';
  if (sps.deposit_required) {
    return sps.deposit_type === 'percentage'
      ? `Sinal de ${sps.deposit_value}%`
      : `Sinal de R$ ${(sps.deposit_value || 0).toFixed(2).replace('.', ',')}`;
  }
  return 'Sem cobrança';
}

export default function ServicePaymentSettingsTab() {
  const { data: est } = useUserEstablishment();
  const { services, isLoading: servicesLoading } = useManageServices(est?.id);
  const { data: spsAll = [], isLoading: spsLoading } = useServicePaymentSettings();
  const upsertSps = useUpsertServicePaymentSetting();
  const deleteSps = useDeleteServicePaymentSetting();

  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editForm, setEditForm] = useState<{
    deposit_required: boolean;
    deposit_type: 'fixed' | 'percentage';
    deposit_value: number;
    full_payment_online: boolean;
  }>({ deposit_required: false, deposit_type: 'fixed', deposit_value: 0, full_payment_online: false });

  const spsMap = new Map(spsAll.map((s) => [s.service_id, s]));

  const activeServices = services.filter((s) => s.active);

  const openEdit = (service: Service) => {
    const existing = spsMap.get(service.id);
    setEditForm({
      deposit_required: existing?.deposit_required ?? false,
      deposit_type: existing?.deposit_type ?? 'fixed',
      deposit_value: existing?.deposit_value ?? 0,
      full_payment_online: existing?.full_payment_online ?? false,
    });
    setEditingService(service);
  };

  const handleSave = async () => {
    if (!editingService) return;
    try {
      await upsertSps.mutateAsync({
        service_id: editingService.id,
        ...editForm,
      });
      toast.success(`Regra salva para "${editingService.name}"`);
      setEditingService(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    }
  };

  const handleRemoveOverride = async (sps: ServicePaymentSetting, serviceName: string) => {
    try {
      await deleteSps.mutateAsync(sps.id);
      toast.success(`"${serviceName}" voltou a usar a regra global`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover');
    }
  };

  const isLoading = servicesLoading || spsLoading;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
      </div>
    );
  }

  if (activeServices.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Nenhum serviço ativo encontrado. Crie serviços primeiro.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Cobrança por Serviço
          </CardTitle>
          <CardDescription>
            Defina regras de pagamento específicas. Serviços sem regra própria usam a configuração global.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serviço</TableHead>
                <TableHead className="hidden sm:table-cell">Preço</TableHead>
                <TableHead>Regra de cobrança</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeServices.map((service) => {
                const sps = spsMap.get(service.id);
                const hasOverride = !!sps;
                return (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {formatCents(service.price_cents)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={hasOverride ? 'default' : 'secondary'}>
                          {getRuleLabel(sps)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(service)} title="Editar regra">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {hasOverride && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOverride(sps, service.name)}
                            disabled={deleteSps.isPending}
                            title="Remover regra e usar global"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regra de cobrança — {editingService?.name}</DialogTitle>
          </DialogHeader>

          {editingService && (
            <div className="space-y-5 py-2">
              <div className="text-sm text-muted-foreground">
                Preço do serviço: <span className="font-medium text-foreground">{formatCents(editingService.price_cents)}</span>
              </div>

              <Separator />

              {/* Full payment */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Pagamento total online</Label>
                  <p className="text-xs text-muted-foreground">Cobra 100% antes de confirmar</p>
                </div>
                <Switch
                  checked={editForm.full_payment_online}
                  onCheckedChange={(v) => {
                    setEditForm((f) => ({
                      ...f,
                      full_payment_online: v,
                      ...(v ? { deposit_required: false, deposit_value: 0 } : {}),
                    }));
                  }}
                />
              </div>

              <Separator />

              {/* Deposit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Exigir sinal</Label>
                    <p className="text-xs text-muted-foreground">Cobra um sinal parcial</p>
                  </div>
                  <Switch
                    checked={editForm.deposit_required}
                    disabled={editForm.full_payment_online}
                    onCheckedChange={(v) => {
                      setEditForm((f) => ({
                        ...f,
                        deposit_required: v,
                        ...(v ? { full_payment_online: false } : {}),
                      }));
                    }}
                  />
                </div>

                {editForm.deposit_required && !editForm.full_payment_online && (
                  <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={editForm.deposit_type}
                        onValueChange={(v: 'fixed' | 'percentage') => setEditForm((f) => ({ ...f, deposit_type: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                          <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{editForm.deposit_type === 'percentage' ? '% do serviço' : 'Valor (R$)'}</Label>
                      <MoneyInput
                        mode={editForm.deposit_type === 'percentage' ? 'percentage' : 'currency'}
                        value={editForm.deposit_value || null}
                        onChange={(val) => setEditForm((f) => ({ ...f, deposit_value: val ?? 0 }))}
                      />
                      {editForm.deposit_required && editForm.deposit_value <= 0 && (
                        <p className="text-xs text-destructive">Informe um valor maior que zero</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!editForm.full_payment_online && !editForm.deposit_required && (
                <p className="text-xs text-muted-foreground italic">
                  Este serviço não terá cobrança online — a regra global será ignorada para ele.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingService(null)}>Cancelar</Button>
            <ActionButton
              onClick={handleSave}
              disabled={editForm.deposit_required && !editForm.full_payment_online && editForm.deposit_value <= 0}
              loadingLabel="Salvando..."
              successLabel="Salvo!"
            >
              Salvar regra
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
