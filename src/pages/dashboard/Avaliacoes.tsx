import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Star, Filter, Calendar as CalendarIcon, MessageSquare, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface RatingWithDetails {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  customer: {
    name: string;
    phone: string;
  } | null;
  appointment: {
    start_at: string;
    service: {
      name: string;
    } | null;
    professional: {
      name: string;
    } | null;
  } | null;
}

type PeriodFilter = 'all' | '7d' | '30d' | '90d' | 'custom';
type StarFilter = 'all' | '1' | '2' | '3' | '4' | '5';

export default function Avaliacoes() {
  const { data: establishment } = useUserEstablishment();
  const [starFilter, setStarFilter] = useState<StarFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

  const { data: ratings, isLoading } = useQuery({
    queryKey: ['establishment-ratings-detailed', establishment?.id],
    queryFn: async (): Promise<RatingWithDetails[]> => {
      if (!establishment?.id) return [];

      const { data, error } = await supabase
        .from('ratings')
        .select(`
          id,
          stars,
          comment,
          created_at,
          customer:customers!ratings_customer_id_fkey (
            name,
            phone
          ),
          appointment:appointments!ratings_appointment_id_fkey (
            start_at,
            service:services!appointments_service_id_fkey (
              name
            ),
            professional:professionals!appointments_professional_id_fkey (
              name
            )
          )
        `)
        .eq('establishment_id', establishment.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as RatingWithDetails[];
    },
    enabled: !!establishment?.id,
  });

  const filteredRatings = useMemo(() => {
    if (!ratings) return [];

    return ratings.filter((rating) => {
      // Star filter
      if (starFilter !== 'all' && rating.stars !== parseInt(starFilter)) {
        return false;
      }

      // Period filter
      const ratingDate = new Date(rating.created_at);
      const now = new Date();

      if (periodFilter === '7d') {
        if (ratingDate < subDays(now, 7)) return false;
      } else if (periodFilter === '30d') {
        if (ratingDate < subDays(now, 30)) return false;
      } else if (periodFilter === '90d') {
        if (ratingDate < subDays(now, 90)) return false;
      } else if (periodFilter === 'custom' && customDateRange.from && customDateRange.to) {
        if (!isWithinInterval(ratingDate, {
          start: startOfDay(customDateRange.from),
          end: endOfDay(customDateRange.to),
        })) {
          return false;
        }
      }

      return true;
    });
  }, [ratings, starFilter, periodFilter, customDateRange]);

  const stats = useMemo(() => {
    if (!filteredRatings.length) {
      return { avg: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    }

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    filteredRatings.forEach((r) => {
      sum += r.stars;
      distribution[r.stars as keyof typeof distribution]++;
    });

    return {
      avg: sum / filteredRatings.length,
      total: filteredRatings.length,
      distribution,
    };
  }, [filteredRatings]);

  const renderStars = (count: number, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              sizeClass,
              star <= count
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground/30'
            )}
          />
        ))}
      </div>
    );
  };

  const getStarBadgeVariant = (stars: number) => {
    if (stars >= 4) return 'default';
    if (stars === 3) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Avaliações</h1>
        <p className="text-muted-foreground">
          Veja o que seus clientes estão dizendo
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{stats.avg.toFixed(1)}</span>
                {renderStars(Math.round(stats.avg))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <span className="text-2xl font-bold">{stats.total}</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Distribuição</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = stats.distribution[star as keyof typeof stats.distribution];
                  const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-3">{star}</span>
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-muted-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <Select value={starFilter} onValueChange={(v) => setStarFilter(v as StarFilter)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Filtrar por nota" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as notas</SelectItem>
            <SelectItem value="5">5 estrelas</SelectItem>
            <SelectItem value="4">4 estrelas</SelectItem>
            <SelectItem value="3">3 estrelas</SelectItem>
            <SelectItem value="2">2 estrelas</SelectItem>
            <SelectItem value="1">1 estrela</SelectItem>
          </SelectContent>
        </Select>

        <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Filtrar por período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo período</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="custom">Período personalizado</SelectItem>
          </SelectContent>
        </Select>

        {periodFilter === 'custom' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[240px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customDateRange.from ? (
                  customDateRange.to ? (
                    <>
                      {format(customDateRange.from, 'dd/MM/yy', { locale: ptBR })} -{' '}
                      {format(customDateRange.to, 'dd/MM/yy', { locale: ptBR })}
                    </>
                  ) : (
                    format(customDateRange.from, 'dd/MM/yyyy', { locale: ptBR })
                  )
                ) : (
                  'Selecionar datas'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={customDateRange.from}
                selected={{ from: customDateRange.from, to: customDateRange.to }}
                onSelect={(range) =>
                  setCustomDateRange({ from: range?.from, to: range?.to })
                }
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Ratings List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredRatings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Star className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">Nenhuma avaliação encontrada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {starFilter !== 'all' || periodFilter !== 'all'
                  ? 'Tente ajustar os filtros'
                  : 'As avaliações dos clientes aparecerão aqui'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRatings.map((rating) => (
            <Card key={rating.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderStars(rating.stars)}
                      <Badge variant={getStarBadgeVariant(rating.stars)}>
                        {rating.stars} {rating.stars === 1 ? 'estrela' : 'estrelas'}
                      </Badge>
                    </div>

                    {rating.comment && (
                      <p className="text-sm text-foreground">{rating.comment}</p>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {rating.customer && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {rating.customer.name}
                        </span>
                      )}
                      {rating.appointment?.service && (
                        <span>{rating.appointment.service.name}</span>
                      )}
                      {rating.appointment?.professional && (
                        <span>com {rating.appointment.professional.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(rating.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
