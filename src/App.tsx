import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Extract from "./pages/Extract";
import Library from "./pages/Library";
import Settings from "./pages/Settings";
import LibraryItem from "./pages/LibraryItem";
import ContentStudio from "./pages/ContentStudio";
import { LanguageProvider } from "./contexts/language";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import ImageOptimizer from "./pages/ImageOptimizer";
import Bulk from "./pages/Bulk";
import Export from "./pages/Export";
import Spy from "./pages/Spy";
import Help from "./pages/Help";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/help" element={<Help />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/extract" element={<Extract />} />
              <Route path="/optimizer" element={<ImageOptimizer />} />
              <Route path="/templates" element={<ContentStudio />} />
              <Route path="/spy" element={<Spy />} />
              <Route path="/bulk" element={<Bulk />} />
              <Route path="/export" element={<Export />} />

              <Route path="/library" element={<Library />} />
              <Route path="/library/:id" element={<LibraryItem />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
