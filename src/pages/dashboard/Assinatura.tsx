import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSubscription, getBillingCycleLabel } from '@/hooks/useSubscription';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useAuth } from '@/hooks/useAuth';
import { PLANS, type BillingPeriod, formatCentsBRL } from '@/lib/hardcodedPlans';
import { getPlanEntitlements, formatLimit } from '@/lib/planEntitlements';
import { PlanCardsGrid } from '@/components/billing/PlanCardsGrid';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CreditCard,
  Users,
  Calendar,
  ExternalLink,
  Crown,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Repeat,
  Settings,
  ArrowUpRight,
  XCircle,
  Shield,
  Zap,
  Info,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInteractiveGuide, GuideOverlay, type GuideStep } from '@/components/guide';

const ASSINATURA_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'intro',
    title: 'Sua Assinatura',
    description: 'Aqui você acompanha seu plano atual, limites de uso (profissionais, agendamentos) e o status do pagamento.',
  },
  {
    id: 'cancel',
    title: 'Como cancelar',
    description: 'A assinatura é gerenciada pela Kiwify, não por aqui. Clique em "Cancelar assinatura" pra ser levado até a Kiwify e concluir o cancelamento por lá. Seu acesso continua até o fim do período já pago.',
    target: '[data-guide="assinatura-cancel"]',
    placement: 'top',
  },
];

const KIWIFY_MANAGE_URL = 'https://dashboard.kiwify.com.br';

