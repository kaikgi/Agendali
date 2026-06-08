import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SubscriptionStatusBadgeProps {
  status: string;
  className?: string;
}

export function SubscriptionStatusBadge({ status, className }: SubscriptionStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          label: 'Ativo',
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 hover:bg-green-100',
        };
      case 'past_due':
        return {
          label: 'Pagamento pendente',
          variant: 'secondary' as const,
          className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
        };
      case 'canceled':
        return {
          label: 'Cancelado',
          variant: 'destructive' as const,
          className: 'bg-red-100 text-red-800 hover:bg-red-100',
        };
      default:
        return {
          label: status,
          variant: 'secondary' as const,
          className: '',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
