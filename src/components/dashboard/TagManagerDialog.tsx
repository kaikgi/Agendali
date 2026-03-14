import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag, Shield, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  useClientTags,
  useCreateClientTag,
  useUpdateClientTag,
  useDeleteClientTag,
  type ClientTag,
} from '@/hooks/useClientTags';

const TAG_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#84cc16', '#d946ef', '#0ea5e9', '#e11d48', '#a855f7',
  '#78716c',
];

interface TagManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
}

export function TagManagerDialog({ open, onOpenChange, establishmentId }: TagManagerDialogProps) {
  const { data: tags = [], isLoading } = useClientTags(establishmentId);
  const createTag = useCreateClientTag(establishmentId);
  const updateTag = useUpdateClientTag(establishmentId);
  const deleteTag = useDeleteClientTag(establishmentId);

  const [editingTag, setEditingTag] = useState<ClientTag | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ClientTag | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(TAG_COLORS[0]);
  const [formBypass, setFormBypass] = useState(false);
  const [formBypassPayment, setFormBypassPayment] = useState(false);
  const [formActive, setFormActive] = useState(true);

  const resetForm = () => {
    setFormName('');
    setFormColor(TAG_COLORS[0]);
    setFormBypass(false);
    setFormBypassPayment(false);
    setFormActive(true);
    setEditingTag(null);
    setIsCreating(false);
  };

  const openCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const openEdit = (tag: ClientTag) => {
    setFormName(tag.name);
    setFormColor(tag.color);
    setFormBypass(tag.bypass_approval);
    setFormBypassPayment(tag.bypass_payment);
    setFormActive(tag.is_active);
    setEditingTag(tag);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Nome da tag é obrigatório');
      return;
    }

    try {
      if (editingTag) {
        await updateTag.mutateAsync({
          id: editingTag.id,
          name: formName.trim(),
          color: formColor,
          bypass_approval: formBypass,
          bypass_payment: formBypassPayment,
          is_active: formActive,
        });
        toast.success('Tag atualizada!');
      } else {
        await createTag.mutateAsync({
          name: formName.trim(),
          color: formColor,
          bypass_approval: formBypass,
          bypass_payment: formBypassPayment,
        });
        toast.success('Tag criada!');
      }
      resetForm();
    } catch (error: any) {
      if (error?.message?.includes('duplicate')) {
        toast.error('Já existe uma tag com esse nome');
      } else {
        toast.error('Erro ao salvar tag');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteTag.mutateAsync(deleteConfirm.id);
      toast.success('Tag excluída!');
      setDeleteConfirm(null);
      if (editingTag?.id === deleteConfirm.id) resetForm();
    } catch {
      toast.error('Erro ao excluir tag');
    }
  };

  const isEditing = isCreating || !!editingTag;
  const isSaving = createTag.isPending || updateTag.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Gerenciar Tags de Clientes
            </DialogTitle>
            <DialogDescription>
              Crie tags para classificar seus clientes e definir regras especiais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tag list */}
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : tags.length === 0 && !isEditing ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">Nenhuma tag criada ainda</p>
                </CardContent>
              </Card>
            ) : (
              !isEditing && (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <div>
                          <span className="font-medium text-sm">{tag.name}</span>
                          {tag.bypass_approval && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Shield className="h-3 w-3 text-emerald-600" />
                              <span className="text-xs text-emerald-600">Sem aprovação manual</span>
                            </div>
                          )}
                        </div>
                        {!tag.is_active && (
                          <Badge variant="secondary" className="text-xs">Inativa</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tag)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(tag)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Create/Edit form */}
            {isEditing && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    {editingTag ? 'Editar Tag' : 'Nova Tag'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      placeholder="Ex: VIP, Fidelidade, Premium..."
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex flex-wrap gap-2">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          className={`w-7 h-7 rounded-full transition-all ${
                            formColor === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setFormColor(color)}
                          type="button"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-accent/30">
                    <div>
                      <Label className="text-sm font-medium">Agendar sem aprovação</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Clientes com esta tag não precisam de aprovação manual
                      </p>
                    </div>
                    <Switch checked={formBypass} onCheckedChange={setFormBypass} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-accent/30">
                    <div>
                      <Label className="text-sm font-medium">Agendar sem pagamento</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Clientes com esta tag não precisam pagar online para agendar
                      </p>
                    </div>
                    <Switch checked={formBypassPayment} onCheckedChange={setFormBypassPayment} />
                  </div>

                  {editingTag && (
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <Label className="text-sm">Tag ativa</Label>
                      <Switch checked={formActive} onCheckedChange={setFormActive} />
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={resetForm}>
                      Cancelar
                    </Button>
                    <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                      {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingTag ? 'Salvar' : 'Criar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add button */}
            {!isEditing && (
              <Button variant="outline" className="w-full" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Tag
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tag "{deleteConfirm?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação removerá a tag de todos os clientes que a possuem. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
