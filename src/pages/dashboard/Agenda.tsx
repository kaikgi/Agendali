import { useState, useMemo } from 'react';
import {
  format,
  startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths,
  isToday, isSameDay, isSameMonth, parseISO, getDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, User, Ban, Filter, CalendarDays, List, Scissors, RefreshCw, CalendarRange } from 'lucide-react';
import { useAllCustomerTags } from '@/hooks/useClientTags';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useAppointments } from '@/hooks/useAppointments';
import { useManageProfessionals } from '@/hooks/useManageProfessionals';
import { useTimeBlocks, useRecurringTimeBlocks } from '@/hooks/useTimeBlocks';
import { AppointmentDetailsDialog } from '@/components/dashboard/AppointmentDetailsDialog';
import { PendingApprovalsSection } from '@/components/dashboard/PendingApprovalsSection';
import { statusColors, statusLabels, legendStatuses, dotColors } from '@/lib/appointmentStatus';
import { cn } from '@/lib/utils';

type AppointmentStatus = 'booked' | 'confirmed' | 'completed' | 'no_show' | 'canceled' | 'pending_approval' | 'rejected' | 'paid_pending_confirmation' | 'pending_payment';

interface Appointment {
  id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  customer: { id: string; name: string; phone: string; email: string | null } | null;
  professional: { id: string; name: string } | null;
  service: { id: string; name: string; duration_minutes: number } | null;
}

