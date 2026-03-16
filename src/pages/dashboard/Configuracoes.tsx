import { useState, useEffect, useCallback } from 'react';
import { Save, Copy, Check, RefreshCw, AlertCircle, CheckCircle2, Trash2, Loader2, Globe, Image, Building2, CalendarCog, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ImageUploadButton } from '@/components/ImageUploadButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { getPublicUrl, PUBLIC_BASE_URL } from '@/lib/publicUrl';
import { PhoneInput } from '@/components/ui/phone-input';

// Reserved slugs that cannot be used
const RESERVED_SLUGS = ['app', 'dashboard', 'login', 'entrar', 'criar-conta', 'signup', 'api', 'admin', 'settings', 'configuracoes', 'agenda', 'profissionais', 'servicos', 'clientes', 'horarios', 'bloqueios'];

// Slug validation regex: lowercase letters, numbers, and hyphens only
const SLUG_REGEX = /^[a-z0-9-]+$/;

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) return { valid: false, error: 'O link é obrigatório' };
  if (slug.length < 3) return { valid: false, error: 'Mínimo de 3 caracteres' };
  if (slug.length > 40) return { valid: false, error: 'Máximo de 40 caracteres' };
  if (!SLUG_REGEX.test(slug)) return { valid: false, error: 'Apenas letras minúsculas, números e hífen' };
  if (RESERVED_SLUGS.includes(slug)) return { valid: false, error: 'Este link é reservado' };
  return { valid: true };
}

