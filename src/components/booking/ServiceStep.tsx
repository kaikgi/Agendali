import { useMemo } from 'react';
import { Clock, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Service } from '@/hooks/useServices';
import { useServiceCategories, type ServiceCategory } from '@/hooks/useServiceCategories';

interface ServiceStepProps {
  services: Service[];
  selectedServiceId: string | null;
  onSelect: (service: Service) => void;
  establishmentId?: string;
}

function formatPrice(cents: number | null): string {
  if (cents === null) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ServiceStep({ services, selectedServiceId, onSelect, establishmentId }: ServiceStepProps) {
  const { categories } = useServiceCategories(establishmentId);

  const groups = useMemo(() => {
    const byCatId = new Map<string | null, Service[]>();
    services.forEach((s) => {
      const key = (s as any).category_id || null;
      if (!byCatId.has(key)) byCatId.set(key, []);
      byCatId.get(key)!.push(s);
    });

    const result: { category: ServiceCategory | null; items: Service[] }[] = [];

    categories.forEach((cat) => {
      const items = byCatId.get(cat.id);
      if (items && items.length > 0) {
        result.push({ category: cat, items });
      }
    });

    const uncategorized = byCatId.get(null) ?? [];
    if (uncategorized.length > 0) {
      result.push({ category: null, items: uncategorized });
    }

    return result;
  }, [services, categories]);

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
        <div key={group.category?.id ?? '__none'}>
          {hasCategories && group.category && (
            <div className="mb-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
                {group.category.name}
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
