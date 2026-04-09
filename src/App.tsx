import { useState, useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { AnalyticsRouteListener } from "@/components/AnalyticsRouteListener";
import { ThemeProvider } from "@/components/ThemeProvider";
import SplashScreen from "@/components/SplashScreen";
import { supabase } from "@/integrations/supabase/client";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Interests from "./pages/Interests";
import Feed from "./pages/Feed";
import Rooms from "./pages/Rooms";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import EventCalendar from "./pages/EventCalendar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthRedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && (location.pathname === "/" || location.pathname === "/signup")) {
        navigate("/feed", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  return null;
}

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const hideSplash = useCallback(() => setShowSplash(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {showSplash && <SplashScreen onComplete={hideSplash} />}
          <BrowserRouter>
            <AnalyticsRouteListener />
            <AuthRedirectHandler />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/interests" element={<Interests />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/calendar" element={<EventCalendar />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/chat/:roomId" element={<Chat />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
