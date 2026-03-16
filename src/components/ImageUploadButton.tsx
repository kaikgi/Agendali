import { useRef, useState } from 'react';
import { Upload, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ImageCropDialog } from '@/components/ImageCropDialog';

interface ImageUploadButtonProps {
  onImageCropped: (croppedBlob: Blob) => Promise<void> | void;
  currentImageUrl?: string | null;
  buttonText?: string;
  changeButtonText?: string;
  maxFileSizeMB?: number;
  cropTitle?: string;
  disabled?: boolean;
  isUploading?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageUploadButton({
  onImageCropped,
  currentImageUrl,
  buttonText = 'Adicionar Foto',
  changeButtonText = 'Alterar',
  maxFileSizeMB = 5,
  cropTitle = 'Recortar Imagem',
  disabled = false,
  isUploading = false,
}: ImageUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset state
    setError(null);
    setSelectedFile(null);
    setPreviewUrl(null);

    // Validate file type - only safe image formats
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Selecione um arquivo de imagem válido (JPG, PNG, GIF ou WebP)');
      setPreviewDialogOpen(true);
      return;
    }

    // Validate file size
    if (file.size > maxFileSizeBytes) {
      setError(`A imagem deve ter no máximo ${maxFileSizeMB}MB. O arquivo selecionado tem ${formatFileSize(file.size)}.`);
      setPreviewDialogOpen(true);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
      setSelectedFile(file);
      setPreviewDialogOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProceedToCrop = () => {
    setPreviewDialogOpen(false);
    setCropDialogOpen(true);
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    setCropDialogOpen(false);
    setPreviewUrl(null);
    setSelectedFile(null);
    onImageCropped(croppedBlob);
  };

  const handleClosePreview = () => {
    setPreviewDialogOpen(false);
    setError(null);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleCloseCrop = () => {
    setCropDialogOpen(false);
    setPreviewUrl(null);
    setSelectedFile(null);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {currentImageUrl ? changeButtonText : buttonText}
      </Button>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={(open) => !open && handleClosePreview()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {error ? 'Erro no arquivo' : 'Confirmar imagem'}
            </DialogTitle>
            {!error && selectedFile && (
              <DialogDescription>
                {selectedFile.name} • {formatFileSize(selectedFile.size)}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="py-4">
            {error ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-sm text-destructive">{error}</p>
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: JPG, PNG, GIF, WebP. Tamanho máximo: {maxFileSizeMB}MB.
                </p>
              </div>
            ) : previewUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-full aspect-square max-w-[200px] mx-auto rounded-lg overflow-hidden bg-muted">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Clique em "Continuar" para ajustar o recorte da imagem.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Carregando preview...</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleClosePreview}>
              {error ? 'Fechar' : 'Cancelar'}
            </Button>
            {!error && previewUrl && (
              <Button onClick={handleProceedToCrop}>
                Continuar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crop Dialog */}
      {previewUrl && (
        <ImageCropDialog
          open={cropDialogOpen}
          onClose={handleCloseCrop}
          imageSrc={previewUrl}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          title={cropTitle}
        />
      )}
    </>
  );
}
