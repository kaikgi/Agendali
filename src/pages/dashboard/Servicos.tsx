import { useState } from 'react';
import { Plus, Pencil, Trash2, Scissors, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useManageServices } from '@/hooks/useManageServices';
import { useToast } from '@/hooks/use-toast';

interface ServiceForm {
  name: string;
  description: string;
  duration_minutes: string;
  price: string;
}

export default function Servicos() {
  const { data: establishment, isLoading: estLoading, error: estError, refetch: refetchEst } = useUserEstablishment();
  const { services, isLoading, error, refetch, create, update, delete: deleteService, isCreating, isUpdating } = useManageServices(establishment?.id);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>({
    name: '',
    description: '',
    duration_minutes: '30',
    price: '',
  });

  const handleRetry = () => {
    if (estError) refetchEst();
    else refetch();
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', duration_minutes: '30', price: '' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (service: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price_cents: number | null;
  }) => {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description || '',
      duration_minutes: String(service.duration_minutes),
      price: service.price_cents ? (service.price_cents / 100).toFixed(2) : '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    const durationNum = parseInt(form.duration_minutes);
    if (isNaN(durationNum) || durationNum < 5) {
      toast({ title: 'Duração deve ser de pelo menos 5 minutos', variant: 'destructive' });
      return;
    }

    let priceNum: number | null = null;
    if (form.price.trim()) {
      const parsed = parseFloat(form.price.replace(',', '.'));
      if (isNaN(parsed) || parsed < 0) {
        toast({ title: 'Preço inválido', variant: 'destructive' });
        return;
      }
      priceNum = Math.round(parsed * 100);
    }

    if (!establishment?.id) {
      toast({ title: 'Estabelecimento não encontrado', variant: 'destructive' });
      return;
    }

    try {
      if (editingId) {
        await update({
          id: editingId,
          name: trimmedName,
          description: form.description.trim() || null,
          duration_minutes: durationNum,
          price_cents: priceNum,
        });
        toast({ title: 'Serviço atualizado!' });
      } else {
        await create({
          establishment_id: establishment.id,
          name: trimmedName,
          description: form.description.trim() || undefined,
          duration_minutes: durationNum,
          price_cents: priceNum ?? undefined,
        });
        toast({ title: 'Serviço criado com sucesso!' });
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm({ name: '', description: '', duration_minutes: '30', price: '' });
    } catch (err: any) {
      const msg = err?.message || 'Erro desconhecido';
      console.error('Erro ao salvar serviço:', err);
      toast({ title: 'Erro ao salvar serviço', description: msg, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await update({ id, active: !currentActive });
      toast({ title: currentActive ? 'Serviço desativado' : 'Serviço ativado' });
    } catch (err: any) {
      toast({ title: 'Erro ao alterar status', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteService(deletingId);
      toast({ title: 'Serviço removido' });
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (err: any) {
      toast({ title: 'Erro ao remover serviço', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setForm({ name: '', description: '', duration_minutes: '30', price: '' });
    }
  };

  const formatPrice = (cents: number) => {
    if (!cents) return 'Preço não definido';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  if (estLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (estError || error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Erro ao carregar serviços</p>
        <Button variant="outline" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Serviços</h1>
          <p className="text-muted-foreground">
            Gerencie os serviços oferecidos
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Scissors className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum serviço cadastrado</h3>
            <p className="text-muted-foreground mb-4">
              Cadastre serviços para que clientes possam agendar
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Serviço
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <Badge variant={service.active ? 'default' : 'secondary'}>
                    {service.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {service.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {service.description}
                  </p>
                )}
                <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                  <span>{service.duration_minutes} min</span>
                  <span>{formatPrice(service.price_cents || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={service.active}
                      onCheckedChange={() => handleToggleActive(service.id, service.active)}
                    />
                    <span className="text-sm text-muted-foreground">Ativo</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(service)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingId(service.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Serviço' : 'Novo Serviço'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !isCreating && !isUpdating) handleSubmit(); }}>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome do serviço"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição opcional"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duração (minutos)</Label>
                <Input
                  id="duration"
                  type="text"
                  inputMode="numeric"
                  value={form.duration_minutes}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setForm({ ...form, duration_minutes: val });
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                    setForm({ ...form, price: val });
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isCreating || isUpdating}>
              Cancelar
            </Button>
            <ActionButton
              onClick={handleSubmit}
              disabled={!form.name.trim()}
              loadingLabel={editingId ? 'Salvando...' : 'Criando...'}
              successLabel={editingId ? 'Salvo!' : 'Criado!'}
            >
              {editingId ? 'Salvar' : 'Criar'}
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O serviço será removido
              permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
