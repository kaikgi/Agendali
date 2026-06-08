import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  ArrowRight,
  Plus,
  History,
  User,
  Search,
  MapPin,
  CalendarCheck,
  Building2,
  MessageCircle,
} from 'lucide-react';
import { format, formatDistanceToNow, isFuture, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useClientAppointments } from '@/hooks/useClientAppointments';
import { useProfile } from '@/hooks/useProfile';
import { statusLabels, statusVariants } from '@/lib/appointmentStatus';

const CANCELED_STATUSES = ['canceled', 'canceled_by_customer', 'canceled_by_establishment', 'no_show', 'rejected'];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function ClientDashboard() {
  const { data: appointments = [], isLoading } = useClientAppointments();
  const { profile } = useProfile();

  const upcomingAppointments = appointments
    .filter((a) => isFuture(new Date(a.start_at)) && !CANCELED_STATUSES.includes(a.status))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const nextAppointment = upcomingAppointments[0];
  const completedTotal = appointments.filter((a) => a.status === 'completed').length;

  // History = past appointments only (not future canceled ones)
  const recentHistory = appointments
    .filter((a) => isPast(new Date(a.end_at)))
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
    .slice(0, 5);

  const uniqueEstablishments = Array.from(
    new Map(
      appointments
        .filter((a) => a.status === 'completed')
        .map((a) => [a.establishment.id, a.establishment])
    ).values()
  ).slice(0, 4);

  const firstName = profile?.full_name?.split(' ')[0] || 'Cliente';

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Welcome */}
      <Card className="border-0 bg-foreground text-background">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm opacity-70">{getGreeting()},</p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{firstName}</h1>
              {nextAppointment ? (
                <p className="text-sm opacity-80">
                  Próximo agendamento{' '}
                  <span className="font-medium opacity-100">
                    {formatDistanceToNow(new Date(nextAppointment.start_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </p>
              ) : (
                <p className="text-sm opacity-70">Você não tem agendamentos futuros</p>
              )}
            </div>
            <Button asChild variant="secondary" size="lg" className="shrink-0">
              <Link to="/client/search">
                <Search className="h-4 w-4 mr-2" />
                Agendar
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards — clickable */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Link to="/client/appointments">
          <Card className="hover:border-foreground/20 transition-colors h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-foreground/5 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-foreground/60" />
                </div>
              </div>
              <p className="text-2xl font-bold">{upcomingAppointments.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Próximos</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/client/history">
          <Card className="hover:border-foreground/20 transition-colors h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-foreground/5 flex items-center justify-center">
                  <CalendarCheck className="h-4 w-4 text-foreground/60" />
                </div>
              </div>
              <p className="text-2xl font-bold">{completedTotal}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Realizados</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/client/appointments">
          <Card className="hover:border-foreground/20 transition-colors h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-foreground/5 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-foreground/60" />
                </div>
              </div>
              <p className="text-2xl font-bold">{appointments.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/client/search">
          <Card className="hover:border-foreground/20 transition-colors h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-foreground/5 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-foreground/60" />
                </div>
              </div>
              <p className="text-2xl font-bold">{uniqueEstablishments.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Estabelecimentos</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Next Appointment */}
      {nextAppointment && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Próximo Agendamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-5">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <Avatar className="h-14 w-14 shrink-0 rounded-xl border">
                  {nextAppointment.establishment.logo_url && (
                    <AvatarImage src={nextAppointment.establishment.logo_url} alt={nextAppointment.establishment.name} />
                  )}
                  <AvatarFallback className="rounded-xl text-lg">
                    {nextAppointment.establishment.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold truncate">{nextAppointment.establishment.name}</h3>
                    <Badge variant={statusVariants[nextAppointment.status]}>
                      {statusLabels[nextAppointment.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {nextAppointment.service.name} • {nextAppointment.professional.name}
                  </p>
                  {nextAppointment.service.price_cents != null && (
                    <p className="text-sm font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(nextAppointment.service.price_cents / 100)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
                <p className="text-sm font-semibold capitalize">
                  {format(new Date(nextAppointment.start_at), "EEEE, dd 'de' MMM", { locale: ptBR })}
                </p>
                <p className="text-2xl font-bold tracking-tight">
                  {format(new Date(nextAppointment.start_at), 'HH:mm')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {nextAppointment.service.duration_minutes} min
                </p>
              </div>
            </div>

            {nextAppointment.establishment.address && (
              <>
                <Separator />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {nextAppointment.establishment.address}
                    {nextAppointment.establishment.city && `, ${nextAppointment.establishment.city}`}
                    {nextAppointment.establishment.state && ` - ${nextAppointment.establishment.state}`}
                  </span>
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/client/appointments?apt=${nextAppointment.id}`}>
                  Ver detalhes
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
              {nextAppointment.establishment.phone && (
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={`https://wa.me/55${nextAppointment.establishment.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                    WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Histórico Recente</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/client/history" className="text-sm">
                  Ver tudo
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentHistory.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <History className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <div>
                    <p className="font-medium text-sm">Nenhum histórico ainda</p>
                    <p className="text-xs text-muted-foreground">
                      Seus agendamentos concluídos aparecerão aqui
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentHistory.map((apt) => (
                    <Link
                      key={apt.id}
                      to={`/client/appointments?apt=${apt.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-9 w-9 shrink-0 rounded-lg">
                        {apt.establishment.logo_url && (
                          <AvatarImage src={apt.establishment.logo_url} alt={apt.establishment.name} />
                        )}
                        <AvatarFallback className="rounded-lg text-xs">
                          {apt.establishment.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{apt.service.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {apt.establishment.name} • {apt.professional.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium">{format(new Date(apt.start_at), 'dd/MM/yy')}</p>
                        <Badge variant={statusVariants[apt.status]} className="mt-0.5 text-[10px] px-1.5">
                          {statusLabels[apt.status]}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start h-11" asChild>
                <Link to="/client/search">
                  <Search className="h-4 w-4 mr-3 text-muted-foreground" />
                  Buscar e agendar
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start h-11" asChild>
                <Link to="/client/appointments">
                  <Calendar className="h-4 w-4 mr-3 text-muted-foreground" />
                  Meus agendamentos
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start h-11" asChild>
                <Link to="/client/history">
                  <History className="h-4 w-4 mr-3 text-muted-foreground" />
                  Histórico completo
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start h-11" asChild>
                <Link to="/client/profile">
                  <User className="h-4 w-4 mr-3 text-muted-foreground" />
                  Meu perfil
                </Link>
              </Button>
            </CardContent>
          </Card>

          {uniqueEstablishments.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Estabelecimentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {uniqueEstablishments.map((est) => (
                  <Link
                    key={est.id}
                    to={`/${est.slug}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      {est.logo_url && <AvatarImage src={est.logo_url} alt={est.name} />}
                      <AvatarFallback className="rounded-lg text-xs">
                        {est.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate flex-1 group-hover:text-foreground">
                      {est.name}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Global empty state */}
      {appointments.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-lg">Nenhum agendamento ainda</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Encontre um estabelecimento e faça seu primeiro agendamento
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/client/search">
                <Plus className="h-4 w-4 mr-2" />
                Agendar agora
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
