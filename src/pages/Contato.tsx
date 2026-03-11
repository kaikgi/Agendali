import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, MapPin, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_NUMBER = "5511943990345";
const MAX_MESSAGE_LENGTH = 800;

function generateFingerprint(): string {
  const raw = [
    navigator.userAgent,
    screen.width.toString(),
    screen.height.toString(),
    new Date().getTimezoneOffset().toString(),
    navigator.language,
  ].join("|");
  // Simple hash for fingerprint (will be hashed properly on server if needed)
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildWhatsAppUrl(name: string, email: string, message: string): string {
  const truncatedMessage = message.substring(0, MAX_MESSAGE_LENGTH);
  const text = `Olá, time Agendali! 👋

Nome: ${name}
E-mail: ${email}
Mensagem: ${truncatedMessage}

Enviado pelo site: https://www.agendali.online/contato`;

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

const Contato = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string || "").trim();
    const email = (formData.get("email") as string || "").trim();
    const message = (formData.get("message") as string || "").trim();
    const honeypot = (formData.get("company") as string || "").trim();

    // Validate
    if (!name || !email || !message) {
      toast.error("Por favor, preencha todos os campos.");
      setIsSubmitting(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Por favor, insira um e-mail válido.");
      setIsSubmitting(false);
      return;
    }

    const fingerprint = generateFingerprint();

    try {
      // Call tracking edge function with short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const { data, error } = await supabase.functions.invoke("track-whatsapp-contact", {
        body: {
          name,
          email,
          message,
          page_path: "/contato",
          honeypot,
          fingerprint,
        },
      });

      clearTimeout(timeoutId);

      if (!error && data && data.ok === false) {
        // Blocked by anti-abuse
        let errorMsg = "Envio bloqueado por segurança. Tente novamente mais tarde.";
        if (data.code === 'BOT_BLOCKED') {
          errorMsg = "Envio bloqueado por segurança.";
        } else if (data.code === 'COOLDOWN') {
          errorMsg = "Aguarde alguns segundos antes de enviar novamente.";
        } else if (data.code === 'DUPLICATE') {
          errorMsg = "Esta mensagem já foi enviada recentemente.";
        }
        toast.error(errorMsg);
        setIsSubmitting(false);
        return;
      }

      // Success or tracking error — open WhatsApp either way
      const url = buildWhatsAppUrl(name, email, message);
      window.open(url, "_blank");
      toast.success("Redirecionando para o WhatsApp...");
      formRef.current?.reset();
    } catch {
      // Tracking failed — still open WhatsApp (don't penalize user)
      const url = buildWhatsAppUrl(name, email, message);
      window.open(url, "_blank");
      toast.success("Redirecionando para o WhatsApp...");
      formRef.current?.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container">
          {/* Hero */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-label text-muted-foreground uppercase tracking-wider mb-4">
              Contato
            </p>
            <h1 className="text-display-lg mb-6">
              Fale conosco
            </h1>
            <p className="text-body-lg text-muted-foreground">
              Tem alguma dúvida ou sugestão? Envie sua mensagem diretamente pelo WhatsApp.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Contact Info */}
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="text-primary" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">WhatsApp</h3>
                  <p className="text-muted-foreground">+55 11 93752-5469</p>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    Canal oficial de atendimento.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="text-primary" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">E-mail</h3>
                  <p className="text-muted-foreground">contato@agendali.online</p>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    Respondemos em até 24 horas úteis.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="text-primary" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Localização</h3>
                  <p className="text-muted-foreground">Brasil</p>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    100% remoto, atendendo todo o país.
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-card rounded-2xl border border-border p-8">
              <h2 className="text-xl font-semibold mb-6">Envie uma mensagem</h2>
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Seu nome"
                    required
                    maxLength={100}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    maxLength={255}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Como podemos ajudar?"
                    rows={5}
                    required
                    maxLength={MAX_MESSAGE_LENGTH}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    Máx. {MAX_MESSAGE_LENGTH} caracteres
                  </p>
                </div>

                {/* Honeypot — visually hidden, bots fill it */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '-9999px',
                    top: '-9999px',
                    width: '1px',
                    height: '1px',
                    overflow: 'hidden',
                  }}
                >
                  <label htmlFor="company">Empresa</label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Enviar pelo WhatsApp
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contato;
