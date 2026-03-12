import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, Plus, Trash2, Loader2, CalendarOff, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ActionButton } from '@/components/ui/action-button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const weekdayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface ProfessionalTimeBlocksViewProps {
  token: string;
}

export function ProfessionalTimeBlocksView({ token }: ProfessionalTimeBlocksViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockStartTime, setNewBlockStartTime] = useState('');
  const [newBlockEndTime, setNewBlockEndTime] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['professional-time-blocks', token],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_professional_time_blocks', {
        p_token: token,
      });
      if (error) throw error;
      return data as {
        success: boolean;
        time_blocks: Array<{ id: string; start_at: string; end_at: string; reason: string | null }>;
        recurring_blocks: Array<{ id: string; weekday: number; start_time: string; end_time: string; reason: string | null; active: boolean }>;
      };
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newBlockDate || !newBlockStartTime || !newBlockEndTime) {
        throw new Error('Preencha data e horários');
      }

      const startAt = `${newBlockDate}T${newBlockStartTime}:00`;
      const endAt = `${newBlockDate}T${newBlockEndTime}:00`;

      if (startAt >= endAt) {
        throw new Error('Horário de início deve ser antes do fim');
      }

      const { data, error } = await (supabase.rpc as any)('professional_create_time_block', {
        p_token: token,
        p_start_at: startAt,
        p_end_at: endAt,
        p_reason: newBlockReason || null,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professional-time-blocks'] });
      setShowCreateDialog(false);
      setNewBlockDate('');
      setNewBlockStartTime('');
      setNewBlockEndTime('');
      setNewBlockReason('');
      toast({ title: 'Bloqueio criado com sucesso!' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const { data, error } = await (supabase.rpc as any)('professional_delete_time_block', {
        p_token: token,
        p_block_id: blockId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professional-time-blocks'] });
      toast({ title: 'Bloqueio removido!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao remover bloqueio', description: err?.message, variant: 'destructive' });
    },
  });

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const timeBlocks = data?.time_blocks || [];
  const recurringBlocks = data?.recurring_blocks || [];
  const now = new Date();
  const futureBlocks = timeBlocks.filter((b) => !isBefore(parseISO(b.end_at), now));
  const pastBlocks = timeBlocks.filter((b) => isBefore(parseISO(b.end_at), now));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Ban className="h-5 w-5" />
            Bloqueios de Horário
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie seus bloqueios e indisponibilidades
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo Bloqueio
        </Button>
      </div>

      {/* Recurring blocks (read-only, set by establishment) */}
      {recurringBlocks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Bloqueios Recorrentes
            </CardTitle>
            <CardDescription className="text-xs">Definidos pelo estabelecimento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recurringBlocks.map((rb) => (
                <div
                  key={rb.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {weekdayLabels[rb.weekday]}
                    </Badge>
                    <span className="font-medium">
                      {rb.start_time.slice(0, 5)} – {rb.end_time.slice(0, 5)}
                    </span>
                    {rb.reason && (
                      <span className="text-muted-foreground text-xs">• {rb.reason}</span>
                    )}
                  </div>
                  <Badge variant={rb.active ? 'default' : 'secondary'} className="text-[10px]">
                    {rb.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Future blocks (manageable) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Bloqueios Ativos</CardTitle>
          <CardDescription className="text-xs">Bloqueios pontuais criados por você</CardDescription>
        </CardHeader>
        <CardContent>
          {futureBlocks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <CalendarOff className="h-10 w-10 opacity-40" />
              <p className="text-sm font-medium">Nenhum bloqueio ativo</p>
              <p className="text-xs">Crie bloqueios para marcar horários indisponíveis.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {futureBlocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {format(parseISO(block.start_at), "dd/MM/yy '·' HH:mm", { locale: ptBR })} –{' '}
                      {format(parseISO(block.end_at), 'HH:mm')}
                    </p>
                    {block.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">{block.reason}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMutation.mutate(block.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past blocks */}
      {pastBlocks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Bloqueios Passados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {pastBlocks.slice(0, 10).map((block) => (
                <div key={block.id} className="flex items-center justify-between p-2 text-sm text-muted-foreground">
                  <span>
                    {format(parseISO(block.start_at), "dd/MM/yy HH:mm")} – {format(parseISO(block.end_at), 'HH:mm')}
                  </span>
                  {block.reason && <span className="text-xs truncate max-w-[150px]">{block.reason}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Bloqueio de Horário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={newBlockDate} onChange={(e) => setNewBlockDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={newBlockStartTime} onChange={(e) => setNewBlockStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={newBlockEndTime} onChange={(e) => setNewBlockEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                placeholder="Ex: Consulta médica, reunião..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <ActionButton onClick={handleCreate} loadingLabel="Criando..." successLabel="Criado!">
              <Plus className="h-4 w-4 mr-2" />
              Criar Bloqueio
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
