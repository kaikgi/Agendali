import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Camera, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useProfessionalProfileUpdate } from '@/hooks/useProfessionalProfile';
import { supabase } from '@/integrations/supabase/client';
import { ProfessionalPasswordChange } from './ProfessionalPasswordChange';

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfessionalProfileSectionProps {
  token: string;
  session: {
    professional_id: string;
    professional_name: string;
    establishment_name: string;
  };
  currentPhotoUrl?: string | null;
  onProfileUpdated?: () => void;
}

export function ProfessionalProfileSection({
  token,
  session,
  currentPhotoUrl,
  onProfileUpdated,
}: ProfessionalProfileSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const updateMutation = useProfessionalProfileUpdate(token);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: session.professional_name,
    },
  });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'A foto deve ter no máximo 2MB' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Tipo inválido', description: 'Selecione uma imagem válida (JPG, PNG, GIF ou WebP)' });
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.professional_id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(`professional-photos/${fileName}`, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(`professional-photos/${fileName}`);

      await updateMutation.mutateAsync({ photoUrl: publicUrl });

      toast({ title: 'Foto atualizada!' });
      onProfileUpdated?.();
    } catch (error) {
      console.error('Photo upload error:', error);
      toast({ variant: 'destructive', title: 'Erro ao enviar foto', description: error instanceof Error ? error.message : 'Tente novamente' });
      setPhotoPreview(null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveName = async () => {
    // Trigger form validation manually
    const isValid = await new Promise<boolean>((resolve) => {
      handleSubmit(
        async (data) => {
          try {
            await updateMutation.mutateAsync({ name: data.name });
            toast({ title: 'Perfil atualizado!' });
            setIsEditing(false);
            onProfileUpdated?.();
            resolve(true);
          } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao salvar', description: error instanceof Error ? error.message : 'Tente novamente' });
            throw error;
          }
        },
        () => {
          toast({ title: 'Verifique os campos', variant: 'destructive' });
          resolve(false);
        }
      )();
    });
    if (!isValid) throw new Error('validation');
  };

  const handleCancel = () => {
    reset({ name: session.professional_name });
    setIsEditing(false);
  };

  const displayPhotoUrl = photoPreview || currentPhotoUrl;
  const initials = session.professional_name.charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Meu Perfil
          </CardTitle>
          <CardDescription>Gerencie suas informações pessoais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Photo Section */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                {displayPhotoUrl && <AvatarImage src={displayPhotoUrl} alt={session.professional_name} />}
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>

              {isUploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute -bottom-1 -right-1 p-1.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>

              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg">{session.professional_name}</p>
              <p className="text-sm text-muted-foreground">{session.establishment_name}</p>
            </div>

            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Editar nome
              </Button>
            )}
          </div>

          {/* Edit Form */}
          {isEditing && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" placeholder="Seu nome" {...register('name')} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleCancel} disabled={updateMutation.isPending}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <ActionButton
                    onClick={handleSaveName}
                    loadingLabel="Salvando..."
                    successLabel="Salvo!"
                    disabled={!isDirty}
                  >
                    Salvar Nome
                  </ActionButton>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Password Change */}
      <ProfessionalPasswordChange token={token} />
    </div>
  );
}
