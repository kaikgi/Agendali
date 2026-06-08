import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  Save,
  User,
  Shield,
  LogOut,
  Star,
  KeyRound,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useClientAppointments } from '@/hooks/useClientAppointments';
import { supabase } from '@/integrations/supabase/client';
import { ImageUploadButton } from '@/components/ImageUploadButton';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { PhoneInput } from '@/components/ui/phone-input';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~';]).{8,}$/,
        'Deve conter maiúscula, minúscula, número e caractere especial'
      ),
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ClientProfile() {
  const { user, signOut } = useAuth();
  const { profile, isLoading, updateProfile, isUpdating } = useProfile();
  const { data: appointments = [] } = useClientAppointments();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
    },
  });

  const {
    register: registerPw,
    handleSubmit: handleSubmitPw,
    reset: resetPw,
    watch: watchPw,
    formState: { errors: pwErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const newPassword = watchPw('password', '');

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile(data);
      toast({ title: 'Perfil atualizado com sucesso!' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar perfil',
        description: 'Tente novamente mais tarde',
      });
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw error;
      toast({ title: 'Senha alterada com sucesso!' });
      setIsChangingPassword(false);
      resetPw();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar senha',
        description: 'Tente novamente mais tarde',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarUpload = async (croppedBlob: Blob) => {
    if (!user?.id) {
      console.error('[avatar-upload] Upload cancelado: usuário não autenticado');
      toast({ variant: 'destructive', title: 'Faça login para alterar a foto' });
      return;
    }

    console.log('[avatar-upload] Iniciando upload', {
      userId: user.id,
      blobSize: croppedBlob.size,
      blobType: croppedBlob.type,
    });

    setIsUploadingAvatar(true);
    try {
      const bucket = 'uploads';
      const filePath = `avatars/${user.id}/avatar.jpg`;
      console.log('[avatar-upload] Upload para storage', { bucket, filePath });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg', cacheControl: '0' });

      console.log('[avatar-upload] Retorno do storage', { uploadData, uploadError });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;
      console.log('[avatar-upload] URL final', { avatar_url });

      await updateProfile({ avatar_url });
      console.log('[avatar-upload] Perfil atualizado no banco');
      toast({ title: 'Foto atualizada!' });
    } catch (err: any) {
      console.error('[avatar-upload] Erro no fluxo', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar foto',
        description: err?.message || 'Tente novamente mais tarde.',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  // Stats
  const completedAppointments = appointments.filter((a) => a.status === 'completed');
  const favoriteEstablishment = (() => {
    const counts = new Map<string, { name: string; count: number }>();
    completedAppointments.forEach((a) => {
      const prev = counts.get(a.establishment.id);
      counts.set(a.establishment.id, {
        name: a.establishment.name,
        count: (prev?.count || 0) + 1,
      });
    });
    let best: { name: string; count: number } | null = null;
    counts.forEach((v) => {
      if (!best || v.count > best.count) best = v;
    });
    return best;
  })();

  const favoriteProfessional = (() => {
    const counts = new Map<string, { name: string; count: number }>();
    completedAppointments.forEach((a) => {
      const prev = counts.get(a.professional.id);
      counts.set(a.professional.id, {
        name: a.professional.name,
        count: (prev?.count || 0) + 1,
      });
    });
    let best: { name: string; count: number } | null = null;
    counts.forEach((v) => {
      if (!best || v.count > best.count) best = v;
    });
    return best;
  })();

  const favoriteService = (() => {
    const counts = new Map<string, { name: string; count: number }>();
    completedAppointments.forEach((a) => {
      const prev = counts.get(a.service.id);
      counts.set(a.service.id, {
        name: a.service.name,
        count: (prev?.count || 0) + 1,
      });
    });
    let best: { name: string; count: number } | null = null;
    counts.forEach((v) => {
      if (!best || v.count > best.count) best = v;
    });
    return best;
  })();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'Cliente';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas informações pessoais e preferências
        </p>
      </div>

      {/* Avatar + Name */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20 ring-2 ring-border">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={displayName} />
                )}
                <AvatarFallback className="text-2xl font-semibold bg-muted">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">{displayName}</h2>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <div className="mt-2">
                <ImageUploadButton
                  onImageCropped={handleAvatarUpload}
                  currentImageUrl={profile?.avatar_url}
                  buttonText="Adicionar foto"
                  changeButtonText="Alterar foto"
                  isUploading={isUploadingAvatar}
                  cropTitle="Recortar foto de perfil"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Data */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Dados Pessoais
          </CardTitle>
          <CardDescription>
            Atualize seus dados para melhorar sua experiência
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input
                  id="full_name"
                  placeholder="Seu nome completo"
                  {...register('full_name')}
                />
                {errors.full_name && (
                  <p className="text-xs text-destructive">{errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <PhoneInput
                  id="phone"
                  placeholder="(11) 99999-9999"
                  value={profile?.phone || ''}
                  onChange={(val) => setValue('phone', val, { shouldDirty: true })}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled />
              <p className="text-[11px] text-muted-foreground">
                O email não pode ser alterado
              </p>
            </div>

            <ActionButton
              type="submit"
              disabled={!isDirty}
              loading={isUpdating}
              icon={<Save className="h-4 w-4" />}
              loadingLabel="Salvando..."
              successLabel="Salvo!"
              size="sm"
            >
              Salvar Alterações
            </ActionButton>
          </form>
        </CardContent>
      </Card>

      {/* Stats */}
      {completedAppointments.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" />
              Seus Favoritos
            </CardTitle>
            <CardDescription>
              Baseado nos seus agendamentos concluídos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {favoriteEstablishment && (
                <div className="rounded-xl bg-muted/50 p-4 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Estabelecimento favorito
                  </p>
                  <p className="text-sm font-semibold truncate">
                    {favoriteEstablishment.name}
                  </p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {favoriteEstablishment.count} visita{favoriteEstablishment.count > 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
              {favoriteProfessional && (
                <div className="rounded-xl bg-muted/50 p-4 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Profissional favorito
                  </p>
                  <p className="text-sm font-semibold truncate">
                    {favoriteProfessional.name}
                  </p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {favoriteProfessional.count} atendimento{favoriteProfessional.count > 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
              {favoriteService && (
                <div className="rounded-xl bg-muted/50 p-4 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Serviço mais agendado
                  </p>
                  <p className="text-sm font-semibold truncate">
                    {favoriteService.name}
                  </p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {favoriteService.count}x agendado
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Segurança
          </CardTitle>
          <CardDescription>Gerencie sua senha e acesso à conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isChangingPassword ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChangingPassword(true)}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Alterar senha
            </Button>
          ) : (
            <form
              onSubmit={handleSubmitPw(onPasswordSubmit)}
              className="space-y-4 max-w-sm"
            >
              <div className="space-y-2">
                <Label>Nova senha</Label>
                <PasswordInput
                  placeholder="Mínimo 8 caracteres"
                  {...registerPw('password')}
                />
                {newPassword && <PasswordStrength password={newPassword} />}
                {pwErrors.password && (
                  <p className="text-xs text-destructive">
                    {pwErrors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Confirmar nova senha</Label>
                <PasswordInput
                  placeholder="Repita a senha"
                  {...registerPw('confirmPassword')}
                />
                {pwErrors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {pwErrors.confirmPassword.message}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <ActionButton type="submit" size="sm" loading={savingPassword} loadingLabel="Salvando..." successLabel="Senha alterada!">
                  Salvar nova senha
                </ActionButton>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsChangingPassword(false);
                    resetPw();
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          <Separator />

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
