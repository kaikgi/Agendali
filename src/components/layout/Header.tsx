import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Menu, Building2, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="transition-premium hover:opacity-80">
          <Logo size="md" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          <Link 
            to="/recursos" 
            className="text-body-sm text-muted-foreground hover:text-foreground transition-premium animate-underline py-2"
          >
            Recursos
          </Link>
          <Link 
            to="/precos" 
            className="text-body-sm text-muted-foreground hover:text-foreground transition-premium animate-underline py-2"
          >
            Preços
          </Link>
          <Link 
            to="/sobre" 
            className="text-body-sm text-muted-foreground hover:text-foreground transition-premium animate-underline py-2"
          >
            Sobre
          </Link>
          <Link 
            to="/contato" 
            className="text-body-sm text-muted-foreground hover:text-foreground transition-premium animate-underline py-2"
          >
            Contato
          </Link>
        </nav>

        {/* Desktop CTA - Direct Login Options */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/cliente/login" className="flex items-center gap-2">
              <User size={16} />
              Entrar como Cliente
            </Link>
          </Button>
          <Button variant="default" size="sm" asChild>
            <Link to="/login" className="flex items-center gap-2">
              <Building2 size={16} />
              Entrar como Estabelecimento
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden touch-target"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </Button>
      </div>

      {/* Mobile Menu */}
      <div className={cn(
        "md:hidden glass border-t border-border/50 overflow-hidden transition-all duration-300",
        mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}>
        <nav className="container py-4 flex flex-col gap-1">
          <Link 
            to="/recursos" 
            className="text-body-md text-muted-foreground hover:text-foreground transition-premium py-3 px-2 rounded-md hover:bg-muted touch-target"
            onClick={() => setMobileMenuOpen(false)}
          >
            Recursos
          </Link>
          <Link 
            to="/precos" 
            className="text-body-md text-muted-foreground hover:text-foreground transition-premium py-3 px-2 rounded-md hover:bg-muted touch-target"
            onClick={() => setMobileMenuOpen(false)}
          >
            Preços
          </Link>
          <Link 
            to="/sobre" 
            className="text-body-md text-muted-foreground hover:text-foreground transition-premium py-3 px-2 rounded-md hover:bg-muted touch-target"
            onClick={() => setMobileMenuOpen(false)}
          >
            Sobre
          </Link>
          <Link 
            to="/contato" 
            className="text-body-md text-muted-foreground hover:text-foreground transition-premium py-3 px-2 rounded-md hover:bg-muted touch-target"
            onClick={() => setMobileMenuOpen(false)}
          >
            Contato
          </Link>
          
          {/* Mobile Login Options */}
          <div className="border-t border-border mt-2 pt-3 space-y-2">
            <p className="text-xs text-muted-foreground px-2 uppercase tracking-wider">Entrar como</p>
            <Link
              to="/cliente/login"
              className="flex items-center gap-3 py-3 px-2 rounded-md hover:bg-muted touch-target"
              onClick={() => setMobileMenuOpen(false)}
            >
              <User size={16} className="text-muted-foreground" />
              <span className="text-body-md">Cliente</span>
            </Link>
            <Link
              to="/login"
              className="flex items-center gap-3 py-3 px-2 rounded-md hover:bg-muted touch-target"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Building2 size={16} className="text-muted-foreground" />
              <span className="text-body-md">Estabelecimento</span>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
