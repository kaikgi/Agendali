import { useState, useEffect, lazy, Suspense } from 'react';
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
import { ActionButton } from '@/components/ui/action-button';
import { MoneyInput } from '@/components/ui/money-input';
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
import { CreditCard, Link2, Link2Off, Settings2, DollarSign, CheckCircle2, XCircle, Clock, Search, ListChecks, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ServicePaymentSettingsTab from '@/components/payments/ServicePaymentSettingsTab';

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
        invalid_state: 'A validação de segurança da conexão falhou. Tente conectar novamente.',
        establishment_invalid: 'Não foi possível vincular a conta ao estabelecimento atual.',
        token_no_user: 'Conta Mercado Pago inválida: usuário não identificado.',
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
          <TabsTrigger value="services" disabled={!isConnected || !s?.per_service_config}>Serviços</TabsTrigger>
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
            <>
              {/* Active Rule Summary */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Regra ativa de cobrança</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {!s?.online_payment_enabled
                          ? 'Pagamento online desativado — nenhuma cobrança será feita no agendamento.'
                          : s?.full_payment_online
                            ? 'Cobrança de 100% do valor do serviço no momento do agendamento.'
                            : s?.deposit_required
                              ? s?.deposit_type === 'percentage'
                                ? `Cobrança de sinal de ${s?.deposit_value || 0}% sobre o valor do serviço.`
                                : `Cobrança de sinal fixo de R$ ${(s?.deposit_value || 0).toFixed(2).replace('.', ',')}.`
                              : 'Pagamento online ativado, mas nenhuma cobrança configurada.'}
                        {s?.online_payment_enabled && s?.require_manual_confirmation && ' Confirmação manual ativada.'}
                        {s?.online_payment_enabled && s?.per_service_config && ' Serviços podem ter regras individuais.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Configurações de Pagamento
                  </CardTitle>
                  <CardDescription>
                    Defina como seu estabelecimento cobra os clientes no agendamento online.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Enable/disable */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Pagamento online ativo</Label>
                      <p className="text-sm text-muted-foreground">Habilita cobrança durante o agendamento público</p>
                    </div>
                    <Switch
                      checked={s?.online_payment_enabled || false}
                      onCheckedChange={(v) => handleToggle('online_payment_enabled', v)}
                    />
                  </div>

                  {s?.online_payment_enabled && (
                    <>
                      <Separator />

                      {/* Full payment */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-semibold">Pagamento integral online</Label>
                          <p className="text-sm text-muted-foreground">Cobra 100% do valor do serviço antes de confirmar</p>
                        </div>
                        <Switch
                          checked={s?.full_payment_online || false}
                          onCheckedChange={(v) => {
                            const updated: any = { ...s, full_payment_online: v };
                            if (v) {
                              updated.deposit_required = false;
                              updated.deposit_value = 0;
                            }
                            setLocalSettings(updated);
                          }}
                        />
                      </div>

                      <Separator />

                      {/* Deposit settings */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-base font-semibold">Exigir sinal</Label>
                            <p className="text-sm text-muted-foreground">Cobra um sinal parcial no momento do agendamento</p>
                          </div>
                          <Switch
                            checked={s?.deposit_required || false}
                            disabled={s?.full_payment_online}
                            onCheckedChange={(v) => {
                              const updated: any = { ...s, deposit_required: v };
                              if (v) {
                                updated.full_payment_online = false;
                              }
                              setLocalSettings(updated);
                            }}
                          />
                        </div>

                        {s?.full_payment_online && (
                          <p className="text-xs text-muted-foreground italic pl-1">
                            Sinal desativado porque o pagamento integral está ativo.
                          </p>
                        )}

                        {s?.deposit_required && !s?.full_payment_online && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20">
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
                                value={s?.deposit_value ?? ''}
                                onChange={(e) => {
                                  let val = parseFloat(e.target.value);
                                  if (isNaN(val) || val < 0) val = 0;
                                  if (s?.deposit_type === 'percentage' && val > 100) val = 100;
                                  handleToggle('deposit_value', val);
                                }}
                              />
                              {s?.deposit_type === 'percentage' && (
                                <p className="text-xs text-muted-foreground">De 1% a 100% do valor do serviço</p>
                              )}
                              {s?.deposit_type === 'fixed' && (
                                <p className="text-xs text-muted-foreground">Valor em reais cobrado como sinal</p>
                              )}
                              {s?.deposit_required && (s?.deposit_value === 0 || !s?.deposit_value) && (
                                <p className="text-xs text-destructive font-medium">Informe um valor maior que zero</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Per-service config */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-semibold">Configuração por serviço</Label>
                          <p className="text-sm text-muted-foreground">Permite definir regras de cobrança individuais por serviço</p>
                        </div>
                        <Switch
                          checked={s?.per_service_config || false}
                          onCheckedChange={(v) => handleToggle('per_service_config', v)}
                        />
                      </div>

                      <Separator />

                      {/* Manual confirmation */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-base font-semibold">Confirmação manual após pagamento</Label>
                            <p className="text-sm text-muted-foreground">O agendamento ficará pendente até sua aprovação, mesmo após pagamento</p>
                          </div>
                          <Switch
                            checked={s?.require_manual_confirmation || false}
                            onCheckedChange={(v) => handleToggle('require_manual_confirmation', v)}
                          />
                        </div>
                        {s?.require_manual_confirmation && (
                          <p className="text-xs text-muted-foreground pl-1 italic">
                            O cliente receberá aviso de que o agendamento está aguardando confirmação.
                          </p>
                        )}
                      </div>

                      <Separator />

                      {/* Refund */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-base font-semibold">Reembolso em cancelamento</Label>
                            <p className="text-sm text-muted-foreground">Reembolsa automaticamente se o cliente cancelar dentro do prazo</p>
                          </div>
                          <Switch
                            checked={s?.refund_on_cancellation || false}
                            onCheckedChange={(v) => handleToggle('refund_on_cancellation', v)}
                          />
                        </div>
                        {s?.refund_on_cancellation && (
                          <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                            <Label>Prazo mínimo para reembolso (horas antes do atendimento)</Label>
                            <Input
                              type="number"
                              min="1"
                              max="168"
                              value={s?.refund_deadline_hours || 24}
                              onChange={(e) => {
                                let val = parseInt(e.target.value);
                                if (isNaN(val) || val < 1) val = 1;
                                if (val > 168) val = 168;
                                handleToggle('refund_deadline_hours', val);
                              }}
                              className="w-32"
                            />
                            <p className="text-xs text-muted-foreground">
                              Cancelamentos com menos de {s?.refund_deadline_hours || 24}h de antecedência não serão reembolsados.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Save */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={handleSaveSettings}
                      disabled={updateSettings.isPending || (s?.deposit_required && !s?.full_payment_online && (!s?.deposit_value || s?.deposit_value <= 0))}
                    >
                      {updateSettings.isPending ? 'Salvando...' : 'Salvar configurações'}
                    </Button>
                    {localSettings && (
                      <Button variant="ghost" onClick={() => setLocalSettings(null)}>
                        Descartar alterações
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Services Tab ─────────────────────────────── */}
        <TabsContent value="services" className="space-y-4">
          {isConnected && s?.per_service_config ? (
            <ServicePaymentSettingsTab />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Ative "Configuração por serviço" na aba Configurações para personalizar regras por serviço.</p>
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
