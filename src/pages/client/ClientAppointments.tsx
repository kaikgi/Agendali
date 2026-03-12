import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, isFuture, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  Clock,
  Search,
  Plus,
  MapPin,
  ArrowRight,
  CalendarDays,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

function AppointmentCard({
  apt,
  onClick,
}: {
  apt: ClientAppointment;
  onClick: () => void;
}) {
  const startDate = new Date(apt.start_at);
  const isUpcoming = isFuture(startDate) && !['canceled', 'canceled_by_customer', 'canceled_by_establishment', 'no_show', 'rejected'].includes(apt.status);

  return (
    <Card
      className="cursor-pointer hover:border-foreground/20 transition-all group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Date block */}
          <div className="shrink-0 w-14 text-center">
            <div
              className={`rounded-xl p-2 ${
                isUpcoming
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <p className="text-[10px] uppercase font-medium leading-none mb-0.5">
                {format(startDate, 'MMM', { locale: ptBR })}
              </p>
              <p className="text-xl font-bold leading-none">
                {format(startDate, 'dd')}
              </p>
            </div>
            <p className="text-xs font-medium mt-1.5 text-muted-foreground">
              {format(startDate, 'HH:mm')}
            </p>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-sm truncate">
                {apt.service.name}
              </h3>
              <Badge
                variant={statusVariants[apt.status]}
                className="text-[10px] px-1.5 py-0"
              >
                {statusLabels[apt.status]}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5 rounded-md">
                {apt.establishment.logo_url && (
                  <AvatarImage
                    src={apt.establishment.logo_url}
                    alt={apt.establishment.name}
                  />
                )}
                <AvatarFallback className="rounded-md text-[9px]">
                  {apt.establishment.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <p className="text-xs text-muted-foreground truncate">
                {apt.establishment.name}
              </p>
            </div>

            <p className="text-xs text-muted-foreground truncate">
              {apt.professional.name}
              {apt.service.price_cents != null && (
                <span className="ml-1">
                  •{' '}
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(apt.service.price_cents / 100)}
                </span>
              )}
            </p>

            {apt.establishment.address && isUpcoming && (
              <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {apt.establishment.address}
                {apt.establishment.city && `, ${apt.establishment.city}`}
              </p>
            )}
          </div>

          {/* Arrow */}
          <div className="shrink-0 flex items-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  description,
  showCta = false,
}: {
  title: string;
  description: string;
  showCta?: boolean;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
          <CalendarDays className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
        </div>
        {showCta && (
          <Button asChild>
            <Link to="/client/search">
              <Plus className="h-4 w-4 mr-2" />
              Agendar agora
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClientAppointments() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] =
    useState<ClientAppointment | null>(null);

  const { data: allAppointments = [], isLoading } = useClientAppointments();

  // Split into upcoming vs past
  const upcoming = useMemo(
    () =>
      allAppointments
        .filter(
          (a) =>
            isFuture(new Date(a.start_at)) &&
            !['canceled', 'no_show'].includes(a.status)
        )
        .sort(
          (a, b) =>
            new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
        ),
    [allAppointments]
  );

  const all = useMemo(() => {
    let filtered = [...allAppointments];

    if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.service.name.toLowerCase().includes(q) ||
          a.establishment.name.toLowerCase().includes(q) ||
          a.professional.name.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [allAppointments, statusFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Meus Agendamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            {upcoming.length > 0
              ? `${upcoming.length} agendamento${upcoming.length > 1 ? 's' : ''} pendente${upcoming.length > 1 ? 's' : ''}`
              : 'Visualize e gerencie seus agendamentos'}
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/client/search">
            <Plus className="h-4 w-4 mr-2" />
            Novo agendamento
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-5">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Próximos
            {upcoming.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 text-[10px] rounded-full"
              >
                {upcoming.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            Todos
          </TabsTrigger>
        </TabsList>

        {/* Upcoming */}
        <TabsContent value="upcoming" className="space-y-3 mt-0">
          {upcoming.length === 0 ? (
            <EmptyState
              title="Nenhum agendamento futuro"
              description="Quando você agendar um serviço, ele aparecerá aqui"
              showCta
            />
          ) : (
            upcoming.map((apt) => (
              <AppointmentCard
                key={apt.id}
                apt={apt}
                onClick={() => setSelectedAppointment(apt)}
              />
            ))
          )}
        </TabsContent>

        {/* All */}
        <TabsContent value="all" className="space-y-4 mt-0">
          {/* Filters */}
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
              <SelectTrigger className="w-full sm:w-[150px] h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="booked">Agendados</SelectItem>
                <SelectItem value="confirmed">Confirmados</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
                <SelectItem value="canceled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {all.length === 0 ? (
            <EmptyState
              title="Nenhum resultado"
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'Tente alterar os filtros ou o termo de busca'
                  : 'Você ainda não possui agendamentos'
              }
              showCta={!searchQuery && statusFilter === 'all'}
            />
          ) : (
            <div className="space-y-3">
              {all.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  apt={apt}
                  onClick={() => setSelectedAppointment(apt)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <ClientAppointmentDialog
        appointment={selectedAppointment}
        open={!!selectedAppointment}
        onOpenChange={(open) => !open && setSelectedAppointment(null)}
      />
    </div>
  );
}
