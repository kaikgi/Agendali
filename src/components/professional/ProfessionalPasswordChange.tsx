import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Lock, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength, isPasswordStrong } from '@/components/ui/password-strength';
import { ActionButton } from '@/components/ui/action-button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProfessionalPasswordChangeProps {
  token: string;
}

export function ProfessionalPasswordChange({ token }: ProfessionalPasswordChangeProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)('professional_change_password', {
        p_token: token,
        p_current_password: currentPassword,
        p_new_password: newPassword,
      });
      if (error) throw error;
      const result = data as { success: boolean; message?: string; error?: string };
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  const handleSave = async () => {
    if (!currentPassword) {
      toast({ title: 'Digite a senha atual', variant: 'destructive' });
      throw new Error('validation');
    }
    if (!newPassword) {
      toast({ title: 'Digite a nova senha', variant: 'destructive' });
      throw new Error('validation');
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      throw new Error('validation');
    }
    if (!isPasswordStrong(newPassword)) {
      toast({ title: 'A senha deve conter maiúscula, minúscula, número e caractere especial (mín. 8)', variant: 'destructive' });
      throw new Error('validation');
    }

    try {
      await mutation.mutateAsync();
      toast({ title: 'Senha alterada com sucesso!' });
    } catch (err: any) {
      if (err?.message !== 'validation') {
        toast({ title: 'Erro ao alterar senha', description: err?.message, variant: 'destructive' });
      }
      throw err;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" />
          Alterar Senha
        </CardTitle>
        <CardDescription>
          Altere sua senha de acesso ao portal
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-pwd">Senha atual</Label>
          <PasswordInput
            id="current-pwd"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Digite a senha atual"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-pwd">Nova senha</Label>
          <PasswordInput
            id="new-pwd"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Digite a nova senha"
          />
          {newPassword && <PasswordStrength password={newPassword} />}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-pwd">Confirmar nova senha</Label>
          <PasswordInput
            id="confirm-pwd"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirme a nova senha"
          />
        </div>

        <ActionButton onClick={handleSave} loadingLabel="Salvando..." successLabel="Senha alterada!">
          <ShieldCheck className="h-4 w-4 mr-2" />
          Alterar Senha
        </ActionButton>
      </CardContent>
    </Card>
  );
}
