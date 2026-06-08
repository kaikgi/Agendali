import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PlanLimitAlertProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function PlanLimitAlert({
  title = 'Limite do plano atingido',
  description = 'Este estabelecimento atingiu o limite de profissionais do plano atual. Faça upgrade para continuar adicionando.',
  variant = 'destructive',
}: PlanLimitAlertProps) {
  return (
    <Alert variant={variant} className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
