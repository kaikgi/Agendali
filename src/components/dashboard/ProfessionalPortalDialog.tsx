import { useState, useEffect } from 'react';
import { Copy, Check, Key, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength, isPasswordStrong } from '@/components/ui/password-strength';
import { useSetProfessionalPassword } from '@/hooks/useProfessionalPortal';
import { useToast } from '@/hooks/use-toast';
import { getProfessionalPortalUrl } from '@/lib/publicUrl';

interface ProfessionalPortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: {
    id: string;
    name: string;
    slug: string | null;
    portal_enabled: boolean | null;
    portal_password_hash: string | null;
  };
  establishmentSlug: string;
  onUpdate: (data: { id: string; slug?: string; portal_enabled?: boolean }) => Promise<void>;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ProfessionalPortalDialog({
  open,
  onOpenChange,
  professional,
  establishmentSlug,
  onUpdate,
}: ProfessionalPortalDialogProps) {
  const { toast } = useToast();
  const setPasswordMutation = useSetProfessionalPassword();
  
  const [slug, setSlug] = useState(professional.slug || generateSlug(professional.name));
  const [portalEnabled, setPortalEnabled] = useState(professional.portal_enabled ?? false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [wantsChangePassword, setWantsChangePassword] = useState(false);

  const hasExistingPassword = !!professional.portal_password_hash;

  // Reset state when dialog opens or professional changes
  useEffect(() => {
    if (open) {
      setSlug(professional.slug || generateSlug(professional.name));
      setPortalEnabled(professional.portal_enabled ?? false);
      setPassword('');
      setConfirmPassword('');
      setCopied(false);
      setWantsChangePassword(false);
    }
  }, [open, professional.id]);

  const portalUrl = getProfessionalPortalUrl(establishmentSlug, slug);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Link copiado!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleGeneratePassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '!@#$%&*';
    const all = upper + lower + digits + special;
    // Guarantee at least one of each
    let generated = upper[Math.floor(Math.random() * upper.length)]
      + lower[Math.floor(Math.random() * lower.length)]
      + digits[Math.floor(Math.random() * digits.length)]
      + special[Math.floor(Math.random() * special.length)];
    for (let i = 4; i < 10; i++) {
      generated += all[Math.floor(Math.random() * all.length)];
    }
    // Shuffle
    generated = generated.split('').sort(() => Math.random() - 0.5).join('');
    setPassword(generated);
    setConfirmPassword(generated);
    setWantsChangePassword(true);
  };

  const handleSave = async () => {
    if (!slug.trim()) {
      toast({ title: 'O slug é obrigatório', variant: 'destructive' });
      throw new Error('slug required');
    }

    // Only validate password if user is actively setting one
    const isSettingPassword = wantsChangePassword && password.length > 0;

    if (isSettingPassword && password !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      throw new Error('password mismatch');
    }

    if (isSettingPassword && !isPasswordStrong(password)) {
      toast({ title: 'A senha deve conter maiúscula, minúscula, número e caractere especial (mín. 8 caracteres)', variant: 'destructive' });
      throw new Error('password too weak');
    }

    // First-time setup: password is required if no existing password
    if (portalEnabled && !hasExistingPassword && !isSettingPassword) {
      toast({ title: 'Defina uma senha para ativar o portal', variant: 'destructive' });
      setWantsChangePassword(true);
      throw new Error('password required');
    }

    try {
      // Update slug and portal_enabled (never touches password)
      await onUpdate({
        id: professional.id,
        slug: slug.trim(),
        portal_enabled: portalEnabled,
      });

      // Only set password if user explicitly changed it
      if (isSettingPassword) {
        await setPasswordMutation.mutateAsync({
          professionalId: professional.id,
          password,
        });
      }

      toast({ title: 'Portal configurado com sucesso!' });
      
      setTimeout(() => onOpenChange(false), 1200);
    } catch (error: any) {
      const msg = error?.message || '';
      const isSlugConflict = error?.code === '23505' || msg.includes('idx_professionals_slug_unique');
      toast({
        title: isSlugConflict ? 'Slug já em uso' : 'Erro ao salvar',
        description: isSlugConflict
          ? 'Esse identificador já está sendo usado por outro profissional. Escolha outro.'
          : msg,
        variant: 'destructive',
      });
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Portal do Profissional
          </DialogTitle>
          <DialogDescription>
            Configure o acesso individual à agenda de {professional.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="portal-enabled">Portal ativo</Label>
              <p className="text-sm text-muted-foreground">
                Permitir que o profissional acesse sua agenda
              </p>
            </div>
            <Switch
              id="portal-enabled"
              checked={portalEnabled}
              onCheckedChange={setPortalEnabled}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">Identificador (slug)</Label>
            <div className="flex gap-2">
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="nome-do-profissional"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setSlug(generateSlug(professional.name))}
              >
                Gerar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Usado na URL de acesso ao portal
            </p>
          </div>

          {/* Portal URL */}
          <div className="space-y-2">
            <Label>Link de acesso</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={portalUrl}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyUrl}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Password Section */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Senha de acesso</Label>
              {hasExistingPassword && !wantsChangePassword && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Senha configurada</span>
                </div>
              )}
            </div>

            {hasExistingPassword && !wantsChangePassword ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  A senha atual está ativa. Você pode alterar slug ou status sem precisar redefinir.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWantsChangePassword(true)}
                >
                  Alterar senha
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">
                    {hasExistingPassword ? 'Nova senha' : 'Definir senha'}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGeneratePassword}
                  >
                    Gerar senha
                  </Button>
                </div>

                <div className="space-y-2">
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={hasExistingPassword ? 'Digite a nova senha' : 'Digite uma senha'}
                    autoFocus={!hasExistingPassword}
                  />
                  {password && <PasswordStrength password={password} />}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <PasswordInput
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a senha"
                  />
                </div>

                {hasExistingPassword && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setWantsChangePassword(false);
                      setPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    Cancelar alteração de senha
                  </Button>
                )}

                <p className="text-xs text-muted-foreground">
                  {hasExistingPassword
                    ? 'Preencha apenas se quiser alterar a senha atual.'
                    : 'O profissional usará esta senha para acessar o portal.'}
                </p>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <ActionButton onClick={handleSave} loadingLabel="Salvando..." successLabel="Salvo!">
            Salvar
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
