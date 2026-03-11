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
  Sparkles,
  CalendarCheck,
  CalendarDays,
  Building2,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useClientAppointments } from '@/hooks/useClientAppointments';
import { useProfile } from '@/hooks/useProfile';
import { useCancelClientAppointment } from '@/hooks/useClientAppointments';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
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

const statusLabels: Record<string, string> = {
  pending_approval: 'Aguardando aprovação',
  booked: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  canceled: 'Cancelado',
  no_show: 'Não compareceu',
  rejected: 'Recusado',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending_approval: 'outline',
  booked: 'outline',
  confirmed: 'default',
  completed: 'secondary',
  canceled: 'destructive',
  no_show: 'destructive',
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function ClientDashboard() {
  const { data: appointments = [], isLoading } = useClientAppointments();
  const { profile } = useProfile();
  const cancelMutation = useCancelClientAppointment();
  const { toast } = useToast();
  const [cancelId, setCancelId] = useState<string | null>(null);

  const now = new Date();

  // Derived data
  const upcomingAppointments = appointments
    .filter((a) => isFuture(new Date(a.start_at)) && a.status !== 'canceled' && a.status !== 'no_show')
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const nextAppointment = upcomingAppointments[0];

  const completedTotal = appointments.filter((a) => a.status === 'completed').length;

  const pastAppointments = appointments
    .filter((a) => isPast(new Date(a.start_at)) || a.status === 'completed' || a.status === 'canceled')
    .slice(0, 5);

  // Unique establishments visited
  const uniqueEstablishments = Array.from(
    new Map(
      appointments
        .filter((a) => a.status === 'completed')
        .map((a) => [a.establishment.id, a.establishment])
    ).values()
  ).slice(0, 4);

  const firstName = profile?.full_name?.split(' ')[0] || 'Cliente';

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      await cancelMutation.mutateAsync(cancelId);
      toast({ title: 'Agendamento cancelado', description: 'Seu agendamento foi cancelado com sucesso.' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível cancelar o agendamento.' });
    }
    setCancelId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Welcome Card */}
      <Card className="border-0 bg-foreground text-background overflow-hidden relative">
        <CardContent className="p-6 md:p-8">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="shrink-0"
            >
              <Link to="/client/search">
                <Search className="h-4 w-4 mr-2" />
                Agendar
              </Link>
            </Button>
          </div>
          {/* Decorative element */}
          <div className="absolute -right-8 -bottom-8 opacity-[0.04]">
            <CalendarDays className="h-48 w-48" />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="group hover:border-foreground/20 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-foreground/5 flex items-center justify-center">
                <Clock className="h-4 w-4 text-foreground/60" />
              </div>
            </div>
            <p className="text-2xl font-bold">{upcomingAppointments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Próximos agendamentos</p>
          </CardContent>
        </Card>

        <Card className="group hover:border-foreground/20 transition-colors">
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

        <Card className="group hover:border-foreground/20 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-foreground/5 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-foreground/60" />
              </div>
            </div>
            <p className="text-2xl font-bold">{appointments.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total de agendamentos</p>
          </CardContent>
        </Card>

        <Card className="group hover:border-foreground/20 transition-colors">
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
      </div>

      {/* Next Appointment - Featured */}
      {nextAppointment && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-foreground/50" />
              <CardTitle className="text-base">Próximo Agendamento</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-5">
              {/* Left: Establishment info */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <Avatar className="h-14 w-14 shrink-0 rounded-xl border">
                  {nextAppointment.establishment.logo_url && (
                    <AvatarImage
                      src={nextAppointment.establishment.logo_url}
                      alt={nextAppointment.establishment.name}
                    />
                  )}
                  <AvatarFallback className="rounded-xl text-lg">
                    {nextAppointment.establishment.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold truncate">
                      {nextAppointment.establishment.name}
                    </h3>
                    <Badge variant={statusVariants[nextAppointment.status]}>
                      {statusLabels[nextAppointment.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {nextAppointment.service.name} • {nextAppointment.professional.name}
                  </p>
                  {nextAppointment.service.price_cents != null && (
                    <p className="text-sm font-medium">
                      R$ {(nextAppointment.service.price_cents / 100).toFixed(2).replace('.', ',')}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Date/time and actions */}
              <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
                <div className="text-right space-y-0.5">
                  <p className="text-sm font-semibold capitalize">
                    {format(new Date(nextAppointment.start_at), "EEEE, dd 'de' MMM", {
                      locale: ptBR,
                    })}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">
                    {format(new Date(nextAppointment.start_at), 'HH:mm')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nextAppointment.service.duration_minutes} min
                  </p>
                </div>
              </div>
            </div>

            {nextAppointment.establishment.address && (
              <>
                <Separator />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {nextAppointment.establishment.address}
                    {nextAppointment.establishment.city &&
                      `, ${nextAppointment.establishment.city}`}
                    {nextAppointment.establishment.state &&
                      ` - ${nextAppointment.establishment.state}`}
                  </span>
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" asChild>
                <Link to="/client/appointments">
                  Ver detalhes
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setCancelId(nextAppointment.id)}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout for history + quick actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* History */}
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
              {pastAppointments.length === 0 ? (
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
                  {pastAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-9 w-9 shrink-0 rounded-lg">
                        {apt.establishment.logo_url && (
                          <AvatarImage
                            src={apt.establishment.logo_url}
                            alt={apt.establishment.name}
                          />
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
                        <p className="text-xs font-medium">
                          {format(new Date(apt.start_at), 'dd/MM/yy')}
                        </p>
                        <Badge
                          variant={statusVariants[apt.status]}
                          className="mt-0.5 text-[10px] px-1.5"
                        >
                          {statusLabels[apt.status]}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start h-11"
                asChild
              >
                <Link to="/client/search">
                  <Search className="h-4 w-4 mr-3 text-muted-foreground" />
                  Buscar e agendar
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-11"
                asChild
              >
                <Link to="/client/appointments">
                  <Calendar className="h-4 w-4 mr-3 text-muted-foreground" />
                  Meus agendamentos
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-11"
                asChild
              >
                <Link to="/client/history">
                  <History className="h-4 w-4 mr-3 text-muted-foreground" />
                  Histórico completo
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-11"
                asChild
              >
                <Link to="/client/profile">
                  <User className="h-4 w-4 mr-3 text-muted-foreground" />
                  Meu perfil
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Establishments */}
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
                      {est.logo_url && (
                        <AvatarImage src={est.logo_url} alt={est.name} />
                      )}
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

      {/* Empty state if no appointments at all */}
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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O estabelecimento será notificado do cancelamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
