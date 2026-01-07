import React from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import StudentDashboard from "@/pages/student-dashboard";
import InstructorDashboard from "@/pages/instructor-dashboard";
import AnnotationView from "@/pages/annotation-view";
import AdminAccounts from "@/pages/admin-accounts";
import AIPlayground from "@/pages/ai-playground";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Home from "@/pages/home";
import SettingsPage from "@/pages/settings";

interface RouteProps {
  component: React.ComponentType<any>;
  [key: string]: any;
}

function ProtectedRoute({ component: Component, ...rest }: RouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role === "instructor" && user.approval_status !== "verified") {
    if (rest.path !== "/" && rest.path !== "/home") {
      return <Redirect to="/home" />;
    }
  }

  return <Route {...rest} component={Component} />;
}

function GuestRoute({ component: Component, ...rest }: RouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Loading...
      </div>
    );
  }

  if (user) {
    const redirectPath =
      user.role === "instructor" ? "/instructor" : "/student";
    return <Redirect to={redirectPath} />;
  }

  return <Route {...rest} component={Component} />;
}

function Router() {
  return (
    <Switch>
      <GuestRoute path="/login" component={Login} />
      <GuestRoute path="/signup" component={Signup} />

      <Route path="/" component={Home} />
      <Route path="/home" component={Home} />

      <ProtectedRoute path="/admin" component={AdminAccounts} />
      <ProtectedRoute path="/ai" component={AIPlayground} />
      <ProtectedRoute path="/student" component={StudentDashboard} />
      <ProtectedRoute path="/instructor" component={InstructorDashboard} />
      <ProtectedRoute path="/annotation/:caseId" component={AnnotationView} />
      <ProtectedRoute path="/settings" component={SettingsPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
