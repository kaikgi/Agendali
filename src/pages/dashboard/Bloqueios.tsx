import { useState } from 'react';
import { Plus, Trash2, CalendarOff, Repeat, Pencil, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useManageProfessionals } from '@/hooks/useManageProfessionals';
import { useTimeBlocks, useRecurringTimeBlocks } from '@/hooks/useTimeBlocks';
import { useToast } from '@/hooks/use-toast';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface TimeBlockWithProfessional {
  id: string;
  establishment_id: string;
  professional_id: string | null;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at: string;
  professionals: { name: string } | null;
}

interface RecurringBlockWithProfessional {
  id: string;
  establishment_id: string;
  professional_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  reason: string | null;
  active: boolean;
  created_at: string;
  professionals: { name: string } | null;
}

export default function Bloqueios() {
  const { data: establishment, isLoading: estLoading, error: estError, refetch: refetchEst } = useUserEstablishment();
  const { professionals } = useManageProfessionals(establishment?.id);
  const { blocks, isLoading, error, refetch, create, isCreating, update, isUpdating, remove } = useTimeBlocks(establishment?.id);
  const { 
    blocks: recurringBlocks, 
    isLoading: recLoading,
    error: recError,
    refetch: refetchRec,
    create: createRecurring, 
    isCreating: isCreatingRecurring,
    update: updateRecurring,
    isUpdating: isUpdatingRecurring,
    remove: removeRecurring 
  } = useRecurringTimeBlocks(establishment?.id);
  const { toast } = useToast();

  // Pontual form state
  const [pontualOpen, setPontualOpen] = useState(false);
  const [editingPontual, setEditingPontual] = useState<TimeBlockWithProfessional | null>(null);
  const [pontualProfessionalId, setPontualProfessionalId] = useState<string>('all');
  const [pontualDate, setPontualDate] = useState('');
  const [pontualStartTime, setPontualStartTime] = useState('');
  const [pontualEndTime, setPontualEndTime] = useState('');
  const [pontualReason, setPontualReason] = useState('');

  // Recorrente form state
  const [recorrenteOpen, setRecorrenteOpen] = useState(false);
  const [editingRecorrente, setEditingRecorrente] = useState<RecurringBlockWithProfessional | null>(null);
  const [recorrenteProfessionalId, setRecorrenteProfessionalId] = useState<string>('all');
  const [recorrenteWeekday, setRecorrenteWeekday] = useState<string>('1');
  const [recorrenteStartTime, setRecorrenteStartTime] = useState('');
  const [recorrenteEndTime, setRecorrenteEndTime] = useState('');
  const [recorrenteReason, setRecorrenteReason] = useState('');

  const openNewPontual = () => {
    setEditingPontual(null);
    resetPontualForm();
    setPontualOpen(true);
  };

  const openEditPontual = (block: TimeBlockWithProfessional) => {
    setEditingPontual(block);
    setPontualProfessionalId(block.professional_id || 'all');
    setPontualDate(format(new Date(block.start_at), 'yyyy-MM-dd'));
    setPontualStartTime(format(new Date(block.start_at), 'HH:mm'));
    setPontualEndTime(format(new Date(block.end_at), 'HH:mm'));
    setPontualReason(block.reason || '');
    setPontualOpen(true);
  };

  const openNewRecorrente = () => {
    setEditingRecorrente(null);
    resetRecorrenteForm();
    setRecorrenteOpen(true);
  };

  const openEditRecorrente = (block: RecurringBlockWithProfessional) => {
    setEditingRecorrente(block);
    setRecorrenteProfessionalId(block.professional_id || 'all');
    setRecorrenteWeekday(String(block.weekday));
    setRecorrenteStartTime(block.start_time);
    setRecorrenteEndTime(block.end_time);
    setRecorrenteReason(block.reason || '');
    setRecorrenteOpen(true);
  };

  const handleSavePontual = async () => {
    if (!establishment?.id || !pontualDate || !pontualStartTime || !pontualEndTime) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      const data = {
        establishment_id: establishment.id,
        professional_id: pontualProfessionalId === 'all' ? null : pontualProfessionalId,
        start_at: `${pontualDate}T${pontualStartTime}:00`,
        end_at: `${pontualDate}T${pontualEndTime}:00`,
        reason: pontualReason || null,
      };

      if (editingPontual) {
        await update({ id: editingPontual.id, ...data });
        toast({ title: 'Bloqueio atualizado com sucesso!' });
      } else {
        await create(data);
        toast({ title: 'Bloqueio criado com sucesso!' });
      }
      setPontualOpen(false);
      resetPontualForm();
    } catch {
      toast({ title: 'Erro ao salvar bloqueio', variant: 'destructive' });
    }
  };

  const handleSaveRecorrente = async () => {
    if (!establishment?.id || !recorrenteStartTime || !recorrenteEndTime) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      const data = {
        establishment_id: establishment.id,
        professional_id: recorrenteProfessionalId === 'all' ? null : recorrenteProfessionalId,
        weekday: parseInt(recorrenteWeekday),
        start_time: recorrenteStartTime,
        end_time: recorrenteEndTime,
        reason: recorrenteReason || null,
        active: true,
      };

      if (editingRecorrente) {
        await updateRecurring({ id: editingRecorrente.id, ...data });
        toast({ title: 'Bloqueio recorrente atualizado com sucesso!' });
      } else {
        await createRecurring(data);
        toast({ title: 'Bloqueio recorrente criado com sucesso!' });
      }
      setRecorrenteOpen(false);
      resetRecorrenteForm();
    } catch {
      toast({ title: 'Erro ao salvar bloqueio recorrente', variant: 'destructive' });
    }
  };

  const handleDeletePontual = async (id: string) => {
    try {
      await remove(id);
      toast({ title: 'Bloqueio removido!' });
    } catch {
      toast({ title: 'Erro ao remover bloqueio', variant: 'destructive' });
    }
  };

  const handleDeleteRecorrente = async (id: string) => {
    try {
      await removeRecurring(id);
      toast({ title: 'Bloqueio recorrente removido!' });
    } catch {
      toast({ title: 'Erro ao remover bloqueio recorrente', variant: 'destructive' });
    }
  };

  const handleToggleRecorrenteActive = async (id: string, active: boolean) => {
    try {
      await updateRecurring({ id, active });
      toast({ title: active ? 'Bloqueio ativado!' : 'Bloqueio desativado!' });
    } catch {
      toast({ title: 'Erro ao atualizar bloqueio', variant: 'destructive' });
    }
  };

  const resetPontualForm = () => {
    setEditingPontual(null);
    setPontualProfessionalId('all');
    setPontualDate('');
    setPontualStartTime('');
    setPontualEndTime('');
    setPontualReason('');
  };

  const resetRecorrenteForm = () => {
    setEditingRecorrente(null);
    setRecorrenteProfessionalId('all');
    setRecorrenteWeekday('1');
    setRecorrenteStartTime('');
    setRecorrenteEndTime('');
    setRecorrenteReason('');
  };

  const handlePontualOpenChange = (open: boolean) => {
    setPontualOpen(open);
    if (!open) resetPontualForm();
  };

  const handleRecorrenteOpenChange = (open: boolean) => {
    setRecorrenteOpen(open);
    if (!open) resetRecorrenteForm();
  };

  const handleRetry = () => {
    if (estError) refetchEst();
    else if (error) refetch();
    else if (recError) refetchRec();
  };

  if (estLoading || isLoading || recLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (estError || error || recError) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Erro ao carregar bloqueios</p>
        <Button variant="outline" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const isSavingPontual = isCreating || isUpdating;
  const isSavingRecorrente = isCreatingRecurring || isUpdatingRecurring;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bloqueios de Horários</h1>
        <p className="text-muted-foreground">
          Gerencie bloqueios pontuais e recorrentes para o estabelecimento ou profissionais específicos
        </p>
      </div>

      <Tabs defaultValue="pontual">
        <TabsList>
          <TabsTrigger value="pontual" className="gap-2">
            <CalendarOff className="h-4 w-4" />
            Pontuais
          </TabsTrigger>
          <TabsTrigger value="recorrente" className="gap-2">
            <Repeat className="h-4 w-4" />
            Recorrentes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pontual" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Bloqueios Pontuais</CardTitle>
                <CardDescription>Bloqueios para datas e horários específicos</CardDescription>
              </div>
              <Button onClick={openNewPontual} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Novo Bloqueio
              </Button>
            </CardHeader>
            <CardContent>
              {blocks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum bloqueio pontual cadastrado
                </p>
              ) : (
                <div className="space-y-3">
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {format(new Date(block.start_at), "dd/MM/yyyy", { locale: ptBR })}
                          {' • '}
                          {format(new Date(block.start_at), 'HH:mm')} - {format(new Date(block.end_at), 'HH:mm')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {block.professionals?.name || 'Todo o Estabelecimento'}
                          {block.reason && ` • ${block.reason}`}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditPontual(block)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeletePontual(block.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recorrente" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Bloqueios Recorrentes</CardTitle>
                <CardDescription>Bloqueios que se repetem toda semana</CardDescription>
              </div>
              <Button onClick={openNewRecorrente} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Novo Bloqueio
              </Button>
            </CardHeader>
            <CardContent>
              {recurringBlocks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum bloqueio recorrente cadastrado
                </p>
              ) : (
                <div className="space-y-3">
                  {recurringBlocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Switch 
                          checked={block.active}
                          onCheckedChange={(active) => handleToggleRecorrenteActive(block.id, active)}
                        />
                        <div>
                          <p className="font-medium">
                            {WEEKDAYS[block.weekday]}
                            {' • '}
                            {block.start_time} - {block.end_time}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {block.professionals?.name || 'Todo o Estabelecimento'}
                            {block.reason && ` • ${block.reason}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditRecorrente(block)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteRecorrente(block.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pontual Dialog */}
      <Dialog open={pontualOpen} onOpenChange={handlePontualOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPontual ? 'Editar Bloqueio Pontual' : 'Novo Bloqueio Pontual'}
            </DialogTitle>
            <DialogDescription>
              {editingPontual 
                ? 'Atualize as informações do bloqueio' 
                : 'Crie um bloqueio para uma data e horário específicos'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Profissional</Label>
              <Select value={pontualProfessionalId} onValueChange={setPontualProfessionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o Estabelecimento</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input 
                type="date" 
                value={pontualDate} 
                onChange={(e) => setPontualDate(e.target.value)} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início</Label>
                <Input 
                  type="time" 
                  value={pontualStartTime} 
                  onChange={(e) => setPontualStartTime(e.target.value)} 
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input 
                  type="time" 
                  value={pontualEndTime} 
                  onChange={(e) => setPontualEndTime(e.target.value)} 
                />
              </div>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input 
                value={pontualReason} 
                onChange={(e) => setPontualReason(e.target.value)} 
                placeholder="Ex: Feriado, Reunião..." 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPontualOpen(false)}>Cancelar</Button>
            <ActionButton onClick={handleSavePontual} loadingLabel="Salvando..." successLabel="Salvo!">
              Salvar
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recorrente Dialog */}
      <Dialog open={recorrenteOpen} onOpenChange={handleRecorrenteOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRecorrente ? 'Editar Bloqueio Recorrente' : 'Novo Bloqueio Recorrente'}
            </DialogTitle>
            <DialogDescription>
              {editingRecorrente 
                ? 'Atualize as informações do bloqueio recorrente' 
                : 'Crie um bloqueio que se repete toda semana'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Profissional</Label>
              <Select value={recorrenteProfessionalId} onValueChange={setRecorrenteProfessionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o Estabelecimento</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dia da Semana</Label>
              <Select value={recorrenteWeekday} onValueChange={setRecorrenteWeekday}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day, i) => (
                    <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início</Label>
                <Input 
                  type="time" 
                  value={recorrenteStartTime} 
                  onChange={(e) => setRecorrenteStartTime(e.target.value)} 
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input 
                  type="time" 
                  value={recorrenteEndTime} 
                  onChange={(e) => setRecorrenteEndTime(e.target.value)} 
                />
              </div>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input 
                value={recorrenteReason} 
                onChange={(e) => setRecorrenteReason(e.target.value)} 
                placeholder="Ex: Almoço, Intervalo..." 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecorrenteOpen(false)}>Cancelar</Button>
            <ActionButton onClick={handleSaveRecorrente} loadingLabel="Salvando..." successLabel="Salvo!">
              Salvar
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
