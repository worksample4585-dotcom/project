import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as HotToaster } from "react-hot-toast";

import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import DealsPage from "./pages/DealsPage";
import DealDetailPage from "./pages/DealDetailPage";
import DocumentsPage from "./pages/DocumentsPage";
import ClientPortalPage from "./pages/ClientPortalPage";
import UserManagementPage from "./pages/UserManagementPage";
import AuditLogPage from "./pages/AuditLogPage";
import RedirectByRole from "./pages/RedirectByRole";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1, refetchOnWindowFocus: false },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HotToaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: "hsl(var(--card))",
                color: "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
                fontSize: "14px",
              },
              success: { iconTheme: { primary: "hsl(var(--primary))", secondary: "hsl(var(--primary-foreground))" } },
              error: { iconTheme: { primary: "hsl(var(--destructive))", secondary: "hsl(var(--destructive-foreground))" } },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RedirectByRole />} />

            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["admin", "editor"]}><Dashboard /></ProtectedRoute>} />
            <Route path="/deals" element={<ProtectedRoute allowedRoles={["admin", "editor"]}><DealsPage /></ProtectedRoute>} />
            <Route path="/deals/:id" element={<ProtectedRoute allowedRoles={["admin", "editor"]}><DealDetailPage /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute allowedRoles={["admin", "editor"]}><DocumentsPage /></ProtectedRoute>} />

            <Route path="/client" element={<ProtectedRoute allowedRoles={["client"]}><ClientPortalPage /></ProtectedRoute>} />
            <Route path="/client/deals/:id" element={<ProtectedRoute allowedRoles={["client"]}><DealDetailPage readOnly /></ProtectedRoute>} />

            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><UserManagementPage /></ProtectedRoute>} />
            <Route path="/admin/audit" element={<ProtectedRoute allowedRoles={["admin"]}><AuditLogPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
