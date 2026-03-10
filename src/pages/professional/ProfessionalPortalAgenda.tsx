import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isToday,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  CalendarDays,
  List,
  LogOut,
  Loader2,
  Calendar as CalendarIcon,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useProfessionalPortalAuth,
  useProfessionalPortalAppointments,
} from '@/hooks/useProfessionalPortal';
import { ProfessionalProfileSection } from '@/components/professional/ProfessionalProfileSection';
import { ProfessionalCalendarView } from '@/components/professional/ProfessionalCalendarView';
import { ProfessionalSummaryCards } from '@/components/professional/ProfessionalSummaryCards';
import { ProfessionalAppointmentDialog } from '@/components/professional/ProfessionalAppointmentDialog';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

const statusColors: Record<string, string> = {
  booked: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-muted text-muted-foreground border-border',
  no_show: 'bg-red-100 text-red-800 border-red-200',
  canceled: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabels: Record<string, string> = {
  booked: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
  canceled: 'Cancelado',
};

type ViewMode = 'week' | 'list';
type TabMode = 'agenda' | 'calendar' | 'profile';

interface PortalAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  service_duration: number;
  customer_notes: string | null;
}

export default function ProfessionalPortalAgenda() {
  const { establishmentSlug, professionalSlug } = useParams<{
    establishmentSlug: string;
    professionalSlug: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { token, session, isLoading: authLoading, isAuthenticated, isPortalDisabled, logout } = useProfessionalPortalAuth();

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [activeTab, setActiveTab] = useState<TabMode>('agenda');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<PortalAppointment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Agenda date range
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Calendar date range (fetch full month +/- padding)
  const calMonthStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
  const calMonthEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });

  const { data: appointments, isLoading: appointmentsLoading } = useProfessionalPortalAppointments(
    token,
    activeTab === 'calendar' ? calMonthStart : weekStart,
    activeTab === 'calendar' ? calMonthEnd : weekEnd
  );

  // Fetch professional data for avatar
  const { data: professionalData } = useQuery({
    queryKey: ['professional-portal-profile', session?.professional_id],
    queryFn: async () => {
      if (!session?.professional_id) return null;
      const { data, error } = await supabase
        .from('professionals')
        .select('photo_url')
        .eq('id', session.professional_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.professional_id,
    staleTime: 60000,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate(`/${establishmentSlug}/p/${professionalSlug}`, { replace: true });
    }
  }, [authLoading, isAuthenticated, establishmentSlug, professionalSlug, navigate]);

  const handleLogout = () => {
    logout();
    navigate(`/${establishmentSlug}/p/${professionalSlug}`, { replace: true });
  };

  const handleProfileUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['professional-portal-session'] });
    queryClient.invalidateQueries({ queryKey: ['professional-portal-profile'] });
  };

  const handleStatusChanged = () => {
    queryClient.invalidateQueries({ queryKey: ['professional-portal-appointments'] });
  };

  const handleAppointmentClick = (apt: PortalAppointment) => {
    setSelectedAppointment(apt);
    setDialogOpen(true);
  };

  // Filtered appointments for list/week view
  const filteredAppointments = useMemo(() => {
    let filtered = appointments || [];

    if (statusFilter === 'active') {
      filtered = filtered.filter((a) => ['booked', 'confirmed'].includes(a.status));
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.customer_name.toLowerCase().includes(q) ||
          a.customer_phone.includes(q) ||
          a.service_name.toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments, statusFilter, searchQuery]);

  // Today's next appointment
  const nextAppointment = useMemo(() => {
    const now = new Date();
    return (appointments || [])
      .filter((a) => ['booked', 'confirmed'].includes(a.status) && new Date(a.start_at) > now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0] || null;
  }, [appointments]);

  const getAppointmentsForDay = (date: Date) => {
    return filteredAppointments.filter((apt) => isSameDay(parseISO(apt.start_at), date));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isPortalDisabled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <LogOut className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-center">Portal desativado</h2>
            <p className="text-sm text-muted-foreground text-center">
              O acesso ao portal foi desativado pelo estabelecimento. Entre em contato com o administrador para reativar.
            </p>
            <Button variant="outline" onClick={handleLogout}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated || !session) {
    return null;
  }

  const photoUrl = professionalData?.photo_url;
  const initials = session.professional_name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                {photoUrl ? <AvatarImage src={photoUrl} alt={session.professional_name} /> : null}
                <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="font-semibold text-sm sm:text-base truncate">{session.professional_name}</h1>
                <p className="text-xs text-muted-foreground truncate">{session.establishment_name}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 sm:py-6 max-w-5xl">
        {/* Next appointment quick card */}
        {nextAppointment && activeTab === 'agenda' && (
          <button
            type="button"
            onClick={() => handleAppointmentClick(nextAppointment)}
            className="w-full mb-6 p-4 rounded-xl border bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-primary uppercase tracking-wide">Próximo atendimento</p>
                <p className="font-semibold mt-1">{nextAppointment.customer_name}</p>
                <p className="text-sm text-muted-foreground">
                  {nextAppointment.service_name} • {format(parseISO(nextAppointment.start_at), "HH:mm 'de' EEEE", { locale: ptBR })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {format(parseISO(nextAppointment.start_at), 'HH:mm')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(nextAppointment.start_at), 'dd/MM')}
                </p>
              </div>
            </div>
          </button>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabMode)}>
          <div className="mb-6 overflow-x-auto">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="agenda" className="gap-1.5 text-xs sm:text-sm flex-1 sm:flex-none">
                <List className="h-4 w-4" />
                <span>Agenda</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm flex-1 sm:flex-none">
                <CalendarIcon className="h-4 w-4" />
                <span>Calendário</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="gap-1.5 text-xs sm:text-sm flex-1 sm:flex-none">
                <User className="h-4 w-4" />
                <span>Perfil</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ============ AGENDA TAB ============ */}
          <TabsContent value="agenda" className="space-y-6">
            {/* Summary Cards */}
            <ProfessionalSummaryCards appointments={appointments || []} />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="booked">Agendados</SelectItem>
                    <SelectItem value="confirmed">Confirmados</SelectItem>
                    <SelectItem value="completed">Concluídos</SelectItem>
                    <SelectItem value="canceled">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(v) => v && setViewMode(v as ViewMode)}
                >
                  <ToggleGroupItem value="week" aria-label="Semanal">
                    <CalendarDays className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="Lista">
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
                    Hoje
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Week Range */}
            <div className="text-center text-sm font-medium text-muted-foreground">
              {format(weekStart, "d 'de' MMMM", { locale: ptBR })} –{' '}
              {format(weekEnd, "d 'de' MMMM, yyyy", { locale: ptBR })}
            </div>

            {/* Appointments */}
            {appointmentsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-64" />
              </div>
            ) : viewMode === 'week' ? (
              /* ---- Week View ---- */
              <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4 md:grid-cols-7">
                {days.map((day) => {
                  const dayApts = getAppointmentsForDay(day);
                  return (
                    <Card
                      key={day.toISOString()}
                      className={cn('min-h-[160px]', isToday(day) && 'ring-2 ring-primary')}
                    >
                      <CardHeader className="pb-1 px-2 pt-2">
                        <CardTitle
                          className={cn('text-center text-xs', isToday(day) && 'text-primary')}
                        >
                          <span className="block text-[10px] text-muted-foreground uppercase">
                            {format(day, 'EEE', { locale: ptBR })}
                          </span>
                          <span
                            className={cn(
                              'text-base',
                              isToday(day) &&
                                'bg-primary text-primary-foreground rounded-full w-7 h-7 inline-flex items-center justify-center'
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 px-1.5 pb-2">
                        {dayApts.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground text-center py-2">—</p>
                        ) : (
                          dayApts.slice(0, 4).map((apt) => (
                            <button
                              key={apt.id}
                              onClick={() => handleAppointmentClick(apt)}
                              className={cn(
                                'w-full text-left p-1.5 rounded border text-[10px] sm:text-xs cursor-pointer hover:opacity-80 transition-opacity',
                                statusColors[apt.status]
                              )}
                            >
                              <div className="flex items-center gap-1 font-medium">
                                <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                {format(parseISO(apt.start_at), 'HH:mm')}
                              </div>
                              <div className="truncate mt-0.5">{apt.customer_name}</div>
                            </button>
                          ))
                        )}
                        {dayApts.length > 4 && (
                          <p className="text-[10px] text-muted-foreground text-center">
                            +{dayApts.length - 4}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* ---- List View ---- */
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="hidden sm:table-cell">Serviço</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAppointments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                            <div className="flex flex-col items-center gap-2">
                              <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                              <p>Nenhum agendamento neste período</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAppointments.map((apt) => (
                          <TableRow
                            key={apt.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleAppointmentClick(apt)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
                                <div>
                                  <p className="font-medium text-sm">
                                    {format(parseISO(apt.start_at), 'dd/MM', { locale: ptBR })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(parseISO(apt.start_at), 'HH:mm')} –{' '}
                                    {format(parseISO(apt.end_at), 'HH:mm')}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{apt.customer_name}</p>
                              <p className="text-xs text-muted-foreground hidden sm:block">
                                {apt.customer_phone}
                              </p>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <p className="text-sm">{apt.service_name}</p>
                              <p className="text-xs text-muted-foreground">{apt.service_duration} min</p>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] sm:text-xs', statusColors[apt.status])}
                              >
                                {statusLabels[apt.status]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ============ CALENDAR TAB ============ */}
          <TabsContent value="calendar" className="space-y-6">
            <ProfessionalSummaryCards appointments={appointments || []} />
            <ProfessionalCalendarView
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              appointments={appointments || []}
              onAppointmentClick={handleAppointmentClick}
              isLoading={appointmentsLoading}
            />
          </TabsContent>

          {/* ============ PROFILE TAB ============ */}
          <TabsContent value="profile">
            <ProfessionalProfileSection
              token={token!}
              session={{
                professional_id: session.professional_id!,
                professional_name: session.professional_name!,
                establishment_name: session.establishment_name!,
              }}
              currentPhotoUrl={photoUrl}
              onProfileUpdated={handleProfileUpdated}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Appointment Detail Dialog */}
      <ProfessionalAppointmentDialog
        appointment={selectedAppointment}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        token={token!}
        onStatusChanged={handleStatusChanged}
      />

      {/* Completion Prompt */}
      <CompletionPromptDialog
        establishmentId={session.establishment_id}
        userType="professional"
      />
    </div>
  );
}
