import { useState, useMemo, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Scissors, RefreshCw, GripVertical,
  ChevronUp, ChevronDown, FolderPlus, Tag, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useManageServices, type Service } from '@/hooks/useManageServices';
import { useServiceCategories, type ServiceCategory } from '@/hooks/useServiceCategories';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ServiceForm {
  name: string;
  description: string;
  duration_minutes: string;
  price: string;
  category_id: string;
}

const NONE_CATEGORY_VALUE = '__none__';

export default function Servicos() {
  const { data: establishment, isLoading: estLoading, error: estError, refetch: refetchEst } = useUserEstablishment();
  const {
    services, isLoading, error, refetch,
    create, update, bulkUpdateOrder, delete: deleteService,
    isCreating, isUpdating, isSavingOrder,
  } = useManageServices(establishment?.id);
  const {
    categories, isLoading: catLoading,
    create: createCategory, isCreating: isCatCreating,
    update: updateCategory, isUpdating: isCatUpdating,
    remove: deleteCategory, isDeleting: isCatDeleting,
    reorder: reorderCategories, isReordering,
  } = useServiceCategories(establishment?.id);
  const { toast } = useToast();

  // Service dialog
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    name: '', description: '', duration_minutes: '30', price: '', category_id: '',
  });

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // Delete dialogs
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [deleteCategoryName, setDeleteCategoryName] = useState('');

  // Collapsed state
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Group services by category
  const groupedServices = useMemo(() => {
    const groups: { category: ServiceCategory | null; services: Service[] }[] = [];
    const byCatId = new Map<string | null, Service[]>();
    services.forEach((s) => {
      const key = s.category_id || null;
      if (!byCatId.has(key)) byCatId.set(key, []);
      byCatId.get(key)!.push(s);
    });
    categories.forEach((cat) => {
      groups.push({
        category: cat,
        services: (byCatId.get(cat.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
      });
    });
    const uncategorized = byCatId.get(null) ?? [];
    if (uncategorized.length > 0 || categories.length > 0) {
      groups.push({
        category: null,
        services: uncategorized.sort((a, b) => a.sort_order - b.sort_order),
      });
    }
    return groups;
  }, [services, categories]);

  const toggleCollapse = (id: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Category Handlers ──

  const openCreateCategory = () => {
    setEditingCategoryId(null);
    setCategoryName('');
    setCategoryError('');
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (cat: ServiceCategory) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name);
    setCategoryError('');
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    const trimmed = categoryName.trim();
    if (!trimmed) { setCategoryError('Nome é obrigatório'); return; }
    if (trimmed.length < 2) { setCategoryError('Mínimo 2 caracteres'); return; }
    if (trimmed.length > 80) { setCategoryError('Máximo 80 caracteres'); return; }

    try {
      if (editingCategoryId) {
        await updateCategory({ id: editingCategoryId, name: trimmed });
      } else {
        await createCategory({ name: trimmed });
      }
      setCategoryDialogOpen(false);
      setCategoryName('');
      setCategoryError('');
    } catch {
      // Error handled by mutation's onError
    }
  };

  const confirmDeleteCategory = (cat: ServiceCategory) => {
    setDeleteCategoryId(cat.id);
    setDeleteCategoryName(cat.name);
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;
    try {
      await deleteCategory(deleteCategoryId);
    } catch {
      // handled by mutation
    }
    setDeleteCategoryId(null);
    setDeleteCategoryName('');
  };

  const handleMoveCategoryUp = useCallback(async (catId: string) => {
    const idx = categories.findIndex((c) => c.id === catId);
    if (idx <= 0) return;
    const prev = categories[idx - 1];
    const curr = categories[idx];
    try {
      await reorderCategories([
        { id: curr.id, sort_order: prev.sort_order },
        { id: prev.id, sort_order: curr.sort_order },
      ]);
    } catch { /* handled */ }
  }, [categories, reorderCategories]);

  const handleMoveCategoryDown = useCallback(async (catId: string) => {
    const idx = categories.findIndex((c) => c.id === catId);
    if (idx < 0 || idx >= categories.length - 1) return;
    const next = categories[idx + 1];
    const curr = categories[idx];
    try {
      await reorderCategories([
        { id: curr.id, sort_order: next.sort_order },
        { id: next.id, sort_order: curr.sort_order },
      ]);
    } catch { /* handled */ }
  }, [categories, reorderCategories]);

  // ── Service Handlers ──

  const openCreateService = () => {
    setEditingServiceId(null);
    setServiceForm({ name: '', description: '', duration_minutes: '30', price: '', category_id: '' });
    setServiceDialogOpen(true);
  };

  const openEditService = (s: Service) => {
    setEditingServiceId(s.id);
    setServiceForm({
      name: s.name,
      description: s.description || '',
      duration_minutes: String(s.duration_minutes),
      price: s.price_cents ? (s.price_cents / 100).toFixed(2) : '',
      category_id: s.category_id || '',
    });
    setServiceDialogOpen(true);
  };

  const handleSaveService = async () => {
    const trimmedName = serviceForm.name.trim();
    if (!trimmedName) { toast({ title: 'Nome é obrigatório', variant: 'destructive' }); return; }

    const durationNum = parseInt(serviceForm.duration_minutes);
    if (isNaN(durationNum) || durationNum < 5) {
      toast({ title: 'Duração mínima: 5 minutos', variant: 'destructive' }); return;
    }

    let priceNum: number | null = null;
    if (serviceForm.price.trim()) {
      const parsed = parseFloat(serviceForm.price.replace(',', '.'));
      if (isNaN(parsed) || parsed < 0) { toast({ title: 'Preço inválido', variant: 'destructive' }); return; }
      priceNum = Math.round(parsed * 100);
    }

    if (!establishment?.id) return;
    const categoryId = serviceForm.category_id || null;

    try {
      if (editingServiceId) {
        await update({
          id: editingServiceId,
          name: trimmedName,
          description: serviceForm.description.trim() || null,
          duration_minutes: durationNum,
          price_cents: priceNum,
          category_id: categoryId,
        } as any);
        toast({ title: 'Serviço atualizado!' });
      } else {
        const maxOrder = services.reduce((max, s) => Math.max(max, s.sort_order), -1);
        await create({
          establishment_id: establishment.id,
          name: trimmedName,
          description: serviceForm.description.trim() || undefined,
          duration_minutes: durationNum,
          price_cents: priceNum ?? undefined,
          category_id: categoryId ?? undefined,
          sort_order: maxOrder + 1,
        });
        toast({ title: 'Serviço criado!' });
      }
      setServiceDialogOpen(false);
    } catch (err: any) {
      console.error('Erro ao salvar serviço:', err);
      toast({ title: 'Erro ao salvar serviço', description: err?.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await update({ id, active: !currentActive } as any);
      toast({ title: currentActive ? 'Serviço desativado' : 'Serviço ativado' });
    } catch (err: any) {
      toast({ title: 'Erro ao alterar status', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDeleteService = async () => {
    if (!deleteServiceId) return;
    try {
      await deleteService(deleteServiceId);
      toast({ title: 'Serviço removido' });
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err?.message, variant: 'destructive' });
    }
    setDeleteServiceId(null);
  };

  const handleMoveService = useCallback(async (serviceId: string, direction: 'up' | 'down') => {
    const flat = groupedServices.flatMap((g) => g.services);
    const idx = flat.findIndex((s) => s.id === serviceId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= flat.length) return;
    try {
      await bulkUpdateOrder([
        { id: flat[idx].id, sort_order: flat[targetIdx].sort_order },
        { id: flat[targetIdx].id, sort_order: flat[idx].sort_order },
      ]);
    } catch (err: any) {
      toast({ title: 'Erro ao reordenar', description: err?.message, variant: 'destructive' });
    }
  }, [groupedServices, bulkUpdateOrder, toast]);

  const formatPrice = (cents: number) => {
    if (!cents) return 'Preço não definido';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const handleRetry = () => { if (estError) refetchEst(); else refetch(); };

  if (estLoading || isLoading || catLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (estError || error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Erro ao carregar serviços</p>
        <Button variant="outline" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Serviços</h1>
          <p className="text-muted-foreground">Gerencie serviços e organize por categorias</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openCreateCategory}>
            <FolderPlus className="h-4 w-4 mr-2" /> Nova Categoria
          </Button>
          <Button onClick={openCreateService}>
            <Plus className="h-4 w-4 mr-2" /> Novo Serviço
          </Button>
        </div>
      </div>

      {services.length === 0 && categories.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Scissors className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum serviço cadastrado</h3>
            <p className="text-muted-foreground mb-4">Comece criando categorias e cadastrando serviços</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={openCreateCategory}>
                <FolderPlus className="h-4 w-4 mr-2" /> Nova Categoria
              </Button>
              <Button onClick={openCreateService}>
                <Plus className="h-4 w-4 mr-2" /> Cadastrar Serviço
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(services.length > 0 || categories.length > 0) && (
        <div className="space-y-4">
          {groupedServices.map((group) => {
            const catId = group.category?.id ?? '__uncategorized';
            const isCollapsed = collapsedCategories.has(catId);
            const serviceCount = group.services.length;

            return (
              <div key={catId} className="border rounded-lg overflow-hidden">
                <Collapsible open={!isCollapsed} onOpenChange={() => toggleCollapse(catId)}>
                  <div className="flex items-center justify-between bg-muted/40 px-4 py-3">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-left flex-1 min-w-0">
                        <ChevronRight className={cn(
                          'h-4 w-4 shrink-0 transition-transform',
                          !isCollapsed && 'rotate-90'
                        )} />
                        {group.category ? (
                          <>
                            <Tag className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-semibold truncate">{group.category.name}</span>
                          </>
                        ) : (
                          <span className="font-semibold text-muted-foreground truncate">
                            {categories.length > 0 ? 'Sem categoria' : 'Todos os serviços'}
                          </span>
                        )}
                        <Badge variant="secondary" className="text-xs shrink-0">{serviceCount}</Badge>
                      </button>
                    </CollapsibleTrigger>
                    {group.category && (
                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => handleMoveCategoryUp(group.category!.id)}
                          disabled={categories.indexOf(group.category!) === 0 || isReordering}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => handleMoveCategoryDown(group.category!.id)}
                          disabled={categories.indexOf(group.category!) === categories.length - 1 || isReordering}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => openEditCategory(group.category!)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => confirmDeleteCategory(group.category!)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <CollapsibleContent>
                    {serviceCount === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Nenhum serviço nesta categoria.
                        {group.category && <span> Edite um serviço para vinculá-lo aqui.</span>}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {group.services.map((service) => (
                          <div key={service.id} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                              <Button variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => handleMoveService(service.id, 'up')} disabled={isSavingOrder}>
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <Button variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => handleMoveService(service.id, 'down')} disabled={isSavingOrder}>
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium truncate">{service.name}</h3>
                                <Badge variant={service.active ? 'default' : 'secondary'} className="text-xs shrink-0">
                                  {service.active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </div>
                              {service.description && (
                                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{service.description}</p>
                              )}
                              <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                                <span>{service.duration_minutes} min</span>
                                <span>{formatPrice(service.price_cents || 0)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Switch checked={service.active}
                                onCheckedChange={() => handleToggleActive(service.id, service.active)} />
                              <Button variant="ghost" size="icon" onClick={() => openEditService(service)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteServiceId(service.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
        setCategoryDialogOpen(open);
        if (!open) { setCategoryError(''); setCategoryName(''); setEditingCategoryId(null); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCategoryId ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nome da categoria</Label>
              <Input id="category-name" value={categoryName}
                onChange={(e) => { setCategoryName(e.target.value); setCategoryError(''); }}
                placeholder="Ex: Premium, Básico, Combos" autoFocus maxLength={80}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isCatCreating && !isCatUpdating) handleSaveCategory(); }}
              />
              {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}
            </div>
            {!editingCategoryId && (
              <p className="text-sm text-muted-foreground">
                Após criar, vincule serviços editando cada serviço e selecionando esta categoria.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}
              disabled={isCatCreating || isCatUpdating}>Cancelar</Button>
            <ActionButton onClick={handleSaveCategory}
              disabled={!categoryName.trim() || categoryName.trim().length < 2}
              loadingLabel={editingCategoryId ? 'Salvando...' : 'Criando...'}
              successLabel={editingCategoryId ? 'Salvo!' : 'Criada!'}>
              {editingCategoryId ? 'Salvar' : 'Criar'}
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={(open) => {
        setServiceDialogOpen(open);
        if (!open) setEditingServiceId(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4" onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !(e.target instanceof HTMLTextAreaElement) && !isCreating && !isUpdating)
              handleSaveService();
          }}>
            <div className="space-y-2">
              <Label htmlFor="svc-name">Nome *</Label>
              <Input id="svc-name" value={serviceForm.name} autoFocus
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                placeholder="Nome do serviço" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-desc">Descrição</Label>
              <Textarea id="svc-desc" value={serviceForm.description} rows={3}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                placeholder="Descrição opcional" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={serviceForm.category_id || NONE_CATEGORY_VALUE}
                onValueChange={(v) => setServiceForm({ ...serviceForm, category_id: v === NONE_CATEGORY_VALUE ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_CATEGORY_VALUE}>Sem categoria</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="svc-dur">Duração (min) *</Label>
                <Input id="svc-dur" type="text" inputMode="numeric" value={serviceForm.duration_minutes}
                  onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: e.target.value.replace(/\D/g, '') })}
                  onFocus={(e) => e.target.select()} placeholder="30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-price">Preço (R$)</Label>
                <Input id="svc-price" type="text" inputMode="decimal" value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value.replace(/[^0-9.,]/g, '') })}
                  onFocus={(e) => e.target.select()} placeholder="0,00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialogOpen(false)} disabled={isCreating || isUpdating}>Cancelar</Button>
            <ActionButton onClick={handleSaveService} disabled={!serviceForm.name.trim()}
              loadingLabel={editingServiceId ? 'Salvando...' : 'Criando...'}
              successLabel={editingServiceId ? 'Salvo!' : 'Criado!'}>
              {editingServiceId ? 'Salvar' : 'Criar'}
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Service */}
      <AlertDialog open={!!deleteServiceId} onOpenChange={(open) => { if (!open) setDeleteServiceId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Serviço?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteService}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category */}
      <AlertDialog open={!!deleteCategoryId} onOpenChange={(open) => { if (!open) { setDeleteCategoryId(null); setDeleteCategoryName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria "{deleteCategoryName}"?</AlertDialogTitle>
            <AlertDialogDescription>Os serviços serão movidos para "Sem categoria". Nenhum serviço será removido.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
