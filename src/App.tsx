import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { AgentProvider } from "@/contexts/AgentContext";
import { TierProvider } from "@/contexts/TierContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import WalletModal from "@/components/WalletModal";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import AgentFleet from "./pages/AgentFleet";
import Transactions from "./pages/Transactions";
import Analytics from "./pages/Analytics";
import Portfolio from "./pages/Portfolio";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DeveloperDocs from "./pages/DeveloperDocs";

const Messages = lazy(() => import("./pages/Messages"));
const AgentsHistory = lazy(() => import("./pages/AgentsHistory"));
const InstitutionalDashboard = lazy(() => import("./pages/InstitutionalDashboard"));
const ComplianceAudit = lazy(() => import("./pages/ComplianceAudit"));
const SmartAccounts = lazy(() => import("./pages/SmartAccounts"));
const TokensAnalytics = lazy(() => import("./pages/TokensAnalytics"));
const RevenueTracker = lazy(() => import("./pages/RevenueTracker"));
const DevShowcase = lazy(() => import("./pages/DevShowcase"));
const TokenLaunchStudio = lazy(() => import("./pages/TokenLaunchStudio"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <WalletProvider>
      <TierProvider>
      <AgentProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <WalletModal />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/agents" element={<AgentFleet />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/docs" element={<DeveloperDocs />} />
            <Route path="/messages" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><Messages /></Suspense>} />
            <Route path="/agents-history" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><AgentsHistory /></Suspense>} />
            <Route path="/institutional" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><InstitutionalDashboard /></Suspense>} />
            <Route path="/compliance" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><ComplianceAudit /></Suspense>} />
            <Route path="/smart-accounts" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><SmartAccounts /></Suspense>} />
            <Route path="/tokens-analytics" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><TokensAnalytics /></Suspense>} />
            <Route path="/revenue" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><RevenueTracker /></Suspense>} />
            <Route path="/dev-showcase" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><DevShowcase /></Suspense>} />
            <Route path="/launch-studio" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><TokenLaunchStudio /></Suspense>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </AgentProvider>
      </TierProvider>
    </WalletProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
