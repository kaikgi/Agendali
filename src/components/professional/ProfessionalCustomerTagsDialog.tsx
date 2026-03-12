import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Check, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProfessionalCustomerTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  customerId: string;
  customerName: string;
}

export function ProfessionalCustomerTagsDialog({
  open, onOpenChange, token, customerId, customerName,
}: ProfessionalCustomerTagsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingTagId, setProcessingTagId] = useState<string | null>(null);

  const { data: tagsData, isLoading: tagsLoading } = useQuery({
    queryKey: ['professional-client-tags', token],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_professional_client_tags', { p_token: token });
      if (error) throw error;
      return data as { success: boolean; tags: Array<{ id: string; name: string; color: string }> };
    },
    enabled: !!token && open,
  });

  const { data: customerTagsData, isLoading: customerTagsLoading } = useQuery({
    queryKey: ['professional-customer-tags', token, customerId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_professional_customer_tags', {
        p_token: token,
        p_customer_id: customerId,
      });
      if (error) throw error;
      return data as { success: boolean; tags: Array<{ tag_id: string; tag_name: string; tag_color: string }> };
    },
    enabled: !!token && !!customerId && open,
  });

  const toggleMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { data, error } = await (supabase.rpc as any)('professional_toggle_customer_tag', {
        p_token: token,
        p_customer_id: customerId,
        p_tag_id: tagId,
      });
      if (error) throw error;
      const result = data as { success: boolean; action?: string; error?: string };
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['professional-customer-tags', token, customerId] });
      toast({ title: result.action === 'added' ? 'Tag aplicada' : 'Tag removida' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
    },
  });

  const handleToggle = async (tagId: string) => {
    setProcessingTagId(tagId);
    try {
      await toggleMutation.mutateAsync(tagId);
    } finally {
      setProcessingTagId(null);
    }
  };

  const allTags = tagsData?.tags || [];
  const assignedTagIds = new Set((customerTagsData?.tags || []).map((t) => t.tag_id));
  const isLoading = tagsLoading || customerTagsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tags de {customerName}
          </DialogTitle>
          <DialogDescription>
            Selecione as tags para este cliente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : allTags.length === 0 ? (
          <div className="text-center py-6">
            <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma tag disponível</p>
            <p className="text-xs text-muted-foreground mt-1">Tags são criadas pelo estabelecimento</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {allTags.map((tag) => {
              const isAssigned = assignedTagIds.has(tag.id);
              const isProcessing = processingTagId === tag.id;
              return (
                <button
                  key={tag.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    isAssigned ? 'border-foreground/20 bg-accent/50' : 'border-border hover:bg-accent/30'
                  }`}
                  onClick={() => handleToggle(tag.id)}
                  disabled={isProcessing}
                >
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 text-sm font-medium">{tag.name}</span>
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : isAssigned ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
