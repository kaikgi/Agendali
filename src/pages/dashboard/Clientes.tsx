import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, User, Phone, Mail, Calendar, ChevronRight, RefreshCw, Tag, Settings } from 'lucide-react';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useCustomers, useCustomerWithAppointments } from '@/hooks/useCustomers';
import { useAllCustomerTags, useClientTags, useCustomerTags } from '@/hooks/useClientTags';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getStatusLabel, getStatusBadgeClasses } from '@/lib/appointmentStatus';
import { TagManagerDialog } from '@/components/dashboard/TagManagerDialog';
import { CustomerTagsDialog } from '@/components/dashboard/CustomerTagsDialog';

export default function Clientes() {
  const { data: establishment, isLoading: estLoading, error: estError, refetch: refetchEst } = useUserEstablishment();
  const { data: customers, isLoading, error, refetch } = useCustomers(establishment?.id);
  const { data: allCustomerTags = [] } = useAllCustomerTags(establishment?.id);
  const { data: allTags = [] } = useClientTags(establishment?.id);

  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [customerTagsOpen, setCustomerTagsOpen] = useState(false);
  const [customerTagsTarget, setCustomerTagsTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: selectedCustomer } = useCustomerWithAppointments(selectedCustomerId ?? undefined);
  const { data: selectedCustomerTags = [] } = useCustomerTags(
    selectedCustomerId ?? undefined,
    establishment?.id
  );

  const handleRetry = () => {
    if (estError) refetchEst();
    else refetch();
  };

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

  const filteredCustomers = useMemo(() => {
    let result = customers ?? [];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.phone.includes(term) ||
          c.email?.toLowerCase().includes(term)
      );
    }

    if (tagFilter !== 'all') {
      result = result.filter((c) => {
        const tags = customerTagsMap.get(c.id);
        return tags?.some((t) => t.tag_id === tagFilter);
      });
    }

    return result;
  }, [customers, searchTerm, tagFilter, customerTagsMap]);

  const formatPrice = (cents: number | null) => {
    if (cents === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const openCustomerTags = (e: React.MouseEvent, customer: { id: string; name: string }) => {
    e.stopPropagation();
    setCustomerTagsTarget(customer);
    setCustomerTagsOpen(true);
  };

  const renderCustomerTags = (customerId: string) => {
    const tags = customerTagsMap.get(customerId);
    if (!tags?.length) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {tags.map((ct) => (
          <span
            key={ct.tag_id}
            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
            style={{ backgroundColor: ct.tag?.color || '#6b7280' }}
          >
            {ct.tag?.name}
          </span>
        ))}
      </div>
    );
  };

  if (estLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (estError || error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Erro ao carregar clientes</p>
        <Button variant="outline" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            Visualize seus clientes, tags e histórico de agendamentos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setTagManagerOpen(true)}>
          <Settings className="h-4 w-4 mr-2" />
          Gerenciar Tags
        </Button>
      </div>

      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {allTags.length > 0 && (
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[180px]">
              <Tag className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {allTags.filter((t) => t.is_active).map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10">
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Carregando clientes...</span>
            </div>
          </CardContent>
        </Card>
      ) : !filteredCustomers?.length ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-center text-muted-foreground">
              {searchTerm || tagFilter !== 'all' ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          {/* Mobile */}
          <div className="block md:hidden">
            <div className="divide-y divide-border">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedCustomerId(customer.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        {customer.name}
                      </p>
                      {renderCustomerTags(customer.id)}
                      <p className="text-sm text-muted-foreground truncate mt-1">{customer.phone}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => openCustomerTags(e, customer)}
                      >
                        <Tag className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden md:block table-responsive">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedCustomerId(customer.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {customer.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {customerTagsMap.get(customer.id)?.map((ct) => (
                          <span
                            key={ct.tag_id}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                            style={{ backgroundColor: ct.tag?.color || '#6b7280' }}
                          >
                            {ct.tag?.name}
                          </span>
                        )) || <span className="text-muted-foreground text-xs">—</span>}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 mt-1 text-xs text-muted-foreground"
                        onClick={(e) => openCustomerTags(e, customer)}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {customer.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{customer.email}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(customer.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Customer detail dialog */}
      <Dialog open={!!selectedCustomerId} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedCustomer?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedCustomer.phone}</span>
                </div>
                {selectedCustomer.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCustomer.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm col-span-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Cliente desde {format(new Date(selectedCustomer.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>

              {/* Tags section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) =>
                      openCustomerTags(e, { id: selectedCustomer.id, name: selectedCustomer.name })
                    }
                  >
                    Editar Tags
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCustomerTags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nenhuma tag aplicada</span>
                  ) : (
                    selectedCustomerTags.map((ct) => (
                      <span
                        key={ct.tag_id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: ct.tag?.color || '#6b7280' }}
                      >
                        {ct.tag?.name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Histórico de Agendamentos ({selectedCustomer.appointments.length})
                </h3>

                {selectedCustomer.appointments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum agendamento encontrado.</p>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {selectedCustomer.appointments.map((appointment) => (
                        <Card key={appointment.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {appointment.service?.name || 'Serviço removido'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(appointment.start_at), "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  com {appointment.professional?.name || 'Profissional removido'}
                                </p>
                                {appointment.customer_notes && (
                                  <p className="text-sm text-muted-foreground italic mt-2">
                                    "{appointment.customer_notes}"
                                  </p>
                                )}
                              </div>
                              <div className="text-right space-y-2">
                                <Badge className={`${getStatusBadgeClasses(appointment.status)} border`}>
                                  {getStatusLabel(appointment.status)}
                                </Badge>
                                {appointment.service?.price_cents && (
                                  <p className="text-sm font-medium">
                                    {formatPrice(appointment.service.price_cents)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tag manager dialog */}
      {establishment && (
        <TagManagerDialog
          open={tagManagerOpen}
          onOpenChange={setTagManagerOpen}
          establishmentId={establishment.id}
        />
      )}

      {/* Customer tags assignment dialog */}
      {customerTagsTarget && establishment && (
        <CustomerTagsDialog
          open={customerTagsOpen}
          onOpenChange={setCustomerTagsOpen}
          customerId={customerTagsTarget.id}
          customerName={customerTagsTarget.name}
          establishmentId={establishment.id}
        />
      )}
    </div>
  );
}
