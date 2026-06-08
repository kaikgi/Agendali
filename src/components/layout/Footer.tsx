import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Logo size="sm" />
            <p className="mt-4 text-body-sm text-muted-foreground max-w-xs">
              Simplifique seus agendamentos com a plataforma mais elegante do mercado.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Produto</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/recursos" className="text-body-sm text-muted-foreground hover:text-foreground transition-premium">
                  Recursos
                </Link>
              </li>
              <li>
                <Link to="/precos" className="text-body-sm text-muted-foreground hover:text-foreground transition-premium">
                  Preços
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Empresa</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/sobre" className="text-body-sm text-muted-foreground hover:text-foreground transition-premium">
                  Sobre
                </Link>
              </li>
              <li>
                <Link to="/contato" className="text-body-sm text-muted-foreground hover:text-foreground transition-premium">
                  Contato
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/termos" className="text-body-sm text-muted-foreground hover:text-foreground transition-premium">
                  Termos de uso
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="text-body-sm text-muted-foreground hover:text-foreground transition-premium">
                  Privacidade
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-body-sm text-muted-foreground">
            © {new Date().getFullYear()} Agendali. Todos os direitos reservados.
          </p>
          <p className="text-body-sm text-muted-foreground">
            Feito com ♥ no Brasil
          </p>
        </div>
      </div>
    </footer>
  );
}
