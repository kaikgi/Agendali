import { useState } from 'react';
import { Loader2, CreditCard, ShieldCheck, Clock, AlertCircle, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PaymentConfig {
  enabled: boolean;
  deposit_required?: boolean;
  deposit_type?: string;
  deposit_value?: number;
  full_payment_online?: boolean;
  require_manual_confirmation?: boolean;
}

interface PaymentStepProps {
  serviceName: string;
  servicePriceCents: number | null;
  professionalName: string;
  date: Date;
  time: string;
  paymentConfig: PaymentConfig;
  onPay: () => Promise<void>;
  onSkip: () => void;
  isProcessing: boolean;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function calculatePaymentAmount(config: PaymentConfig, servicePriceCents: number): { amount: number; type: 'deposit' | 'full'; label: string } {
  if (config.full_payment_online) {
    return { amount: servicePriceCents, type: 'full', label: 'Pagamento total' };
  }

  if (config.deposit_required && config.deposit_value) {
    if (config.deposit_type === 'percentage') {
      const amount = Math.round(servicePriceCents * config.deposit_value / 100);
      return { amount, type: 'deposit', label: `Sinal de ${config.deposit_value}%` };
    }
    // fixed value in reais → convert to cents
    const amount = Math.round(config.deposit_value * 100);
    return { amount, type: 'deposit', label: 'Sinal fixo' };
  }

  return { amount: servicePriceCents, type: 'full', label: 'Pagamento total' };
}

export function PaymentStep({
  serviceName,
  servicePriceCents,
  professionalName,
  date,
  time,
  paymentConfig,
  onPay,
  onSkip,
  isProcessing,
}: PaymentStepProps) {
  const [error, setError] = useState<string | null>(null);

  const priceCents = servicePriceCents || 0;
  const payment = calculatePaymentAmount(paymentConfig, priceCents);
  const remainingCents = priceCents - payment.amount;

  const handlePay = async () => {
    setError(null);
    try {
      await onPay();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar pagamento. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Pagamento</h2>
        <p className="text-sm text-muted-foreground">
          Este estabelecimento requer pagamento para confirmar seu agendamento.
        </p>
      </div>

      {/* Booking Summary */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Serviço</span>
              <span className="font-medium">{serviceName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Profissional</span>
              <span className="font-medium">{professionalName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Data</span>
              <span className="font-medium">
                {format(date, "dd 'de' MMMM, EEEE", { locale: ptBR })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Horário</span>
              <span className="font-medium">{time}</span>
            </div>
          </div>

          <Separator />

          {/* Price breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor do serviço</span>
              <span>{formatCents(priceCents)}</span>
            </div>

            {payment.type === 'deposit' && (
              <>
                <div className="flex justify-between text-sm font-medium text-primary">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    {payment.label}
                  </span>
                  <span>{formatCents(payment.amount)}</span>
                </div>
                {remainingCents > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Restante (pagar no local)</span>
                    <span>{formatCents(remainingCents)}</span>
                  </div>
                )}
              </>
            )}

            {payment.type === 'full' && (
              <div className="flex justify-between text-sm font-medium text-primary">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  Pagar agora
                </span>
                <span>{formatCents(payment.amount)}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Total to pay now */}
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total a pagar agora</span>
            <span className="text-xl font-bold text-primary">
              {formatCents(payment.amount)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Info badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1.5 py-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Pagamento seguro via Mercado Pago
        </Badge>
        {paymentConfig.require_manual_confirmation && (
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <Clock className="h-3.5 w-3.5" />
            Sujeito a aprovação do estabelecimento
          </Badge>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={handlePay}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Pagar {formatCents(payment.amount)} via Mercado Pago
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export { calculatePaymentAmount };
