import ThreeBackground from '@/components/ThreeBackground';
import SideNav from '@/components/SideNav';
import HeroSection from '@/components/HeroSection';
import AboutSection from '@/components/AboutSection';
import FeaturesSection from '@/components/FeaturesSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import TokenomicsSection from '@/components/TokenomicsSection';
import CTASection from '@/components/CTASection';
import FooterSection from '@/components/FooterSection';

const Index = () => {
  return (
    <>
      <ThreeBackground />
      <SideNav />
      <HeroSection />
      <main id="main-content" className="relative z-20 bg-background">
        <AboutSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TokenomicsSection />
        <CTASection />
        <FooterSection />
      </main>
    </>
  );
};

export default Index;
