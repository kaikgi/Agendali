import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2 } from "lucide-react";

const SolicitacaoPrivacidade = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    requestType: "",
    notes: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.from("privacy_requests").insert({
        requester_name: formData.name,
        requester_email: formData.email,
        requester_phone: formData.phone,
        request_type: formData.requestType,
        notes: formData.notes,
        user_agent: navigator.userAgent
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "Solicitação enviada",
        description: "Recebemos seu pedido e entraremos em contato em breve.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao enviar",
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16 flex items-center justify-center">
          <div className="max-w-md text-center space-y-4 px-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold">Solicitação Recebida!</h1>
            <p className="text-muted-foreground">
              Seu pedido foi registrado. Analisaremos as informações e responderemos para o e-mail <strong>{formData.email}</strong> dentro do prazo legal.
            </p>
            <Button onClick={() => setIsSuccess(false)} variant="outline">Enviar outra solicitação</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container max-w-2xl">
          <h1 className="text-3xl font-bold mb-4">Solicitação de Privacidade (LGPD)</h1>
          <p className="text-muted-foreground mb-8">
            Utilize este formulário para exercer seus direitos como titular de dados pessoais, conforme previsto na Lei Geral de Proteção de Dados.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-lg border shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input 
                id="name" 
                required 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (opcional)</Label>
                <Input 
                  id="phone" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Solicitação</Label>
              <Select 
                required 
                onValueChange={(val) => setFormData({...formData, requestType: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o que deseja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="access">Acesso aos meus dados</SelectItem>
                  <SelectItem value="correction">Correção de dados incompletos/inexatos</SelectItem>
                  <SelectItem value="deletion">Exclusão de dados</SelectItem>
                  <SelectItem value="revocation">Revogação de consentimento</SelectItem>
                  <SelectItem value="query">Dúvida sobre privacidade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Detalhes Adicionais</Label>
              <Textarea 
                id="notes" 
                placeholder="Descreva melhor sua solicitação para facilitar o atendimento..."
                className="min-h-[120px]"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Solicitação
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SolicitacaoPrivacidade;
