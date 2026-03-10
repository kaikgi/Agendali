import { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, Check, Key } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset state when dialog opens or professional changes
  useEffect(() => {
    if (open) {
      setSlug(professional.slug || generateSlug(professional.name));
      setPortalEnabled(professional.portal_enabled ?? false);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setCopied(false);
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
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let generated = '';
    for (let i = 0; i < 8; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
  };

  const handleSave = async () => {
    if (!slug.trim()) {
      toast({ title: 'O slug é obrigatório', variant: 'destructive' });
      throw new Error('slug required');
    }

    if (password && password !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      throw new Error('password mismatch');
    }

    if (password && password.length < 4) {
      toast({ title: 'A senha deve ter pelo menos 4 caracteres', variant: 'destructive' });
      throw new Error('password too short');
    }

    try {
      // Update slug and portal_enabled
      await onUpdate({
        id: professional.id,
        slug: slug.trim(),
        portal_enabled: portalEnabled,
      });

      // Set password if provided
      if (password) {
        await setPasswordMutation.mutateAsync({
          professionalId: professional.id,
          password,
        });
      }

      toast({ title: 'Portal configurado com sucesso!' });
      
      // Close after brief delay so user sees success feedback
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
      throw error; // Re-throw so ActionButton shows error state
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

          {/* Password */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Senha de acesso</Label>
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
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite uma nova senha"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a senha"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Deixe em branco para manter a senha atual. Mínimo de 4 caracteres.
            </p>
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