type ViewMode = 'week' | 'month' | 'list';

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showBlocks, setShowBlocks] = useState(true);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  
  const { data: establishment, isLoading: estLoading, error: estError, refetch: refetchEst } = useUserEstablishment();
  const { professionals } = useManageProfessionals(establishment?.id);
  const { data: allCustomerTags = [] } = useAllCustomerTags(establishment?.id);

  // Build customer → tags lookup
  const customerTagsMap = useMemo(() => {
    const map = new Map<string, typeof allCustomerTags>();
    for (const ct of allCustomerTags) {
      const list = map.get(ct.customer_id) ?? [];
      list.push(ct);
      map.set(ct.customer_id, list);
    }
    return map;
  }, [allCustomerTags]);

  const renderCustomerTags = (customerId: string | undefined) => {
    if (!customerId) return null;
    const tags = customerTagsMap.get(customerId);
    if (!tags?.length) return null;
    return (
      <span className="inline-flex flex-wrap gap-0.5 ml-1">
        {tags.map((ct) => (
          <span
            key={ct.tag_id}
            className="inline-flex items-center px-1 py-0 rounded-full text-[9px] font-medium text-white leading-none"
            style={{ backgroundColor: ct.tag?.color || '#6b7280' }}
          >
            {ct.tag?.name}
          </span>
        ))}
      </span>
    );
  };

  // Compute date range based on view mode
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'month') {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      return { rangeStart: startOfWeek(ms, { weekStartsOn: 0 }), rangeEnd: endOfWeek(me, { weekStartsOn: 0 }) };
    }
    return { rangeStart: startOfWeek(currentDate, { weekStartsOn: 0 }), rangeEnd: endOfWeek(currentDate, { weekStartsOn: 0 }) };
  }, [currentDate, viewMode]);

  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const { data: appointments, isLoading, error, refetch } = useAppointments(establishment?.id, {
    startDate: rangeStart,
    endDate: rangeEnd,
  });

  const { blocks: timeBlocks } = useTimeBlocks(establishment?.id);
  const { blocks: recurringBlocks } = useRecurringTimeBlocks(establishment?.id);

  const handleRetry = () => {
    if (estError) refetchEst();
    else refetch();
  };

  const navigatePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  };
  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };

  const getFilteredAppointments = () => {
    let filtered = appointments || [];
    if (selectedProfessional !== 'all') {
      filtered = filtered.filter((apt) => apt.professional?.id === selectedProfessional);
    }
    return filtered.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  };

  const getAppointmentsForDay = (date: Date) => {
    let filtered = appointments?.filter((apt) => isSameDay(parseISO(apt.start_at), date)) || [];
    if (selectedProfessional !== 'all') {
      filtered = filtered.filter((apt) => apt.professional?.id === selectedProfessional);
    }
    return filtered.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  };

  const getBlocksForDay = (date: Date) => {
    if (!showBlocks) return { punctualBlocks: [], recurringBlocks: [] };
    const dayOfWeek = getDay(date);
    let punctualBlocks = timeBlocks.filter((block) => isSameDay(parseISO(block.start_at), date));
    let recurring = recurringBlocks.filter((block) => block.weekday === dayOfWeek && block.active);
    if (selectedProfessional !== 'all') {
      punctualBlocks = punctualBlocks.filter((b) => b.professional_id === selectedProfessional || b.professional_id === null);
      recurring = recurring.filter((b) => b.professional_id === selectedProfessional || b.professional_id === null);
    }
    return { punctualBlocks, recurringBlocks: recurring };
  };

  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setDetailsOpen(true);
  };

  const isCompletedApt = (status: string) => status === 'completed';

  if (estError || error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Erro ao carregar agenda</p>
        <Button variant="outline" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (estLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  const periodLabel = viewMode === 'month'
    ? format(currentDate, "MMMM yyyy", { locale: ptBR })
    : `${format(rangeStart, "d 'de' MMMM", { locale: ptBR })} - ${format(rangeEnd, "d 'de' MMMM, yyyy", { locale: ptBR })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-muted-foreground">Visualize e gerencie seus agendamentos</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
            <ToggleGroupItem value="week" aria-label="Semanal" className="touch-target">
              <CalendarDays className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="month" aria-label="Mensal" className="touch-target">
              <CalendarRange className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Lista" className="touch-target">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="icon" className="touch-target" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" className="touch-target" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Label htmlFor="professional-filter" className="text-sm shrink-0">Profissional:</Label>
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger id="professional-filter" className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {viewMode !== 'list' && (
              <div className="flex items-center gap-2">
                <Switch id="show-blocks" checked={showBlocks} onCheckedChange={setShowBlocks} />
                <Label htmlFor="show-blocks" className="text-sm">Mostrar bloqueios</Label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      {appointments && <PendingApprovalsSection appointments={appointments as any} onAppointmentClick={handleAppointmentClick as any} professionals={professionals} />}

      <div className="text-center text-lg font-medium capitalize">{periodLabel}</div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : viewMode === 'month' ? (
        /* ─── Month View ─── */
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-muted">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayApts = getAppointmentsForDay(day);
              const inMonth = isSameMonth(day, currentDate);

              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-[80px] sm:min-h-[100px] border-t border-r p-1 relative',
                    !inMonth && 'bg-muted/30',
                    isToday(day) && 'bg-primary/5'
                  )}
                >
                  <span className={cn(
                    'text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full',
                    !inMonth && 'text-muted-foreground/50',
                    isToday(day) && 'bg-primary text-primary-foreground'
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayApts.slice(0, 3).map((apt) => (
                      <button
                        key={apt.id}
                        onClick={() => handleAppointmentClick(apt)}
                        className={cn(
                          'w-full text-left text-[10px] sm:text-xs px-1 py-0.5 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity',
                          statusColors[apt.status],
                          isCompletedApt(apt.status) && 'opacity-60 line-through'
                        )}
                      >
                        <span className="hidden sm:inline">
                          {format(parseISO(apt.start_at), 'HH:mm')} {apt.customer?.name}
                          {renderCustomerTags(apt.customer?.id)}
                        </span>
                        <span className="sm:hidden">
                          {format(parseISO(apt.start_at), 'HH:mm')}
                        </span>
                      </button>
                    ))}
                    {dayApts.length > 3 && (
                      <p className="text-[10px] text-muted-foreground text-center">+{dayApts.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        /* ─── Week View ─── */
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {days.map((day) => {
            const dayAppointments = getAppointmentsForDay(day);
            const { punctualBlocks, recurringBlocks: dayRecurring } = getBlocksForDay(day);
            const hasBlocks = punctualBlocks.length > 0 || dayRecurring.length > 0;

            return (
              <Card key={day.toISOString()} className={cn("min-h-[200px]", isToday(day) && "ring-2 ring-primary")}>
                <CardHeader className="pb-2">
                  <CardTitle className={cn("text-center text-sm", isToday(day) && "text-primary")}>
                    <span className="block text-xs text-muted-foreground uppercase">
                      {format(day, 'EEE', { locale: ptBR })}
                    </span>
                    <span className={cn(
                      "text-lg",
                      isToday(day) && "bg-primary text-primary-foreground rounded-full w-8 h-8 inline-flex items-center justify-center"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-2">
                  {dayRecurring.map((block) => (
                    <div key={`rec-${block.id}`} className="p-2 rounded-md border text-xs bg-amber-50 text-amber-800 border-amber-200">
                      <div className="flex items-center gap-1 font-medium">
                        <Ban className="h-3 w-3" />
                        {block.start_time} - {block.end_time}
                      </div>
                      <div className="truncate mt-1">{block.reason || 'Bloqueio recorrente'}</div>
                      {block.professionals?.name && <div className="text-amber-600 truncate text-[10px]">{block.professionals.name}</div>}
                    </div>
                  ))}

                  {punctualBlocks.map((block) => (
                    <div key={`pnt-${block.id}`} className="p-2 rounded-md border text-xs bg-orange-50 text-orange-800 border-orange-200">
                      <div className="flex items-center gap-1 font-medium">
                        <Ban className="h-3 w-3" />
                        {format(parseISO(block.start_at), 'HH:mm')} - {format(parseISO(block.end_at), 'HH:mm')}
                      </div>
                      <div className="truncate mt-1">{block.reason || 'Bloqueio'}</div>
                      {block.professionals?.name && <div className="text-orange-600 truncate text-[10px]">{block.professionals.name}</div>}
                    </div>
                  ))}

                  {dayAppointments.length === 0 && !hasBlocks ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Sem agendamentos</p>
                  ) : (
                    dayAppointments.slice(0, 5).map((apt) => (
                      <div
                        key={apt.id}
                        onClick={() => handleAppointmentClick(apt)}
                        className={cn(
                          "p-2 rounded-md border text-xs cursor-pointer hover:opacity-80 transition-opacity",
                          statusColors[apt.status],
                          isCompletedApt(apt.status) && "opacity-60 line-through"
                        )}
                      >
                        <div className="flex items-center gap-1 font-medium">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(apt.start_at), 'HH:mm')}
                        </div>
                        <div className="truncate mt-1">{apt.service?.name}</div>
                        <div className="flex items-center gap-1 text-muted-foreground truncate">
                          <User className="h-3 w-3" />
                          {apt.customer?.name}
                        </div>
                      </div>
                    ))
                  )}
                  {dayAppointments.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">+{dayAppointments.length - 5} mais</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ─── List View ─── */
        <Card>
          <CardContent className="p-0">
            {/* Mobile card list */}
            <div className="block sm:hidden divide-y divide-border">
              {getFilteredAppointments().length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum agendamento neste período
                </p>
              ) : (
                getFilteredAppointments().map((apt) => (
                  <div
                    key={apt.id}
                    onClick={() => handleAppointmentClick(apt)}
                    className={cn(
                      "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                      isCompletedApt(apt.status) && "opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("font-medium text-sm", isCompletedApt(apt.status) && "line-through")}>
                        {format(parseISO(apt.start_at), "dd/MM", { locale: ptBR })} • {format(parseISO(apt.start_at), 'HH:mm')} - {format(parseISO(apt.end_at), 'HH:mm')}
                      </span>
                      <Badge variant="outline" className={cn("text-xs", statusColors[apt.status])}>
                        {statusLabels[apt.status]}
                      </Badge>
                    </div>
                    <p className="text-sm truncate">{apt.customer?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{apt.service?.name} • {apt.professional?.name}</p>
                  </div>
                ))
              )}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredAppointments().length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum agendamento neste período
                      </TableCell>
                    </TableRow>
                  ) : (
                    getFilteredAppointments().map((apt) => (
                      <TableRow
                        key={apt.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50",
                          isCompletedApt(apt.status) && "opacity-60"
                        )}
                        onClick={() => handleAppointmentClick(apt)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className={cn("font-medium", isCompletedApt(apt.status) && "line-through")}>
                                {format(parseISO(apt.start_at), "dd/MM", { locale: ptBR })}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(apt.start_at), 'HH:mm')} - {format(parseISO(apt.end_at), 'HH:mm')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className={cn(isCompletedApt(apt.status) && "line-through")}>{apt.customer?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Scissors className="h-4 w-4 text-muted-foreground" />
                            <span>{apt.service?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{apt.professional?.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", statusColors[apt.status])}>
                            {statusLabels[apt.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {viewMode !== 'list' && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {legendStatuses.map(({ key, label }) => (
                <Badge key={key} variant="outline" className={cn("text-xs", statusColors[key])}>
                  {label}
                </Badge>
              ))}
              {showBlocks && (
                <>
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-800 border-amber-200">
                    Bloqueio Recorrente
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-800 border-orange-200">
                    Bloqueio Pontual
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <AppointmentDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        appointment={selectedAppointment}
      />
    </div>
  );
}
