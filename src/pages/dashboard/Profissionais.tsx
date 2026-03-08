import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, User, Clock, Scissors, RefreshCw, X, Key } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
import { Switch } from '@/components/ui/switch';
import { ImageUploadButton } from '@/components/ImageUploadButton';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useManageProfessionals } from '@/hooks/useManageProfessionals';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ProfessionalHoursDialog } from '@/components/dashboard/ProfessionalHoursDialog';
import { ProfessionalServicesDialog } from '@/components/dashboard/ProfessionalServicesDialog';
import { ProfessionalPortalDialog } from '@/components/dashboard/ProfessionalPortalDialog';
import { UpgradePlanDialog } from '@/components/dashboard/UpgradePlanDialog';
import { UsageBadge } from '@/components/dashboard/UsageBadge';

interface ProfessionalForm {
  name: string;
  capacity: string;
  photo_url: string | null;
}

export default function Profissionais() {
  const { data: establishment, isLoading: estLoading, error: estError, refetch: refetchEst } = useUserEstablishment();
  const { professionals, isLoading, error, refetch, create, update, delete: deleteProfessional, isCreating, isUpdating } = useManageProfessionals(establishment?.id);
  const { data: limits } = usePlanLimits(establishment?.id);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hoursDialogOpen, setHoursDialogOpen] = useState(false);
  const [servicesDialogOpen, setServicesDialogOpen] = useState(false);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<{ id: string; name: string; slug: string | null; portal_enabled: boolean | null } | null>(null);
  const [form, setForm] = useState<ProfessionalForm>({ name: '', capacity: '1', photo_url: null });
  
  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handleRetry = () => {
    if (estError) refetchEst();
    else refetch();
  };

  const handleOpenCreate = () => {
    // Check if can create professional based on plan limits
    if (limits && !limits.canAddProfessional) {
      setUpgradeDialogOpen(true);
      return;
    }
    setEditingId(null);
    setForm({ name: '', capacity: '1', photo_url: null });
    setDialogOpen(true);
  };

  const handleOpenEdit = (prof: { id: string; name: string; capacity: number; photo_url: string | null }) => {
    setEditingId(prof.id);
    setForm({ name: prof.name, capacity: String(prof.capacity), photo_url: prof.photo_url || null });
    setDialogOpen(true);
  };

  // Handle photo upload for existing professional
  const handlePhotoUpload = async (croppedBlob: Blob) => {
    if (!editingId) {
      // For new professional, store blob temporarily
      const tempUrl = URL.createObjectURL(croppedBlob);
      setForm({ ...form, photo_url: tempUrl });
      (window as any).__pendingProfessionalPhotoBlob = croppedBlob;
      return;
    }

    // Upload immediately for existing professional
    setUploadingPhoto(true);
    try {
      const filePath = `professional-photos/${editingId}/photo.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      await update({ id: editingId, photo_url: urlWithCacheBuster });
      setForm({ ...form, photo_url: urlWithCacheBuster });
      toast({ title: 'Foto atualizada!' });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar foto', description: err?.message, variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handle photo removal
  const handleRemovePhoto = async () => {
    if (!editingId || !form.photo_url) return;

    setUploadingPhoto(true);
    try {
      // Try to remove from storage
      const urlParts = form.photo_url.split('/uploads/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split('?')[0]; // Remove cache buster
        await supabase.storage
          .from('uploads')
          .remove([filePath]);
      }

      // Update professional to remove photo URL
      await update({ id: editingId, photo_url: null });
      setForm({ ...form, photo_url: null });
      toast({ title: 'Foto removida!' });
    } catch (err: any) {
      toast({ title: 'Erro ao remover foto', description: err?.message, variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    const capacityNum = parseInt(form.capacity);
    if (isNaN(capacityNum) || capacityNum < 1) {
      toast({ title: 'Capacidade deve ser pelo menos 1', variant: 'destructive' });
      return;
    }

    try {
      if (editingId) {
        await update({ id: editingId, name: trimmedName, capacity: capacityNum });
        toast({ title: 'Profissional atualizado!' });
      } else {
        if (!establishment?.id) {
          toast({ title: 'Estabelecimento não encontrado', variant: 'destructive' });
          return;
        }
        const newProf = await create({
          establishment_id: establishment.id,
          name: trimmedName,
          capacity: capacityNum,
        });
        
        // Upload pending photo if exists
        const pendingBlob = (window as any).__pendingProfessionalPhotoBlob;
        if (pendingBlob && newProf?.id) {
          try {
            const filePath = `professional-photos/${newProf.id}/photo.jpg`;
            await supabase.storage
              .from('uploads')
              .upload(filePath, pendingBlob, { upsert: true, contentType: 'image/jpeg' });

            const { data: { publicUrl } } = supabase.storage
              .from('uploads')
              .getPublicUrl(filePath);

            await update({ id: newProf.id, photo_url: `${publicUrl}?t=${Date.now()}` });
          } catch (photoErr) {
            console.error('Failed to upload photo:', photoErr);
          }
          delete (window as any).__pendingProfessionalPhotoBlob;
        }
        
        toast({ title: 'Profissional criado com sucesso!' });
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm({ name: '', capacity: '1', photo_url: null });
    } catch (err: any) {
      const msg = err?.message || 'Erro desconhecido';
      console.error('Erro ao salvar profissional:', err);
      toast({ title: 'Erro ao salvar profissional', description: msg, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    // If reactivating, check plan limits first
    if (!currentActive && limits && !limits.canAddProfessional) {
      setUpgradeDialogOpen(true);
      return;
    }
    try {
      await update({ id, active: !currentActive });
      toast({ title: currentActive ? 'Profissional desativado' : 'Profissional ativado' });
    } catch (err: any) {
      toast({ title: 'Erro ao alterar status', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteProfessional(deletingId);
      toast({ title: 'Profissional removido' });
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (err: any) {
      toast({ title: 'Erro ao remover profissional', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setForm({ name: '', capacity: '1', photo_url: null });
      delete (window as any).__pendingProfessionalPhotoBlob;
    }
  };

  if (estLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (estError || error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Erro ao carregar profissionais</p>
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
          <h1 className="text-2xl font-bold">Profissionais</h1>
          <p className="text-muted-foreground">
            Gerencie os profissionais do seu estabelecimento
          </p>
          {limits && (
            <div className="mt-2 w-48">
              <UsageBadge
                current={limits.currentProfessionals}
                max={limits.maxProfessionals}
                label="Profissionais"
              />
            </div>
          )}
        </div>

        <Button onClick={handleOpenCreate} disabled={limits ? !limits.canAddProfessional : false} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Novo Profissional
        </Button>
      </div>

      <UpgradePlanDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        feature="professionals"
      />

      {professionals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum profissional cadastrado</h3>
            <p className="text-muted-foreground mb-4">
              Cadastre profissionais para que clientes possam agendar
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Profissional
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((prof) => (
            <Card key={prof.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {prof.photo_url ? (
                      <AvatarImage src={prof.photo_url} alt={prof.name} />
                    ) : null}
                    <AvatarFallback>
                      {prof.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{prof.name}</CardTitle>
                    <Badge variant={prof.active ? 'default' : 'secondary'} className="mt-1">
                      {prof.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Capacidade: {prof.capacity} cliente(s) simultâneo(s)
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={prof.active}
                      onCheckedChange={() => handleToggleActive(prof.id, prof.active)}
                    />
                    <span className="text-sm text-muted-foreground">Ativo</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Portal"
                      onClick={() => {
                        setSelectedProfessional({ 
                          id: prof.id, 
                          name: prof.name, 
                          slug: (prof as any).slug || null,
                          portal_enabled: (prof as any).portal_enabled ?? false
                        });
                        setPortalDialogOpen(true);
                      }}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Serviços"
                      onClick={() => {
                        setSelectedProfessional({ 
                          id: prof.id, 
                          name: prof.name, 
                          slug: (prof as any).slug || null,
                          portal_enabled: (prof as any).portal_enabled ?? false
                        });
                        setServicesDialogOpen(true);
                      }}
                    >
                      <Scissors className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Horários"
                      onClick={() => {
                        setSelectedProfessional({ 
                          id: prof.id, 
                          name: prof.name, 
                          slug: (prof as any).slug || null,
                          portal_enabled: (prof as any).portal_enabled ?? false
                        });
                        setHoursDialogOpen(true);
                      }}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar"
                      onClick={() => handleOpenEdit(prof)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remover"
                      onClick={() => {
                        setDeletingId(prof.id);
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
              {editingId ? 'Editar Profissional' : 'Novo Profissional'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4" onKeyDown={(e) => { if (e.key === 'Enter' && !isCreating && !isUpdating) handleSubmit(); }}>
            {/* Photo upload */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {form.photo_url ? (
                  <AvatarImage src={form.photo_url} alt="Foto" />
                ) : null}
                <AvatarFallback className="text-xl">
                  {form.name?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex gap-2">
                  <ImageUploadButton
                    onImageCropped={handlePhotoUpload}
                    currentImageUrl={form.photo_url}
                    buttonText="Adicionar Foto"
                    changeButtonText="Alterar"
                    maxFileSizeMB={5}
                    cropTitle="Recortar Foto"
                    disabled={uploadingPhoto}
                    isUploading={uploadingPhoto}
                  />
                  
                  {editingId && form.photo_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemovePhoto}
                      disabled={uploadingPhoto}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome do profissional"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacidade simultânea</Label>
              <Input
                id="capacity"
                type="text"
                inputMode="numeric"
                value={form.capacity}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setForm({ ...form, capacity: val });
                }}
                onFocus={(e) => e.target.select()}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">
                Quantos clientes este profissional pode atender ao mesmo tempo
              </p>
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
            <AlertDialogTitle>Remover Profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O profissional será removido
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

      {/* Professional Hours Dialog */}
      {selectedProfessional && (
        <ProfessionalHoursDialog
          open={hoursDialogOpen}
          onOpenChange={setHoursDialogOpen}
          professionalId={selectedProfessional.id}
          professionalName={selectedProfessional.name}
        />
      )}

      {/* Professional Services Dialog */}
      {selectedProfessional && establishment && (
        <ProfessionalServicesDialog
          open={servicesDialogOpen}
          onOpenChange={setServicesDialogOpen}
          professionalId={selectedProfessional.id}
          professionalName={selectedProfessional.name}
          establishmentId={establishment.id}
        />
      )}

      {/* Professional Portal Dialog */}
      {selectedProfessional && establishment && (
        <ProfessionalPortalDialog
          open={portalDialogOpen}
          onOpenChange={setPortalDialogOpen}
          professional={selectedProfessional}
          establishmentSlug={establishment.slug}
          onUpdate={update}
        />
      )}
    </div>
  );
}
