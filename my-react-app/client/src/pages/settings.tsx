import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { ArrowLeft, Save, Palette, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setAvatarPreview(user.avatar || null);
    }
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    const previewURL = URL.createObjectURL(file);
    setAvatarPreview(previewURL);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      return toast({
        variant: "destructive",
        title: "Error",
        description: "First name and last name cannot be empty.",
      });
    }

    setSaving(true);
    try {
      let payload: any = { firstName, lastName };

      // If user changed profile picture
      if (avatarFile) {
        const formData = new FormData();
        formData.append("firstName", firstName);
        formData.append("lastName", lastName);
        formData.append("avatar", avatarFile);

        // Backend must accept multipart/form-data
        const res = await fetch(
          `http://127.0.0.1:8000/api/user/update?token=${user?.token}`,
          {
            method: "PATCH",
            body: formData,
          }
        );

        if (!res.ok) throw new Error("Failed to update profile picture");

        const { token: newToken } = await res.json();
        localStorage.setItem("session_token", newToken);
      } else {
        await updateUser(payload);
      }

      toast({
        title: "Profile Updated",
        description: "Your information has been saved.",
      });
    } catch (err) {
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
      <header className="bg-card border-b border-border h-16 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/student")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-lg shadow-md">
          <CardContent className="p-6 space-y-6">
            {/* Profile Picture */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img
                  src={
                    avatarPreview ||
                    "https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png"
                  }
                  className="w-20 h-20 rounded-full border object-cover"
                />
                <label className="absolute bottom-0 right-0 bg-primary text-white p-1 rounded-full cursor-pointer">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Upload a new profile picture
                </p>
              </div>
            </div>

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
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>

              <div>
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled />
              </div>
            </div>

            {/* Theme Switch */}
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

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : <><Save className="h-4 w-4 mr-2" /> Save Changes</>}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
