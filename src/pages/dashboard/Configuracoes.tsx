import { useState, useEffect, useCallback } from 'react';
import { Save, Copy, Check, RefreshCw, AlertCircle, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ImageUploadButton } from '@/components/ImageUploadButton';
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
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove invalid chars
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
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
  
  // Logo upload state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Slug state
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
    reschedule_min_hours: '',
    max_future_days: '',
    slot_interval_minutes: '',
    reminder_hours_before: '',
  });

  // Initialize form when establishment loads
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
      });
    }
  }, [establishment]);

  // Handle logo upload from ImageUploadButton
  const handleLogoUpload = async (croppedBlob: Blob) => {
    if (!establishment) return;

    setUploadingLogo(true);

    try {
      const filePath = `logos/${establishment.id}/logo.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, croppedBlob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('establishments')
        .update({ logo_url: urlWithCacheBuster })
        .eq('id', establishment.id);

      if (updateError) throw updateError;

      setLogoUrl(urlWithCacheBuster);
      queryClient.invalidateQueries({ queryKey: ['user-establishment'] });
      toast({ title: 'Logo atualizado!' });
    } catch (err: any) {
      toast({ 
        title: 'Erro ao enviar logo', 
        description: err?.message || 'Tente novamente',
        variant: 'destructive' 
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle logo removal
  const handleRemoveLogo = async () => {
    if (!establishment || !logoUrl) return;

    setUploadingLogo(true);

    try {
      // Extract file path from URL
      const urlParts = logoUrl.split('/uploads/');
      if (urlParts.length > 1) {
        const rawPath = urlParts[1].split('?')[0];
        await supabase.storage
          .from('uploads')
          .remove([rawPath]);
      }

      // Update establishment to remove logo URL
      const { error } = await supabase
        .from('establishments')
        .update({ logo_url: null })
        .eq('id', establishment.id);

      if (error) throw error;

      setLogoUrl(null);
      queryClient.invalidateQueries({ queryKey: ['user-establishment'] });
      toast({ title: 'Logo removido!' });
    } catch (err: any) {
      toast({ 
        title: 'Erro ao remover logo', 
        description: err?.message || 'Tente novamente',
        variant: 'destructive' 
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Check slug availability with debounce using RPC
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
    } catch (err) {
      setSlugError('Erro ao verificar disponibilidade');
      setSlugAvailable(null);
    } finally {
      setCheckingSlug(false);
    }
  }, [establishment]);

  // Debounced slug check
  useEffect(() => {
    if (!slug || !establishment) return;
    
    const timer = setTimeout(() => {
      checkSlugAvailability(slug);
    }, 500);

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
    if (!establishment) return;

    const normalizedSlug = normalizeSlug(slug);

    // Validate slug before saving
    const validation = validateSlug(normalizedSlug);
    if (!validation.valid) {
      toast({ title: validation.error || 'Slug inválido', variant: 'destructive' });
      return;
    }

    // Check if slug changed and is not available
    if (normalizedSlug !== establishment.slug && slugAvailable === false) {
      toast({ title: 'Este link já está em uso', variant: 'destructive' });
      return;
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
        } as any)
        .eq('id', establishment.id);

      if (error) {
        if (error.code === '23505') {
          setSlugAvailable(false);
          setSlugError('Este link já está em uso');
          toast({ title: 'Este link já está em uso', variant: 'destructive' });
        } else {
          throw error;
        }
        return;
      }

      setSlug(normalizedSlug);
      queryClient.invalidateQueries({ queryKey: ['user-establishment'] });
      toast({ title: 'Configurações salvas!' });
    } catch (err: any) {
      toast({ 
        title: 'Erro ao salvar', 
        description: err?.message || 'Tente novamente',
        variant: 'destructive' 
      });
    }
  };

  // Use single source of truth for public link
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

      {/* Public Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Link Público</CardTitle>
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
            
            {/* Slug status indicator */}
            <div className="flex items-center gap-2 text-sm">
              {checkingSlug && (
                <span className="text-muted-foreground">Verificando disponibilidade...</span>
              )}
              {!checkingSlug && slugError && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {slugError}
                </span>
              )}
              {!checkingSlug && !slugError && slugAvailable === true && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Link disponível!
                </span>
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

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Logo do Estabelecimento</CardTitle>
          <CardDescription>
            Adicione uma logo para personalizar sua página de agendamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              {logoUrl ? (
                <AvatarImage src={logoUrl} alt="Logo" />
              ) : null}
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, GIF, WebP. Tamanho máximo: 5MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Estabelecimento</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Breve descrição do seu negócio"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <PhoneInput
                id="phone"
                value={form.phone}
                onChange={(val) => setForm({ ...form, phone: val })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={form.instagram}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                placeholder="@seunegocio"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Rua, número, bairro"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="São Paulo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações de Agendamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Agendamento Online</Label>
              <p className="text-sm text-muted-foreground">
                Permitir que clientes agendem pelo link público
              </p>
            </div>
            <Switch
              checked={form.booking_enabled}
              onCheckedChange={(checked) => setForm({ ...form, booking_enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Confirmação Automática</Label>
              <p className="text-sm text-muted-foreground">
                Confirmar agendamentos automaticamente
              </p>
            </div>
            <Switch
              checked={form.auto_confirm_bookings}
              onCheckedChange={(checked) => setForm({ ...form, auto_confirm_bookings: checked })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reschedule">Antecedência mínima (horas)</Label>
              <Input
                id="reschedule"
                type="number"
                min="0"
                value={form.reschedule_min_hours}
                onChange={(e) => setForm({ ...form, reschedule_min_hours: e.target.value })}
                onFocus={(e) => e.target.select()}
                placeholder="2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="future">Janela máxima de agendamento</Label>
              <select
                id="future"
                value={form.max_future_days}
                onChange={(e) => setForm({ ...form, max_future_days: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="7">7 dias (padrão)</option>
                <option value="14">14 dias</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias</option>
                <option value="60">60 dias</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Se definido como {form.max_future_days || 7} dias, os clientes só poderão agendar até {form.max_future_days || 7} dias à frente a partir do momento atual.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interval">Intervalo de horários (minutos)</Label>
              <Input
                id="interval"
                type="number"
                min="5"
                step="5"
                value={form.slot_interval_minutes}
                onChange={(e) => setForm({ ...form, slot_interval_minutes: e.target.value })}
                onFocus={(e) => e.target.select()}
                placeholder="15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder">Lembrete por e-mail (horas antes)</Label>
              <Input
                id="reminder"
                type="number"
                min="0"
                value={form.reminder_hours_before}
                onChange={(e) => setForm({ ...form, reminder_hours_before: e.target.value })}
                onFocus={(e) => e.target.select()}
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground">
                0 = desativado
              </p>
            </div>
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
