import { useState, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Scissors, RefreshCw, GripVertical, ChevronUp, ChevronDown, FolderPlus, Tag } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useManageServices, type Service } from '@/hooks/useManageServices';
import { useToast } from '@/hooks/use-toast';

interface ServiceForm {
  name: string;
  description: string;
  duration_minutes: string;
  price: string;
  category: string;
}

const NONE_CATEGORY = '__none__';

export default function Servicos() {
  const { data: establishment, isLoading: estLoading, error: estError, refetch: refetchEst } = useUserEstablishment();
  const { services, isLoading, error, refetch, create, update, bulkUpdateOrder, delete: deleteService, isCreating, isUpdating, isSavingOrder } = useManageServices(establishment?.id);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', editingOld: '' });
  const [form, setForm] = useState<ServiceForm>({
    name: '',
    description: '',
    duration_minutes: '30',
    price: '',
    category: '',
  });

  // Extract unique categories from services, ordered by min sort_order
  const categories = useMemo(() => {
    const catMap = new Map<string, number>();
    services.forEach((s) => {
      if (s.category) {
        const existing = catMap.get(s.category);
        if (existing === undefined || s.sort_order < existing) {
          catMap.set(s.category, s.sort_order);
        }
      }
    });
    return Array.from(catMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);
  }, [services]);

  // Group services by category
  const groupedServices = useMemo(() => {
    const groups: { category: string | null; services: Service[] }[] = [];
    const catOrder = new Map(categories.map((c, i) => [c, i]));

    // Group by category
    const byCategory = new Map<string | null, Service[]>();
    services.forEach((s) => {
      const key = s.category || null;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(s);
    });

    // Sort categories: named categories first (in order), then uncategorized
    const sortedKeys = Array.from(byCategory.keys()).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return (catOrder.get(a) ?? 999) - (catOrder.get(b) ?? 999);
    });

    sortedKeys.forEach((key) => {
      const items = byCategory.get(key)!.sort((a, b) => a.sort_order - b.sort_order);
      groups.push({ category: key, services: items });
    });

    return groups;
  }, [services, categories]);

  const handleRetry = () => {
    if (estError) refetchEst();
    else refetch();
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', duration_minutes: '30', price: '', category: '' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (service: Service) => {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description || '',
      duration_minutes: String(service.duration_minutes),
      price: service.price_cents ? (service.price_cents / 100).toFixed(2) : '',
      category: service.category || '',
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

    const categoryValue = form.category.trim() || null;

    try {
      if (editingId) {
        await update({
          id: editingId,
          name: trimmedName,
          description: form.description.trim() || null,
          duration_minutes: durationNum,
          price_cents: priceNum,
          category: categoryValue,
        });
        toast({ title: 'Serviço atualizado!' });
      } else {
        // Set sort_order to be last
        const maxOrder = services.reduce((max, s) => Math.max(max, s.sort_order), -1);
        await create({
          establishment_id: establishment.id,
          name: trimmedName,
          description: form.description.trim() || undefined,
          duration_minutes: durationNum,
          price_cents: priceNum ?? undefined,
          category: categoryValue ?? undefined,
          sort_order: maxOrder + 1,
        });
        toast({ title: 'Serviço criado com sucesso!' });
      }
      setDialogOpen(false);
      setEditingId(null);
    } catch (err: any) {
      console.error('Erro ao salvar serviço:', err);
      toast({ title: 'Erro ao salvar serviço', description: err?.message, variant: 'destructive' });
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

  const handleMoveService = useCallback(async (serviceId: string, direction: 'up' | 'down') => {
    // Flatten all services in display order
    const flat = groupedServices.flatMap(g => g.services);
    const idx = flat.findIndex(s => s.id === serviceId);
    if (idx < 0) return;
    
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= flat.length) return;

    // Swap sort_order values
    const current = flat[idx];
    const target = flat[targetIdx];
    
    try {
      await bulkUpdateOrder([
        { id: current.id, sort_order: target.sort_order },
        { id: target.id, sort_order: current.sort_order },
      ]);
    } catch (err: any) {
      toast({ title: 'Erro ao reordenar', description: err?.message, variant: 'destructive' });
    }
  }, [groupedServices, bulkUpdateOrder, toast]);

  const handleMoveCategoryUp = useCallback(async (categoryName: string) => {
    const catIdx = categories.indexOf(categoryName);
    if (catIdx <= 0) return;

    // Swap sort_orders between all services in this category and the one above
    const thisCat = groupedServices.find(g => g.category === categoryName);
    const prevCatName = categories[catIdx - 1];
    const prevCat = groupedServices.find(g => g.category === prevCatName);
    
    if (!thisCat || !prevCat) return;

    // Reassign sort_orders: prev category gets current's positions, current gets prev's
    const updates: { id: string; sort_order: number }[] = [];
    let order = Math.min(
      ...[...thisCat.services, ...prevCat.services].map(s => s.sort_order)
    );

    thisCat.services.forEach(s => {
      updates.push({ id: s.id, sort_order: order++ });
    });
    prevCat.services.forEach(s => {
      updates.push({ id: s.id, sort_order: order++ });
    });

    try {
      await bulkUpdateOrder(updates);
    } catch (err: any) {
      toast({ title: 'Erro ao reordenar categorias', description: err?.message, variant: 'destructive' });
    }
  }, [categories, groupedServices, bulkUpdateOrder, toast]);

  const handleMoveCategoryDown = useCallback(async (categoryName: string) => {
    const catIdx = categories.indexOf(categoryName);
    if (catIdx >= categories.length - 1) return;

    const thisCat = groupedServices.find(g => g.category === categoryName);
    const nextCatName = categories[catIdx + 1];
    const nextCat = groupedServices.find(g => g.category === nextCatName);
    
    if (!thisCat || !nextCat) return;

    const updates: { id: string; sort_order: number }[] = [];
    let order = Math.min(
      ...[...thisCat.services, ...nextCat.services].map(s => s.sort_order)
    );

    nextCat.services.forEach(s => {
      updates.push({ id: s.id, sort_order: order++ });
    });
    thisCat.services.forEach(s => {
      updates.push({ id: s.id, sort_order: order++ });
    });

    try {
      await bulkUpdateOrder(updates);
    } catch (err: any) {
      toast({ title: 'Erro ao reordenar categorias', description: err?.message, variant: 'destructive' });
    }
  }, [categories, groupedServices, bulkUpdateOrder, toast]);

  const handleSaveCategory = async () => {
    const newName = categoryForm.name.trim();
    if (!newName) {
      toast({ title: 'Nome da categoria é obrigatório', variant: 'destructive' });
      return;
    }

    if (categoryForm.editingOld) {
      // Rename: update all services with old category to new
      const toUpdate = services.filter(s => s.category === categoryForm.editingOld);
      if (toUpdate.length === 0) return;

      try {
        await bulkUpdateOrder(
          toUpdate.map(s => ({ id: s.id, sort_order: s.sort_order, category: newName }))
        );
        toast({ title: 'Categoria renomeada!' });
        setCategoryDialogOpen(false);
      } catch (err: any) {
        toast({ title: 'Erro ao renomear categoria', description: err?.message, variant: 'destructive' });
      }
    } else {
      // Just close — categories are created implicitly when assigned to a service
      toast({ title: 'Categoria criada! Agora vincule serviços a ela.' });
      setCategoryDialogOpen(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    const toUpdate = services.filter(s => s.category === deletingCategory);
    
    try {
      await bulkUpdateOrder(
        toUpdate.map(s => ({ id: s.id, sort_order: s.sort_order, category: null }))
      );
      toast({ title: 'Categoria removida. Serviços movidos para "Sem categoria".' });
      setDeleteCategoryDialogOpen(false);
      setDeletingCategory(null);
    } catch (err: any) {
      toast({ title: 'Erro ao remover categoria', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setForm({ name: '', description: '', duration_minutes: '30', price: '', category: '' });
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
            Gerencie os serviços oferecidos e organize por categorias
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setCategoryForm({ name: '', editingOld: '' });
              setCategoryDialogOpen(true);
            }}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Serviço
          </Button>
        </div>
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
        <div className="space-y-6">
          {groupedServices.map((group) => (
            <div key={group.category ?? '__uncategorized'}>
              {/* Category header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {group.category ? (
                    <>
                      <Tag className="h-4 w-4 text-primary" />
                      <h2 className="text-lg font-semibold">{group.category}</h2>
                      <Badge variant="secondary" className="text-xs">
                        {group.services.length}
                      </Badge>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-semibold text-muted-foreground">
                        {categories.length > 0 ? 'Sem categoria' : 'Todos os serviços'}
                      </h2>
                      <Badge variant="secondary" className="text-xs">
                        {group.services.length}
                      </Badge>
                    </>
                  )}
                </div>
                {group.category && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMoveCategoryUp(group.category!)}
                      disabled={categories.indexOf(group.category!) === 0 || isSavingOrder}
                      title="Mover categoria para cima"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMoveCategoryDown(group.category!)}
                      disabled={categories.indexOf(group.category!) === categories.length - 1 || isSavingOrder}
                      title="Mover categoria para baixo"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCategoryForm({ name: group.category!, editingOld: group.category! });
                        setCategoryDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeletingCategory(group.category);
                        setDeleteCategoryDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                )}
              </div>

              {/* Services list */}
              <div className="space-y-2">
                {group.services.map((service, idx) => (
                  <Card key={service.id} className="transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Reorder controls */}
                        <div className="flex flex-col items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveService(service.id, 'up')}
                            disabled={isSavingOrder}
                            title="Mover para cima"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveService(service.id, 'down')}
                            disabled={isSavingOrder}
                            title="Mover para baixo"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Service info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{service.name}</h3>
                            <Badge variant={service.active ? 'default' : 'secondary'} className="text-xs shrink-0">
                              {service.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                              {service.description}
                            </p>
                          )}
                          <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                            <span>{service.duration_minutes} min</span>
                            <span>{formatPrice(service.price_cents || 0)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch
                            checked={service.active}
                            onCheckedChange={() => handleToggleActive(service.id, service.active)}
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(service)}>
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
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Service Dialog */}
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
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={form.category || NONE_CATEGORY}
                onValueChange={(v) => setForm({ ...form, category: v === NONE_CATEGORY ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_CATEGORY}>Sem categoria</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ou digite uma nova categoria no campo acima
              </p>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ou digite uma nova categoria"
                className="mt-1"
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

      {/* Category Create/Edit Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {categoryForm.editingOld ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nome da categoria</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Ex: Premium, Básico, Combos"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCategory(); }}
              />
            </div>
            {!categoryForm.editingOld && (
              <p className="text-sm text-muted-foreground">
                Após criar a categoria, vincule serviços a ela editando cada serviço.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <ActionButton
              onClick={handleSaveCategory}
              disabled={!categoryForm.name.trim()}
              loadingLabel="Salvando..."
              successLabel="Salvo!"
            >
              {categoryForm.editingOld ? 'Renomear' : 'Criar'}
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Service Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O serviço será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={deleteCategoryDialogOpen} onOpenChange={setDeleteCategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria "{deletingCategory}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Os serviços desta categoria serão movidos para "Sem categoria". Nenhum serviço será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory}>Excluir Categoria</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}