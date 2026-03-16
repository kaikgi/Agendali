import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RotateCcw,
  ArrowRight,
  History as HistoryIcon,
  CalendarDays,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useClientAppointments,
  type ClientAppointment,
} from '@/hooks/useClientAppointments';
import { ClientAppointmentDialog } from '@/components/client/ClientAppointmentDialog';

import { statusLabels, statusVariants } from '@/lib/appointmentStatus';

export default function ClientHistory() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [establishmentFilter, setEstablishmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] =
    useState<ClientAppointment | null>(null);

  const { data: appointments = [], isLoading } = useClientAppointments();

  // History = completed, canceled (all types), no_show, rejected
  const historyStatuses = ['completed', 'canceled', 'canceled_by_customer', 'canceled_by_establishment', 'no_show', 'rejected'];

  const allHistory = useMemo(
    () => appointments.filter((a) => historyStatuses.includes(a.status)),
    [appointments]
  );

  // Unique establishments for filter
  const establishments = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    allHistory.forEach((a) => map.set(a.establishment.id, { id: a.establishment.id, name: a.establishment.name }));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allHistory]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = [...allHistory];

    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }

    if (establishmentFilter !== 'all') {
      list = list.filter((a) => a.establishment.id === establishmentFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.service.name.toLowerCase().includes(q) ||
          a.establishment.name.toLowerCase().includes(q) ||
          a.professional.name.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allHistory, statusFilter, establishmentFilter, searchQuery]);

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, ClientAppointment[]>();
    filtered.forEach((a) => {
      const key = format(new Date(a.start_at), 'yyyy-MM');
      const label = format(new Date(a.start_at), 'MMMM yyyy', { locale: ptBR });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => ({
        key,
        label: format(new Date(items[0].start_at), 'MMMM yyyy', { locale: ptBR }),
        items,
      }));
  }, [filtered]);

  // Stats
  const completedCount = allHistory.filter((a) => a.status === 'completed').length;
  const canceledCount = allHistory.filter((a) => a.status === 'canceled').length;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-10 rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>
        <p className="text-sm text-muted-foreground">
          {allHistory.length > 0
            ? `${allHistory.length} agendamento${allHistory.length > 1 ? 's' : ''} no histórico`
            : 'Agendamentos finalizados e cancelados'}
        </p>
      </div>

      {/* Stats */}
      {allHistory.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{allHistory.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {completedCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Concluídos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-destructive">
                {canceledCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cancelados
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {allHistory.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar serviço, estabelecimento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[145px] h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="canceled">Cancelados</SelectItem>
              <SelectItem value="no_show">Não compareceu</SelectItem>
            </SelectContent>
          </Select>
          {establishments.length > 1 && (
            <Select
              value={establishmentFilter}
              onValueChange={setEstablishmentFilter}
            >
              <SelectTrigger className="w-full sm:w-[170px] h-9">
                <SelectValue placeholder="Estabelecimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {establishments.map((est) => (
                  <SelectItem key={est.id} value={est.id}>
                    {est.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Content */}
      {allHistory.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <HistoryIcon className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold">Nenhum histórico ainda</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Seus agendamentos concluídos e cancelados aparecerão aqui
              </p>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
            <Search className="h-8 w-8 text-muted-foreground/40" />
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-sm">Nenhum resultado</h3>
              <p className="text-xs text-muted-foreground">
                Tente alterar os filtros ou o termo de busca
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setEstablishmentFilter('all');
              }}
            >
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.key}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 capitalize">
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.items.map((apt) => {
                  const startDate = new Date(apt.start_at);
                  const isCompleted = apt.status === 'completed';

                  return (
                    <Card
                      key={apt.id}
                      className="cursor-pointer hover:border-foreground/20 transition-all group"
                      onClick={() => setSelectedAppointment(apt)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Status icon */}
                          <div
                            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isCompleted
                                ? 'bg-foreground/5'
                                : 'bg-destructive/10'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-foreground/50" />
                            ) : (
                              <XCircle className="h-5 w-5 text-destructive/70" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold truncate">
                                {apt.service.name}
                              </h3>
                              <Badge
                                variant={statusVariants[apt.status]}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {statusLabels[apt.status]}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {apt.establishment.name} • {apt.professional.name}
                            </p>
                          </div>

                          {/* Date + rebook */}
                          <div className="text-right shrink-0 space-y-1">
                            <p className="text-xs font-medium">
                              {format(startDate, 'dd/MM/yy')}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {format(startDate, 'HH:mm')}
                            </p>
                          </div>

                          {/* Arrow */}
                          <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 transition-colors shrink-0" />
                        </div>

                        {/* Rebook CTA for completed */}
                        {isCompleted && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2"
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link to={`/${apt.establishment.slug}`}>
                                <RotateCcw className="h-3 w-3 mr-1.5" />
                                Agendar novamente
                              </Link>
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <ClientAppointmentDialog
        appointment={selectedAppointment}
        open={!!selectedAppointment}
        onOpenChange={(open) => !open && setSelectedAppointment(null)}
      />
    </div>
  );
}
