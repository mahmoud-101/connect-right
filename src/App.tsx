import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "./contexts/language";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

// Lazy loading components لتقليل حجم التحميل الأولي
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Spy = lazy(() => import("./pages/Spy"));
const Bulk = lazy(() => import("./pages/Bulk"));
const Extract = lazy(() => import("./pages/Extract"));
const ContentStudio = lazy(() => import("./pages/ContentStudio"));
const Library = lazy(() => import("./pages/Library"));
const LibraryItem = lazy(() => import("./pages/LibraryItem"));
const Export = lazy(() => import("./pages/Export"));
const ImageOptimizer = lazy(() => import("./pages/ImageOptimizer"));
const Settings = lazy(() => import("./pages/Settings"));
const Help = lazy(() => import("./pages/Help"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster position="top-center" richColors />
        <BrowserRouter>
          <Suspense fallback={<div className="h-screen w-full flex items-center justify-center">جاري التحميل...</div>}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Index />} />
                <Route path="/spy" element={<Spy />} />
                <Route path="/bulk" element={<Bulk />} />
                <Route path="/extract" element={<Extract />} />
                <Route path="/studio" element={<ContentStudio />} />
                <Route path="/library" element={<Library />} />
                <Route path="/library/:id" element={<LibraryItem />} />
                <Route path="/export" element={<Export />} />
                <Route path="/optimizer" element={<ImageOptimizer />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/help" element={<Help />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;