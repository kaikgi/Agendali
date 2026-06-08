import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PricingSection } from "@/components/home/PricingSection";

const Precos = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <PricingSection />
      </main>
      <Footer />
    </div>
  );
};

export default Precos;
