import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { ArrowLeft, Save, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [saving, setSaving] = useState(false);

  // Sync with user after update
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "First name and last name cannot be empty.",
      });
      return;
    }

    setSaving(true);
    try {
      await updateUser({ firstName, lastName });
      toast({
        title: "Profile Updated",
        description: "Your information has been saved.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Unable to save changes. Try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border h-16 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/student")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg shadow-md">
          <CardContent className="p-6 space-y-6">
            {/* Account Section */}
            <div>
              <h2 className="text-lg font-semibold mb-1">Account Information</h2>
              <p className="text-sm text-muted-foreground">
                Update your personal details below.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ""} disabled />
              </div>
            </div>

            {/* Theme */}
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground capitalize">
                    Current: {theme}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setTheme(theme === "dark" ? "light" : "dark")
                  }
                >
                  <Palette className="h-4 w-4 mr-2" />
                  Switch to {theme === "dark" ? "Light" : "Dark"}
                </Button>
              </div>
            </div>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : (
                <>
                  <Save className="h-4 w-4 mr-2" /> Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
