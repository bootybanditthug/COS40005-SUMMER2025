import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Palette, UserRound } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter"; // Added this import for redirect

export default function ProfileMenu() {
  const { user, logout, isLoading, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [, setLocation] = useLocation(); // Added this for setting location

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  if (!user) return null;

  const handleSaveSettings = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "First name and last name cannot be empty.",
      });
      return;
    }

    try {
      await updateUser({ firstName, lastName });
      toast({
        title: "Success",
        description: "Your account settings have been updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update settings. Please try again.",
      });
      console.error("Failed to save settings:", error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="absolute right-4 top-16 w-72 bg-card border border-border rounded-xl shadow-lg z-50">
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserRound className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {/* Divider */}
          <hr className="border-border" />

          {/* Menu */}
          <div className="space-y-2">
            {/* Account settings button to navigate to /settings */}
            <Button
              variant="ghost"
              className="w-full justify-start text-sm"
              onClick={() => setLocation("/settings")} // Redirect to settings page
            >
              <Settings className="h-4 w-4 mr-2" /> Account settings
            </Button>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              className="w-full justify-start text-sm"
              onClick={toggleTheme}
            >
              <Palette className="h-4 w-4 mr-2" />
              {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            </Button>
          </div>

          {/* Footer */}
          <hr className="border-border" />
          <Button
            variant="secondary"
            className="w-full text-sm"
            onClick={logout}
            disabled={isLoading}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
