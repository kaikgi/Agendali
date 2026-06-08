import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, History, CheckCircle2, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type LegalDocumentType = "terms_of_use" | "privacy_policy" | "cookie_policy" | "security";

interface LegalVersion {
  id: string;
  type: string;
  version: string;
  title: string;
  content: string;
  is_active: boolean;
  published_at: string | null;
  created_at: string;
}

const DOCUMENT_TYPES: { type: LegalDocumentType; label: string }[] = [
  { type: "terms_of_use", label: "Termos de Uso" },
  { type: "privacy_policy", label: "Política de Privacidade" },
  { type: "cookie_policy", label: "Política de Cookies" },
  { type: "security", label: "Segurança" },
];

export default function AdminLegalDocuments() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<LegalDocumentType>("terms_of_use");
  const [isNewVersionOpen, setIsNewVersionOpen] = useState(false);
  const [newVersion, setNewVersion] = useState({ version: "", title: "", content: "" });

  const { data: versions, isLoading } = useQuery({
    queryKey: ["legal-versions", selectedType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_document_versions")
        .select("*")
        .eq("type", selectedType)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LegalVersion[];
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: async (vars: typeof newVersion) => {
      const { error } = await supabase.from("legal_document_versions").insert({
        type: selectedType,
        version: vars.version,
        title: vars.title,
        content: vars.content,
        is_active: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-versions"] });
      toast.success("Nova versão criada como rascunho!");
      setIsNewVersionOpen(false);
      setNewVersion({ version: "", title: "", content: "" });
    },
    onError: (error) => {
      toast.error(`Erro ao criar versão: ${error.message}`);
    },
  });

  const activateVersionMutation = useMutation({
    mutationFn: async (id: string) => {
      // Primeiro, desativa todas as outras do mesmo tipo
      const { error: deactivateError } = await supabase
        .from("legal_document_versions")
        .update({ is_active: false })
        .eq("type", selectedType);

      if (deactivateError) throw deactivateError;

      // Ativa a nova
      const { error: activateError } = await supabase
        .from("legal_document_versions")
        .update({ is_active: true, published_at: new Date().toISOString() })
        .eq("id", id);

      if (activateError) throw activateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-versions"] });
      toast.success("Versão ativada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao ativar versão: ${error.message}`);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersion.version || !newVersion.title || !newVersion.content) {
      toast.error("Preencha todos os campos");
      return;
    }
    createVersionMutation.mutate(newVersion);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentos Legais</h1>
          <p className="text-muted-foreground">
            Gerencie versões dos termos de uso, privacidade e cookies.
          </p>
        </div>
        <Dialog open={isNewVersionOpen} onOpenChange={setIsNewVersionOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Nova Versão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Versão - {DOCUMENT_TYPES.find(d => d.type === selectedType)?.label}</DialogTitle>
              <DialogDescription>
                A nova versão será salva como rascunho e poderá ser ativada posteriormente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="version">Versão (ex: 2.0)</Label>
                  <Input 
                    id="version" 
                    value={newVersion.version} 
                    onChange={e => setNewVersion(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="1.1" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Título do Documento</Label>
                  <Input 
                    id="title" 
                    value={newVersion.title} 
                    onChange={e => setNewVersion(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Termos de Uso - Junho 2026" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Conteúdo (Markdown/HTML suportado)</Label>
                <Textarea 
                  id="content" 
                  className="min-h-[300px]" 
                  value={newVersion.content} 
                  onChange={e => setNewVersion(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Conteúdo completo do documento..." 
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsNewVersionOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createVersionMutation.isPending}>
                  {createVersionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar Rascunho
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="terms_of_use" onValueChange={(val) => setSelectedType(val as LegalDocumentType)}>
        <TabsList className="grid w-full grid-cols-4">
          {DOCUMENT_TYPES.map(doc => (
            <TabsTrigger key={doc.type} value={doc.type}>{doc.label}</TabsTrigger>
          ))}
        </TabsList>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Histórico de Versões
            </CardTitle>
            <CardDescription>
              Acompanhe as versões publicadas e gerencie qual está ativa atualmente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead w-24>Versão</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Publicado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions?.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono font-medium">{v.version}</TableCell>
                      <TableCell>{v.title}</TableCell>
                      <TableCell>
                        {v.published_at ? format(new Date(v.published_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Não publicado"}
                      </TableCell>
                      <TableCell>
                        {v.is_active ? (
                          <Badge className="bg-green-500 hover:bg-green-600 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Ativa
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inativa</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!v.is_active && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => {
                              if (confirm("Tem certeza que deseja ativar esta versão? Isso desativará a versão atual.")) {
                                activateVersionMutation.mutate(v.id);
                              }
                            }}
                            disabled={activateVersionMutation.isPending}
                          >
                            Ativar Agora
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="ml-2" onClick={() => {
                          // TODO: Implementar visualização
                          toast.info("Funcionalidade de visualização em breve");
                        }}>
                          Visualizar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {versions?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma versão encontrada para este documento.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Tabs>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold">Importante</p>
          <p>Ao ativar uma nova versão, todos os usuários ativos na plataforma poderão ser notificados para aceitar os novos termos no próximo acesso, conforme as configurações de compliance do sistema.</p>
        </div>
      </div>
    </div>
  );
}
