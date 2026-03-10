import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Service } from '@/hooks/useServices';

interface ServiceStepProps {
  services: Service[];
  selectedServiceId: string | null;
  onSelect: (service: Service) => void;
}

function formatPrice(cents: number | null): string {
  if (cents === null) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ServiceStep({ services, selectedServiceId, onSelect }: ServiceStepProps) {
  // Group services by category, respecting sort_order
  const groups = useMemo(() => {
    const byCategory = new Map<string | null, Service[]>();
    
    // Services are already sorted by sort_order from the hook
    services.forEach((s) => {
      const key = (s as any).category || null;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(s);
    });

    // Build ordered groups: categories first (by first service's sort_order), then uncategorized
    const result: { category: string | null; items: Service[] }[] = [];
    const sortedKeys = Array.from(byCategory.keys()).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      const aOrder = byCategory.get(a)?.[0]?.sort_order ?? 999;
      const bOrder = byCategory.get(b)?.[0]?.sort_order ?? 999;
      return aOrder - bOrder;
    });

    sortedKeys.forEach((key) => {
      result.push({ category: key, items: byCategory.get(key)! });
    });

    return result;
  }, [services]);

  if (services.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum serviço disponível no momento.
      </div>
    );
  }

  const hasCategories = groups.some(g => g.category !== null);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Escolha o serviço</h2>
      
      {groups.map((group) => (
        <div key={group.category ?? '__none'}>
          {/* Category label */}
          {hasCategories && group.category && (
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
                {group.category}
              </h3>
            </div>
          )}
          {hasCategories && !group.category && (
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Outros
              </h3>
            </div>
          )}

          <div className="space-y-2">
            {group.items.map((service) => (
              <button
                key={service.id}
                onClick={() => onSelect(service)}
                className={cn(
                  'w-full p-4 rounded-lg border text-left transition-all',
                  'hover:border-foreground/50',
                  selectedServiceId === service.id
                    ? 'border-foreground bg-accent'
                    : 'border-border'
                )}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {service.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration_minutes} min</span>
                    </div>
                  </div>
                  {service.price_cents !== null && (
                    <span className="font-semibold">{formatPrice(service.price_cents)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}