export default function Assinatura() {
  const guide = useInteractiveGuide('assinatura', ASSINATURA_GUIDE_STEPS);
  const { user } = useAuth();
  const { data: subscription, isLoading: subscriptionLoading, error: subError } = useSubscription();
  const { data: establishment, isLoading: establishmentLoading, error: estError } = useUserEstablishment();
  const { data: limits, isLoading: limitsLoading, error: limitsError } = usePlanLimits(establishment?.id);

  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const isLoading = subscriptionLoading || establishmentLoading || limitsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const pageError = estError || subError || limitsError;

  if (pageError) {
    const errorMsg = (pageError as any)?.message || 'Erro desconhecido';
    console.error('[Assinatura] Error:', pageError);
    
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-destructive mb-2 font-bold text-lg">Erro ao carregar dados da assinatura</p>
        <p className="text-sm text-muted-foreground mb-4">
          {errorMsg === 'JWT expired' ? 'Sua sessão expirou. Por favor, faça login novamente.' : 'Verifique sua conexão ou tente novamente mais tarde.'}
        </p>
        <p className="text-xs text-muted-foreground bg-muted p-2 rounded max-w-md mx-auto overflow-hidden text-ellipsis mb-6">
          Detalhes: {errorMsg}
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Recarregar página
        </Button>
      </div>
    );
  }

  const est = establishment as any;
  const estStatus = (est?.status || '').toLowerCase();
  const estPlano = (est?.plano || '').toLowerCase();

  const hasActiveSubscription = subscription?.status === 'active' || subscription?.status === 'past_due' || subscription?.status === 'trialing';

  let displayPlanCode: string;
  if (hasActiveSubscription) {
    displayPlanCode = (subscription?.plan_code || subscription?.plan || 'solo').toLowerCase();
  } else if (estPlano && estPlano !== 'nenhum') {
    displayPlanCode = estPlano;
  } else {
    displayPlanCode = 'solo';
  }

  const currentPlan = PLANS.find(p => p.code === displayPlanCode) || PLANS[0];
  const entitlements = getPlanEntitlements(
    subscription?.status || estStatus, 
    displayPlanCode, 
    subscription?.current_period_end, 
    establishment?.trial_ends_at
  );

  const billingCycle = (subscription?.billing_cycle || 'monthly').toLowerCase() as BillingPeriod;
  const billingCycleLabel = getBillingCycleLabel(billingCycle);

  const periodEnd = subscription?.current_period_end
    ? format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  const profLimit = entitlements.professionalLimit;
  const profCurrent = limits?.currentProfessionals ?? 0;
  const isNearProfessionalsLimit = profLimit !== Infinity && profLimit > 0
    ? (profCurrent / profLimit) >= 0.8
    : false;

  const isMaxPlan = displayPlanCode === 'pro';
  const currentPrice = currentPlan.prices[billingCycle] || currentPlan.prices.monthly;

  // Plan tier index for upgrade/downgrade labeling
  const planIndex = PLANS.findIndex(p => p.code === displayPlanCode);

  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
      <GuideOverlay guide={guide} />
          <h1 className="text-2xl font-bold">Assinatura</h1>
          <p className="text-muted-foreground">Gerencie seu plano, ciclo e pagamento</p>
        </div>
        {hasActiveSubscription && (
          <Button variant="outline" size="sm" asChild>
            <a href={KIWIFY_MANAGE_URL} target="_blank" rel="noopener noreferrer">
              <Settings className="mr-2 h-4 w-4" />
              Gerenciar na Kiwify
              <ExternalLink className="ml-2 h-3 w-3" />
            </a>
          </Button>
        )}
      </div>

      {/* Upgrade Alert */}
      {isNearProfessionalsLimit && !isMaxPlan && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Você está usando <strong>{profCurrent}/{formatLimit(profLimit)}</strong> profissionais. Considere fazer upgrade para continuar crescendo.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Current Plan Card */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className={cn(
            "h-1.5 w-full",
            displayPlanCode === 'pro' ? 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500' :
            displayPlanCode === 'studio' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
            'bg-gradient-to-r from-primary to-primary/70'
          )} />
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Plano Atual
              </CardTitle>
              {hasActiveSubscription ? (
                <Badge variant="default" className={cn(
                  subscription?.status === 'past_due' ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                )}>
                  {subscription?.status === 'past_due' ? (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  )}
                  {subscription?.status === 'past_due' ? 'Pagamento Pendente' : 'Ativo'}
                </Badge>
              ) : (
                <Badge variant="secondary">Sem assinatura ativa</Badge>
              )}
            </div>
            {subscription?.status === 'past_due' && (
              <Alert variant="default" className="mt-2 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs">
                  Sua última tentativa de pagamento falhou. Você ainda tem acesso ao sistema enquanto processamos a pendência, mas por favor regularize sua situação na Kiwify.
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Hero */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0",
                  displayPlanCode === 'pro' ? 'bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20' :
                  displayPlanCode === 'studio' ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' :
                  'bg-primary/10'
                )}>
                  <Crown className={cn(
                    "h-7 w-7",
                    displayPlanCode === 'pro' ? 'text-violet-600 dark:text-violet-400' :
                    displayPlanCode === 'studio' ? 'text-blue-600 dark:text-blue-400' :
                    'text-primary'
                  )} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl font-bold">{currentPlan.name}</span>
                    {hasActiveSubscription && (
                      <Badge variant="outline" className="text-xs">
                        {billingCycleLabel}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {currentPlan.description}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-3xl font-bold tabular-nums">
                  R$ {formatCentsBRL(currentPrice)}
                </div>
                <div className="text-sm text-muted-foreground">
                  /{billingCycle === 'yearly' ? 'ano' : billingCycle === 'quarterly' ? 'trimestre' : 'mês'}
                </div>
              </div>
            </div>

            {/* Subscription Details */}
            {hasActiveSubscription && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                  <Repeat className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground">Ciclo</div>
                    <div className="font-medium text-sm">{billingCycleLabel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                  <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground">Próxima renovação</div>
                    <div className="font-medium text-sm">{periodEnd || '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                  <CreditCard className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground">Pagamento</div>
                    <div className="font-medium text-sm">Via Kiwify</div>
                  </div>
                </div>
              </div>
            )}

            {/* Plan Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                <Users className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Profissionais</div>
                  <div className="font-semibold text-sm">{formatLimit(entitlements.professionalLimit)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Agendamentos</div>
                  <div className="font-semibold text-sm">Ilimitados</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                <Shield className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Página pública</div>
                  <div className="font-semibold text-sm">Incluída</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <Separator />
            <div className="flex flex-col sm:flex-row gap-3">
              {!isMaxPlan && (
                <Button onClick={() => setChangePlanOpen(true)} className="gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  Alterar plano
                </Button>
              )}
              {hasActiveSubscription && (
                <>
                  <Button variant="outline" asChild>
                    <a href={KIWIFY_MANAGE_URL} target="_blank" rel="noopener noreferrer">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Gerenciar pagamento
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    data-guide="assinatura-cancel" onClick={() => setCancelDialogOpen(true)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar assinatura
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" />
              Uso Atual
            </CardTitle>
            <CardDescription>Consumo do seu plano</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Professionals usage */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Profissionais</div>
                  <div className="font-semibold text-sm">
                    {profCurrent} / {formatLimit(entitlements.professionalLimit)}
                  </div>
                </div>
              </div>
              {profLimit !== Infinity && profLimit > 0 && (
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      profCurrent >= profLimit ? 'bg-destructive' :
                      isNearProfessionalsLimit ? 'bg-amber-500' : 'bg-primary'
                    )}
                    style={{ width: `${Math.min((profCurrent / profLimit) * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Appointments */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">Agendamentos</div>
                <div className="font-semibold text-sm">Ilimitados</div>
              </div>
            </div>

            {/* Status */}
            <div className="pt-2 border-t">
              {isNearProfessionalsLimit ? (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Próximo do limite</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Uso dentro do limite</span>
                </div>
              )}
            </div>

            {/* Quick upgrade CTA */}
            {!isMaxPlan && (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => setChangePlanOpen(true)}
              >
                <Zap className="mr-2 h-4 w-4" />
                Fazer upgrade
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Max Plan Success */}
      {isMaxPlan && (
        <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-fuchsia-500/5">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Você está no plano Pro! 🎉</h3>
              <p className="text-muted-foreground">
                Aproveite todos os recursos premium do Agendali sem limitações.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Comparison (only for non-max plans) */}
      {!isMaxPlan && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-bold">Comparar Planos</h2>
              <p className="text-muted-foreground text-sm">
                Faça upgrade para desbloquear mais recursos
              </p>
            </div>
          </div>
          <PlanCardsGrid
            currentPlanCode={displayPlanCode}
            defaultPeriod={billingCycle as BillingPeriod}
            ctaLabel="Fazer upgrade"
          />
        </div>
      )}

      {/* ── Change Plan Modal ── */}
      <Dialog open={changePlanOpen} onOpenChange={setChangePlanOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5" />
              Alterar Plano
            </DialogTitle>
            <DialogDescription>
              Escolha o plano e ciclo ideais para o seu negócio. Você será redirecionado para o checkout seguro da Kiwify.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <PlanCardsGrid
              currentPlanCode={displayPlanCode}
              defaultPeriod={billingCycle as BillingPeriod}
              ctaLabel="Escolher plano"
              compact
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Para alterar o plano de uma assinatura existente, é necessário cancelar a assinatura atual na Kiwify e assinar o novo plano. Seu acesso continuará até o final do período já pago.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Subscription Dialog ── */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Cancelar assinatura
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Tem certeza que deseja cancelar sua assinatura? Ao cancelar:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Seu acesso continuará até <strong>{periodEnd || 'o final do período pago'}</strong></li>
                  <li>Após esse período, o estabelecimento ficará inativo</li>
                  <li>Seus dados serão mantidos, mas você não poderá receber novos agendamentos</li>
                  <li>Você poderá reativar a qualquer momento assinando novamente</li>
                </ul>
                <p className="text-sm">
                  O cancelamento é feito diretamente pela plataforma da Kiwify, onde sua assinatura é gerenciada.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              asChild
            >
              <a href={KIWIFY_MANAGE_URL} target="_blank" rel="noopener noreferrer">
                Ir para Kiwify para cancelar
                <ExternalLink className="ml-2 h-3 w-3" />
              </a>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
