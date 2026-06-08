import { useState } from 'react';
import { Tag, Check, X, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useClientTags,
  useCustomerTags,
  useAssignTag,
  useRemoveTag,
} from '@/hooks/useClientTags';

interface CustomerTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  establishmentId: string;
}

export function CustomerTagsDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  establishmentId,
}: CustomerTagsDialogProps) {
  const { data: allTags = [], isLoading: tagsLoading } = useClientTags(establishmentId);
  const { data: customerTags = [], isLoading: assignmentsLoading } = useCustomerTags(customerId, establishmentId);
  const assignTag = useAssignTag(establishmentId);
  const removeTag = useRemoveTag(establishmentId);
  const [processingTagId, setProcessingTagId] = useState<string | null>(null);

  const activeTags = allTags.filter((t) => t.is_active);
  const assignedTagIds = new Set(customerTags.map((ct) => ct.tag_id));

  const handleToggle = async (tagId: string) => {
    setProcessingTagId(tagId);
    try {
      if (assignedTagIds.has(tagId)) {
        await removeTag.mutateAsync({ customerId, tagId });
        toast.success('Tag removida');
      } else {
        await assignTag.mutateAsync({ customerId, tagId });
        toast.success('Tag aplicada');
      }
    } catch {
      toast.error('Erro ao atualizar tag');
    } finally {
      setProcessingTagId(null);
    }
  };

  const isLoading = tagsLoading || assignmentsLoading;

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
        ) : activeTags.length === 0 ? (
          <div className="text-center py-6">
            <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma tag disponível</p>
            <p className="text-xs text-muted-foreground mt-1">Crie tags em Gerenciar Tags</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {activeTags.map((tag) => {
              const isAssigned = assignedTagIds.has(tag.id);
              const isProcessing = processingTagId === tag.id;
              return (
                <button
                  key={tag.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    isAssigned
                      ? 'border-foreground/20 bg-accent/50'
                      : 'border-border hover:bg-accent/30'
                  }`}
                  onClick={() => handleToggle(tag.id)}
                  disabled={isProcessing}
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
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
