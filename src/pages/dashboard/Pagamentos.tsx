import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FeatureGate } from '@/components/dashboard/FeatureGate';
import {
  usePaymentAccount,
  usePaymentSettings,
  useUpdatePaymentSettings,
  useConnectMercadoPago,
  useDisconnectMercadoPago,
  useAppointmentPayments,
} from '@/hooks/usePayments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { CreditCard, Link2, Link2Off, Settings2, DollarSign, CheckCircle2, XCircle, Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  refunded: { label: 'Reembolsado', variant: 'outline' },
  in_process: { label: 'Processando', variant: 'secondary' },
};

export default function Pagamentos() {
  return (
    <FeatureGate feature="online_payments">
      <PagamentosContent />
    </FeatureGate>
  );
}

function PagamentosContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: account, isLoading: accLoading } = usePaymentAccount();
  const { data: settings, isLoading: settLoading } = usePaymentSettings();
  const updateSettings = useUpdatePaymentSettings();
  const connectMP = useConnectMercadoPago();
  const disconnectMP = useDisconnectMercadoPago();

  const [paymentFilters, setPaymentFilters] = useState<{ status?: string }>({});
  const { data: payments = [], isLoading: paymentsLoading } = useAppointmentPayments(paymentFilters);

  // Handle OAuth return
  useEffect(() => {
    const mpConnected = searchParams.get('mp_connected');
    const mpError = searchParams.get('mp_error');

    if (mpConnected === 'true') {
      toast.success('Conta do Mercado Pago conectada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['payment-account'] });
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('mp_connected');
      setSearchParams(newParams, { replace: true });
    }

    if (mpError) {
      const errorMessages: Record<string, string> = {
        token_exchange_failed: 'Falha ao conectar com o Mercado Pago. Tente novamente.',
        save_failed: 'Erro ao salvar a conexão. Tente novamente.',
        config_missing: 'Mercado Pago não está configurado. Contate o suporte.',
      };
      toast.error(errorMessages[mpError] || 'Erro ao conectar com o Mercado Pago.');
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('mp_error');
      setSearchParams(newParams, { replace: true });
    }
  }, []);

  // Local settings state
  const [localSettings, setLocalSettings] = useState<any>(null);
  const s = localSettings || settings;

  const handleToggle = (key: string, value: any) => {
    const updated = { ...s, [key]: value };
    setLocalSettings(updated);
  };

  const handleSaveSettings = async () => {
    if (!s) return;
    try {
      await updateSettings.mutateAsync(s);
      setLocalSettings(null);
      toast.success('Configurações salvas');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    }
  };

  const isConnected = account?.status === 'active';
  const isLoading = accLoading || settLoading;

  // Summary
  const totalReceived = payments.filter((p) => p.status === 'approved').reduce((sum, p) => sum + p.amount_cents, 0);
  const totalPending = payments.filter((p) => p.status === 'pending' || p.status === 'in_process').reduce((sum, p) => sum + p.amount_cents, 0);
  const totalFees = payments.filter((p) => p.status === 'approved').reduce((sum, p) => sum + p.fee_cents, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos Online</h1>
        <p className="text-muted-foreground text-sm">Configure pagamentos via Mercado Pago e acompanhe recebimentos</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <CheckCircle2 className="h-4 w-4" />
              Recebido
            </div>
            <p className="text-xl font-bold">{formatCents(totalReceived)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="h-4 w-4" />
              Pendente
            </div>
            <p className="text-xl font-bold">{formatCents(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Taxas MP
            </div>
            <p className="text-xl font-bold">{formatCents(totalFees)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="connection" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connection">Conexão</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
        </TabsList>

        {/* ── Connection Tab ──────────────────────────── */}
        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Mercado Pago
              </CardTitle>
              <CardDescription>
                Conecte sua conta do Mercado Pago para receber pagamentos online dos seus clientes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-muted'}`} />
                  <div>
                    <p className="font-medium">{isConnected ? 'Conta conectada' : 'Não conectado'}</p>
                    {isConnected && account?.mp_user_id && (
                      <p className="text-sm text-muted-foreground">ID: {account.mp_user_id}</p>
                    )}
                    {isConnected && account?.connected_at && (
                      <p className="text-sm text-muted-foreground">
                        Conectado em {format(new Date(account.connected_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
                {isConnected ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('Deseja desconectar sua conta do Mercado Pago?')) {
                        disconnectMP.mutate(undefined, {
                          onSuccess: () => toast.success('Conta desconectada'),
                          onError: () => toast.error('Erro ao desconectar'),
                        });
                      }
                    }}
                    disabled={disconnectMP.isPending}
                  >
                    <Link2Off className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    onClick={() => connectMP.mutate()}
                    disabled={connectMP.isPending}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    {connectMP.isPending ? 'Conectando...' : 'Conectar Mercado Pago'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings Tab ────────────────────────────── */}
        <TabsContent value="settings" className="space-y-4">
          {!isConnected ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Conecte sua conta do Mercado Pago primeiro para configurar pagamentos.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Configurações de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enable/disable */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Pagamento online ativo</Label>
                    <p className="text-sm text-muted-foreground">Habilita cobrança durante o agendamento</p>
                  </div>
                  <Switch
                    checked={s?.online_payment_enabled || false}
                    onCheckedChange={(v) => handleToggle('online_payment_enabled', v)}
                  />
                </div>

                <Separator />

                {/* Deposit settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Exigir sinal</Label>
                      <p className="text-sm text-muted-foreground">Cobra um sinal no momento do agendamento</p>
                    </div>
                    <Switch
                      checked={s?.deposit_required || false}
                      onCheckedChange={(v) => handleToggle('deposit_required', v)}
                    />
                  </div>

                  {s?.deposit_required && (
                    <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20">
                      <div className="space-y-2">
                        <Label>Tipo de sinal</Label>
                        <Select value={s?.deposit_type || 'fixed'} onValueChange={(v) => handleToggle('deposit_type', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                            <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{s?.deposit_type === 'percentage' ? 'Porcentagem (%)' : 'Valor (R$)'}</Label>
                        <Input
                          type="number"
                          min="0"
                          step={s?.deposit_type === 'percentage' ? '1' : '0.01'}
                          max={s?.deposit_type === 'percentage' ? '100' : undefined}
                          value={s?.deposit_value || ''}
                          onChange={(e) => handleToggle('deposit_value', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Full payment */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Pagamento integral online</Label>
                    <p className="text-sm text-muted-foreground">Cobra 100% do valor do serviço online</p>
                  </div>
                  <Switch
                    checked={s?.full_payment_online || false}
                    onCheckedChange={(v) => handleToggle('full_payment_online', v)}
                  />
                </div>

                <Separator />

                {/* Per-service config */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Configuração por serviço</Label>
                    <p className="text-sm text-muted-foreground">Permite regras diferentes para cada serviço</p>
                  </div>
                  <Switch
                    checked={s?.per_service_config || false}
                    onCheckedChange={(v) => handleToggle('per_service_config', v)}
                  />
                </div>

                <Separator />

                {/* Manual confirmation */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Confirmação manual</Label>
                    <p className="text-sm text-muted-foreground">Requer aprovação do estabelecimento após pagamento</p>
                  </div>
                  <Switch
                    checked={s?.require_manual_confirmation || false}
                    onCheckedChange={(v) => handleToggle('require_manual_confirmation', v)}
                  />
                </div>

                <Separator />

                {/* Refund */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Reembolso em cancelamento</Label>
                      <p className="text-sm text-muted-foreground">Reembolsa automaticamente ao cancelar</p>
                    </div>
                    <Switch
                      checked={s?.refund_on_cancellation || false}
                      onCheckedChange={(v) => handleToggle('refund_on_cancellation', v)}
                    />
                  </div>
                  {s?.refund_on_cancellation && (
                    <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                      <Label>Prazo para reembolso (horas antes do atendimento)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={s?.refund_deadline_hours || 24}
                        onChange={(e) => handleToggle('refund_deadline_hours', parseInt(e.target.value) || 24)}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>
                    {updateSettings.isPending ? 'Salvando...' : 'Salvar configurações'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Payments Tab ────────────────────────────── */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex gap-3">
            <Select
              value={paymentFilters.status || 'all'}
              onValueChange={(v) => setPaymentFilters((f) => ({ ...f, status: v === 'all' ? undefined : v }))}
            >
              <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="refunded">Reembolsado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : payments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhum pagamento encontrado</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const sl = statusLabels[p.status] || { label: p.status, variant: 'secondary' as const };
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(p.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{p.payment_type === 'deposit' ? 'Sinal' : 'Integral'}</Badge>
                        </TableCell>
                        <TableCell>{p.payer_email || '—'}</TableCell>
                        <TableCell className="text-right">{formatCents(p.amount_cents)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCents(p.fee_cents)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCents(p.net_amount_cents)}</TableCell>
                        <TableCell>
                          <Badge variant={sl.variant}>{sl.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