export default function Configuracoes() {
  const { data: establishment, isLoading, error, refetch } = useUserEstablishment();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [copied, setCopied] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    instagram: '',
    booking_enabled: true,
    auto_confirm_bookings: true,
    reschedule_min_hours: '2',
    max_future_days: '7',
    slot_interval_minutes: '15',
    reminder_hours_before: '3',
    buffer_minutes: '0',
  });

  useEffect(() => {
    if (establishment) {
      setSlug(establishment.slug || '');
      setSlugAvailable(null);
      setSlugError(null);
      setLogoUrl(establishment.logo_url || null);
      setForm({
        name: establishment.name || '',
        description: establishment.description || '',
        phone: establishment.phone || '',
        address: establishment.address || '',
        city: (establishment as any).city || '',
        state: (establishment as any).state || '',
        instagram: (establishment as any).instagram || '',
        booking_enabled: establishment.booking_enabled,
        auto_confirm_bookings: establishment.auto_confirm_bookings,
        reschedule_min_hours: String(establishment.reschedule_min_hours ?? 2),
        max_future_days: String(establishment.max_future_days ?? 7),
        slot_interval_minutes: String(establishment.slot_interval_minutes ?? 15),
        reminder_hours_before: String((establishment as any).reminder_hours_before ?? 3),
        buffer_minutes: String((establishment as any).buffer_minutes ?? 0),
      });
    }
  }, [establishment]);

  const handleLogoUpload = async (croppedBlob: Blob) => {
    if (!establishment) {
      console.error('[logo-upload] Upload cancelado: estabelecimento não encontrado');
      toast({ title: 'Estabelecimento não encontrado', description: 'Recarregue a página e tente novamente.', variant: 'destructive' });
      return;
    }

    console.log('[logo-upload] Clique em salvar/enviar logo', {
      establishmentId: establishment.id,
      blobSize: croppedBlob.size,
      blobType: croppedBlob.type,
    });

    setUploadingLogo(true);
    try {
      const bucket = 'uploads';
      const filePath = `logos/${establishment.id}/logo.jpg`;
      console.log('[logo-upload] Iniciando upload no storage', { bucket, filePath });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, croppedBlob, {
          upsert: true,
          contentType: 'image/jpeg',
          cacheControl: '0',
        });

      console.log('[logo-upload] Retorno do storage', { uploadData, uploadError });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const urlWithCacheBuster = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      console.log('[logo-upload] URL final gerada', { urlWithCacheBuster });

      const { data: updatedEstablishment, error: updateError } = await supabase
        .from('establishments')
        .update({ logo_url: urlWithCacheBuster })
        .eq('id', establishment.id)
        .select('id, logo_url')
        .single();

      console.log('[logo-upload] Retorno do save no banco', { updatedEstablishment, updateError });
      if (updateError) throw updateError;

      const nextLogoUrl = updatedEstablishment.logo_url;
      setLogoUrl(nextLogoUrl);
      queryClient.setQueryData(['user-establishment', (establishment as any).owner_user_id], (prev: any) =>
        prev ? { ...prev, logo_url: nextLogoUrl } : prev
      );
      queryClient.invalidateQueries({ queryKey: ['user-establishment'] });
      queryClient.invalidateQueries({ queryKey: ['establishment'] });

      console.log('[logo-upload] UI atualizada com nova logo', { nextLogoUrl });
      toast({ title: 'Logo atualizada!', description: 'A nova logo já está salva e visível no sistema.' });
    } catch (err: any) {
      console.error('[logo-upload] Erro no fluxo de upload', err);
      toast({
        title: 'Erro ao enviar logo',
        description: err?.message || 'Não foi possível salvar a logo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!establishment || !logoUrl) return;
    setUploadingLogo(true);
    try {
      const urlParts = logoUrl.split('/uploads/');
      if (urlParts.length > 1) {
        const rawPath = urlParts[1].split('?')[0];
        console.log('[logo-upload] Removendo arquivo antigo do storage', { rawPath });
        const { data: removeData, error: removeError } = await supabase.storage.from('uploads').remove([rawPath]);
        console.log('[logo-upload] Retorno da remoção no storage', { removeData, removeError });
        if (removeError) throw removeError;
      }
      const { data: updatedEstablishment, error } = await supabase
        .from('establishments')
        .update({ logo_url: null })
        .eq('id', establishment.id)
        .select('id, logo_url')
        .single();
      if (error) throw error;
      setLogoUrl(updatedEstablishment.logo_url);
      queryClient.invalidateQueries({ queryKey: ['user-establishment'] });
      queryClient.invalidateQueries({ queryKey: ['establishment'] });
      toast({ title: 'Logo removida!', description: 'A logo atual foi removida com sucesso.' });
    } catch (err: any) {
      console.error('[logo-upload] Erro ao remover logo', err);
      toast({ title: 'Erro ao remover logo', description: err?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const checkSlugAvailability = useCallback(async (slugToCheck: string) => {
    const normalized = normalizeSlug(slugToCheck);
    if (!establishment || normalized === establishment.slug) {
      setSlugAvailable(null);
      setSlugError(null);
      return;
    }
    const validation = validateSlug(normalized);
    if (!validation.valid) {
      setSlugError(validation.error || null);
      setSlugAvailable(null);
      return;
    }
    setCheckingSlug(true);
    setSlugError(null);
    try {
      const { data, error } = await supabase.rpc('check_establishment_slug_available', {
        p_slug: normalized,
        p_current_establishment_id: establishment.id,
      });
      if (error) throw error;
      if (data) {
        setSlugAvailable(true);
        setSlugError(null);
      } else {
        setSlugAvailable(false);
        setSlugError('Este link já está em uso');
      }
    } catch {
      setSlugError('Erro ao verificar disponibilidade');
      setSlugAvailable(null);
    } finally {
      setCheckingSlug(false);
    }
  }, [establishment]);

  useEffect(() => {
    if (!slug || !establishment) return;
    const timer = setTimeout(() => checkSlugAvailability(slug), 500);
    return () => clearTimeout(timer);
  }, [slug, checkSlugAvailability, establishment]);

  const handleSlugChange = (value: string) => {
    const normalized = normalizeSlug(value);
    setSlug(normalized);
    const validation = validateSlug(normalized);
    if (!validation.valid) {
      setSlugError(validation.error || null);
      setSlugAvailable(null);
    }
  };

  const handleSave = async () => {
    if (!establishment) throw new Error('validation');
    const normalizedSlug = normalizeSlug(slug);
    const validation = validateSlug(normalizedSlug);
    if (!validation.valid) {
      toast({ title: validation.error || 'Slug inválido', variant: 'destructive' });
      throw new Error('validation');
    }
    if (normalizedSlug !== establishment.slug && slugAvailable === false) {
      toast({ title: 'Este link já está em uso', variant: 'destructive' });
      throw new Error('validation');
    }
    try {
      const { error } = await supabase
        .from('establishments')
        .update({
          name: form.name,
          slug: normalizedSlug,
          description: form.description || null,
          phone: form.phone || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          instagram: form.instagram || null,
          booking_enabled: form.booking_enabled,
          auto_confirm_bookings: form.auto_confirm_bookings,
          reschedule_min_hours: parseInt(form.reschedule_min_hours) || 2,
          max_future_days: parseInt(form.max_future_days) || 30,
          slot_interval_minutes: parseInt(form.slot_interval_minutes) || 15,
          reminder_hours_before: parseInt(form.reminder_hours_before) || 0,
          buffer_minutes: parseInt(form.buffer_minutes) || 0,
        } as any)
        .eq('id', establishment.id);
      if (error) {
        if (error.code === '23505') {
          setSlugAvailable(false);
          setSlugError('Este link já está em uso');
          toast({ title: 'Este link já está em uso', variant: 'destructive' });
        } else {
          toast({ title: 'Erro ao salvar', description: error.message || 'Tente novamente', variant: 'destructive' });
        }
        throw error;
      }
      setSlug(normalizedSlug);
      queryClient.invalidateQueries({ queryKey: ['user-establishment'] });
      toast({ title: 'Configurações salvas!' });
    } catch (err: any) {
      if (err?.message !== 'validation') console.error('Erro ao salvar configurações:', err);
      throw err;
    }
  };

  const handleCopyLink = () => {
    if (!slug) return;
    const link = getPublicUrl(slug);
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Erro ao carregar configurações</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Estabelecimento não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do seu estabelecimento
        </p>
      </div>

      {/* ========== PUBLIC LINK ========== */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">Link Público</CardTitle>
          </div>
          <CardDescription>
            Personalize o link que seus clientes usarão para agendar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slug">Seu link personalizado</Label>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center">
                <span className="px-3 py-2 bg-muted rounded-l-md border border-r-0 text-sm text-muted-foreground whitespace-nowrap">
                  {PUBLIC_BASE_URL}/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="rounded-l-none"
                  placeholder="seu-negocio"
                />
              </div>
              <Button variant="outline" onClick={handleCopyLink} disabled={!slug}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {checkingSlug && <span className="text-muted-foreground">Verificando disponibilidade...</span>}
              {!checkingSlug && slugError && (
                <span className="text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />{slugError}</span>
              )}
              {!checkingSlug && !slugError && slugAvailable === true && (
                <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Link disponível!</span>
              )}
              {!checkingSlug && !slugError && slug === establishment?.slug && (
                <span className="text-muted-foreground">Link atual</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Use apenas letras minúsculas, números e hífens. Mínimo 3, máximo 40 caracteres.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ========== LOGO ========== */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">Logo</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              {logoUrl ? <AvatarImage src={logoUrl} alt="Logo" /> : null}
              <AvatarFallback className="text-2xl bg-muted">
                {form.name?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <ImageUploadButton
                  onImageCropped={handleLogoUpload}
                  currentImageUrl={logoUrl}
                  buttonText="Enviar Logo"
                  changeButtonText="Alterar Logo"
                  maxFileSizeMB={5}
                  cropTitle="Recortar Logo"
                  disabled={uploadingLogo}
                  isUploading={uploadingLogo}
                />
                {logoUrl && (
                  <Button type="button" variant="outline" onClick={handleRemoveLogo} disabled={uploadingLogo} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">JPG, PNG, GIF, WebP. Máximo 5MB.</p>
              {uploadingLogo && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Enviando logo e salvando no estabelecimento...
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========== BASIC INFO ========== */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">Informações do Estabelecimento</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Estabelecimento</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Breve descrição do seu negócio" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <PhoneInput id="phone" value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@seunegocio" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="São Paulo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="SP" maxLength={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========== BOOKING SETTINGS ========== */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <CalendarCog className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">Regras de Agendamento</CardTitle>
          </div>
          <CardDescription>
            Configure como o agendamento online funciona para seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Online booking toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="font-medium">Agendamento Online</Label>
              <p className="text-sm text-muted-foreground">
                Permitir que clientes agendem pelo link público
              </p>
            </div>
            <Switch
              checked={form.booking_enabled}
              onCheckedChange={(checked) => setForm({ ...form, booking_enabled: checked })}
            />
          </div>

          <Separator />

          {/* Auto confirm */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="font-medium">Confirmação Automática</Label>
              <p className="text-sm text-muted-foreground">
                {form.auto_confirm_bookings
                  ? 'Agendamentos são confirmados automaticamente ao serem criados'
                  : 'Agendamentos ficam pendentes até sua aprovação manual'}
              </p>
            </div>
            <Switch
              checked={form.auto_confirm_bookings}
              onCheckedChange={(checked) => setForm({ ...form, auto_confirm_bookings: checked })}
            />
          </div>

          <Separator />

          {/* Scheduling window & interval */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="future">Janela de agendamento</Label>
              <Select value={form.max_future_days} onValueChange={(v) => setForm({ ...form, max_future_days: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Clientes poderão agendar até {form.max_future_days} dias à frente
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval">Intervalo entre horários</Label>
              <Select value={form.slot_interval_minutes} onValueChange={(v) => setForm({ ...form, slot_interval_minutes: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutos</SelectItem>
                  <SelectItem value="10">10 minutos</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="20">20 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Espaço entre os horários disponíveis na agenda
              </p>
            </div>
          </div>

          <Separator />

          {/* Cancellation & buffer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reschedule">Antecedência mínima para cancelamento</Label>
              <Select value={form.reschedule_min_hours} onValueChange={(v) => setForm({ ...form, reschedule_min_hours: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem limite</SelectItem>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="3">3 horas</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="12">12 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="48">48 horas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tempo mínimo antes do agendamento para permitir cancelamento ou reagendamento
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buffer">Buffer entre agendamentos</Label>
              <Select value={form.buffer_minutes} onValueChange={(v) => setForm({ ...form, buffer_minutes: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem buffer</SelectItem>
                  <SelectItem value="5">5 minutos</SelectItem>
                  <SelectItem value="10">10 minutos</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tempo de folga entre um agendamento e o próximo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========== REMINDERS ========== */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">Lembretes</CardTitle>
          </div>
          <CardDescription>
            O cliente escolhe se deseja receber lembrete ao agendar. Aqui você define o valor padrão sugerido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Lembrete padrão por e-mail</Label>
            <Select value={form.reminder_hours_before} onValueChange={(v) => setForm({ ...form, reminder_hours_before: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Desativado</SelectItem>
                <SelectItem value="1">1 hora antes</SelectItem>
                <SelectItem value="2">2 horas antes</SelectItem>
                <SelectItem value="3">3 horas antes</SelectItem>
                <SelectItem value="6">6 horas antes</SelectItem>
                <SelectItem value="12">12 horas antes</SelectItem>
                <SelectItem value="24">24 horas antes</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Este valor é sugerido como padrão no formulário de agendamento. O cliente pode alterar antes de confirmar.
            </p>
          </div>
        </CardContent>
      </Card>

      <ActionButton
        onClick={handleSave}
        icon={<Save className="h-4 w-4" />}
        loadingLabel="Salvando..."
        successLabel="Configurações salvas!"
        className="w-full"
      >
        Salvar Configurações
      </ActionButton>
    </div>
  );
}
