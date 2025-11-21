import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import ProfileMenu from "@/components/profile-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAuth, useHeartbeat } from "@/hooks/use-auth";
import { mockAtRiskStudents } from "@/lib/mock-data";
import UploadModal from "@/components/upload-modal";
import { mockCases } from "@/lib/mock-data";
import {
  Presentation, Gauge, GraduationCap, ClipboardCheck, ChartBar,
  FolderOpen, Settings, LogOut, Clock, ChartLine, Check, Edit, Upload, AlertTriangle, TrendingDown, Mail,
  LineChart
} from "lucide-react";

import { Input } from "@/components/ui/input";
import AnnotationCanvas from "@/components/annotation-canvas";
import { useAnnotation } from "@/hooks/use-annotation";
import RubricPanel from "@/components/grading/RubricPanel";
import HomeworkPrepPanel from "@/components/grading/HomeworkPrepPanel";


type InstructorView =
  | "overview"
  | "students"
  | "grading"
  | "analytics"
  | "cases"
  | "settings";

const VIEW_STORAGE_KEY = "instructor.activeView";
const VALID_TABS: InstructorView[] = [
  "overview",
  "students",
  "grading",
  "analytics",
  "cases",
  "settings",
];

export default function InstructorDashboard() {
  // --- Grading mock data (replace with BE later)
  type Submission = {
    id: string;
    caseId: string;
    caseTitle: string;
    studentId: string;
    status: "submitted" | "graded";
    score?: number;
    updatedAt: string;
  };

  const allSubs: Submission[] = [
    { id: "sub-1", caseId: "case-1", caseTitle: "Brain MRI - Stroke", studentId: "david.tran", status: "submitted", score: 8, updatedAt: "2025-10-10T10:00:00Z" },
    { id: "sub-2", caseId: "case-1", caseTitle: "Brain MRI - Stroke", studentId: "emma.wilson", status: "submitted", score: 7, updatedAt: "2025-10-11T08:00:00Z" },
    { id: "sub-3", caseId: "case-2", caseTitle: "Chest X-Ray Analysis", studentId: "james.lee", status: "graded", score: 9, updatedAt: "2025-10-12T12:00:00Z" },
  ];

  type Mode = "one" | "group";
  const [mode, setMode] = useState<Mode>("one");
  const [query, setQuery] = useState("");
  const [activeIds, setActiveIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allSubs.filter(s => s.studentId.toLowerCase().includes(q) || s.caseTitle.toLowerCase().includes(q));
  }, [query]);

  const selected = useMemo(
    () => filtered.find(s => s.id === (activeIds[0] ?? "")) ?? filtered[0],
    [filtered, activeIds]
  );

  const activeGroup = useMemo(
    () => filtered.filter(s => activeIds.includes(s.id)).slice(0, 4),
    [filtered, activeIds]
  );

  const onPick = (id: string) => setActiveIds(prev => (mode === "one" ? [id] : (prev.includes(id) ? prev : [...prev, id].slice(-4))));

  const saveGrade = (subId: string) => (score: number/*, rows, feedback*/) => {
    // TODO: POST /api/submissions/:id/grade
    alert(`Saved grade ${score} for ${subId} (mock)`);
  };

  // derive case + annotation for selected (1–1 mode)
  const selectedCase = mockCases.find(c => c.id === selected?.caseId);
  const selectedAnn = selected ? useAnnotation(selected.caseId, selected.studentId) : null;

  const [, setLocation] = useLocation();
  const { user, logout, isLoading } = useAuth();
  useHeartbeat(user?.user_id);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeView, setActiveView] = useState<InstructorView>(() => {
    const saved = (localStorage.getItem(VIEW_STORAGE_KEY) || "") as InstructorView;
    return VALID_TABS.includes(saved) ? saved : "overview";
  });
  const [feedback, setFeedback] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    console.log("Current user in dashboard:", user);
    if (!isLoading && (!user || user.role !== "instructor")) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, activeView);
  }, [activeView]);

  useEffect(() => {
    const handleClick = () => setShowProfileMenu(false);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowProfileMenu(false);
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (!user) return null;

  const navItems = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "students", label: "Student Work", icon: GraduationCap },
    { id: "grading", label: "Grading", icon: ClipboardCheck },
    { id: "analytics", label: "Homework Builder", icon: LineChart },
    { id: "cases", label: "Case Management", icon: FolderOpen },
  ];

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const exportClassAnalyticsCSV = () => {
    const classRows = [
      ["Student", "Cases Completed", "Avg Score (%)", "Accuracy (%)", "Time Spent (min)"],
      ["Sarah Chen", "12", "91", "95", "540"],
      ["Mike Johnson", "9", "83", "88", "420"],
      ["Aisha Rahman", "15", "92", "93", "600"],
      ["David Tran", "11", "85", "86", "505"],
    ];
    const csv = classRows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `class_analytics_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="instructor-dashboard">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 h-16 flex items-center sticky top-0 z-40">
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => setLocation("/home")}
            className="flex items-center space-x-4 focus:outline-none hover:opacity-80 transition"
          >
            <Presentation className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-semibold">Instructor Dashboard</h1>
          </button>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full pulse-dot"></div>
              <span className="text-sm text-muted-foreground">15 students online</span>
            </div>

            <div className="flex items-center space-x-2 relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfileMenu((v) => !v);
                }}
                className="focus:outline-none"
              >
                <img
                  src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&auto=format&fit=crop&w=40&h=40"
                  alt="Instructor Avatar"
                  className="w-8 h-8 rounded-full border-2 border-primary"
                />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfileMenu((v) => !v);
                }}
                className="text-sm font-medium hover:underline focus:outline-none"
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
              >
                Dr. {user.lastName}
              </button>


              {showProfileMenu && (
                <div onClick={(e) => e.stopPropagation()}>
                  <ProfileMenu />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className="group/sidebar w-16 hover:w-64 transition-all duration-300 bg-card border-r border-border sticky top-16 h-[calc(100vh-4rem)] overflow-hidden hover:overflow-auto"
        >
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === (item.id as InstructorView);
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`w-full justify-start hover:bg-transparent ${isActive
                    ? "text-primary hover:text-primary"
                    : "text-foreground hover:text-foreground"
                    }`}
                  onClick={() => setActiveView(item.id as InstructorView)}
                >
                  <Icon className="h-4 w-4 mr-3" />
                  <span className="ml-3 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300">
                    {item.label}
                  </span>
                </Button>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto">
          {/* Overview, Grading, Analytics... */}
          {activeView === "overview" && (
            <div className="p-6" data-testid="view-overview">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Welcome, Dr. {user.lastName}!</h2>
                <p className="text-muted-foreground">Monitor student progress and provide feedback</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Active Students</p><p className="text-2xl font-bold text-primary" data-testid="stat-active-students">24</p></div><GraduationCap className="h-8 w-8 text-primary" /></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Pending Reviews</p><p className="text-2xl font-bold text-orange-500" data-testid="stat-pending-reviews">8</p></div><Clock className="h-8 w-8 text-orange-500" /></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Cases Assigned</p><p className="text-2xl font-bold text-green-500" data-testid="stat-cases-assigned">15</p></div><FolderOpen className="h-8 w-8 text-green-500" /></div></CardContent></Card>
                <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Avg. Score</p><p className="text-2xl font-bold text-accent" data-testid="stat-avg-score">87%</p></div><ChartLine className="h-8 w-8 text-accent" /></div></CardContent></Card>
              </div>

              <Card className="mb-8">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                      At-Risk Student Alerts
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {mockAtRiskStudents.length} students need attention
                    </span>
                  </div>

                  <div className="space-y-4">
                    {mockAtRiskStudents.map((student) => (
                      <div
                        key={student.id}
                        className="p-4 border border-red-500/30 rounded-lg hover:bg-muted transition"
                      >
                        <div className="flex items-start space-x-4">
                          <img
                            src={student.avatar}
                            alt={student.name}
                            className="w-12 h-12 rounded-full"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium">{student.name}</p>
                              <div className="flex items-center space-x-2">
                                {student.trend === "declining" && (
                                  <span className="flex items-center text-xs text-red-500">
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    Declining
                                  </span>
                                )}
                                <span className="text-sm font-semibold text-red-500">
                                  Score: {student.score}%
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {student.issue}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Last active: {student.lastActive}
                              </span>
                              <div className="flex space-x-2">
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                  <Mail className="h-3 w-3 mr-1" />
                                  Contact
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                                >
                                  View Details
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
          {/* ———————————————————————————— */}

          {activeView === "grading" && (
            <div className="p-6" data-testid="view-grading">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Grading</h2>
                <div className="flex gap-2">
                  <Button variant={mode === "one" ? "default" : "secondary"} onClick={() => setMode("one")}>1–1</Button>
                  <Button variant={mode === "group" ? "default" : "secondary"} onClick={() => setMode("group")}>Group</Button>
                </div>
              </div>

              {/* Submissions list */}
              <Card className="mb-4">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Submissions</h3>
                    <Input placeholder="Search by student/case…" className="max-w-xs" value={query} onChange={e => setQuery(e.target.value)} />
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[240px] overflow-auto">
                    {filtered.map(s => (
                      <Button
                        key={s.id}
                        variant={activeIds.includes(s.id) ? "default" : "ghost"}
                        className="justify-start"
                        onClick={() => onPick(s.id)}
                      >
                        {s.studentId} — {s.caseTitle} {s.score != null ? `(Score ${s.score})` : `(${s.status})`}
                      </Button>
                    ))}
                    {filtered.length === 0 && <div className="text-sm text-muted-foreground p-2">No submissions</div>}
                  </div>
                </CardContent>
              </Card>

              {/* ONE-ON-ONE */}
              {mode === "one" && selected && (
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="md:col-span-2">
                    <CardContent className="p-4 space-y-2">
                      <div className="text-sm text-muted-foreground">
                        {selected.studentId} • {selected.caseTitle}
                      </div>

                      {selectedAnn && (
                        <AnnotationCanvas
                          imageUrl={selectedCase?.imageUrl}
                          annotation={selectedAnn}
                          peerAnnotations={selectedAnn.peerAnnotations}
                          versionOverlay={selectedAnn.versionOverlay}
                        />
                      )}
                    </CardContent>
                  </Card>

                  <RubricPanel onSubmit={(score) => saveGrade(selected.id)(score)} />
                </div>
              )}


              {/* GROUP COMPARE */}
              {mode === "group" && (
                <div className="grid md:grid-cols-2 gap-4">
                  {activeGroup.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Select 2–4 submissions from the list to compare.
                    </div>
                  ) : activeGroup.map(s => {
                    const caseObj = mockCases.find(c => c.id === s.caseId);
                    const ann = useAnnotation(s.caseId, s.studentId);
                    return (
                      <Card key={s.id}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{s.studentId}</div>
                            <div className="text-xs text-muted-foreground">
                              {s.score != null ? `Score ${s.score}` : s.status}
                            </div>
                          </div>
                          <AnnotationCanvas
                            imageUrl={caseObj?.imageUrl}
                            annotation={ann}
                            peerAnnotations={ann.peerAnnotations}
                            versionOverlay={ann.versionOverlay}
                          />
                        </CardContent>
                      </Card>
                    );
                  })
                  }
                </div>
              )}
            </div>
          )}
          {activeView === "analytics" && (
            <div className="p-6 space-y-6" data-testid="view-analytics">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Homework Builder</h2>
                <span className="text-muted-foreground text-sm">
                  Analyze class results and create personalized homework.
                </span>
              </div>

              {/* (2) Homework Builder */}
              <HomeworkPrepPanel
                cases={mockCases.map(c => ({ id: c.id, title: c.title }))}
                stats={{
                  avgScore: Math.round(
                    (allSubs.reduce((a, b) => a + (b.score ?? 0), 0) / Math.max(1, allSubs.length)) * 10
                  ) / 10,
                  commonMistakes: ["Overlapping regions", "Incorrect boundary", "Missed edema area"],
                  skillGaps: ["Anatomical localization", "Contrast handling", "Annotation labeling"],
                }}
                onPublish={(payload) => {
                  console.log("publish payload", payload);
                  alert(`Homework published (mock):
        Case: ${payload.caseId}
        Due: ${payload.dueAtISO}
        Audience: ${payload.audience}
        Checklist: ${payload.autoChecklist.join(" | ")}`);
                }}
              />
            </div>
          )}


          {/* CASE MANAGEMENT VIEW */}
          {activeView === "cases" && (
            <div className="p-6 space-y-6" data-testid="view-cases">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Case Management</h2>
                <Button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Case
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockCases.map((case_) => (
                  <Card
                    key={case_.id}
                    className="border border-border overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setLocation(`/annotation/${case_.id}`)}
                  >
                    <img
                      src={case_.imageUrl}
                      alt={case_.title}
                      className="w-full h-48 object-cover"
                    />
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">{case_.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {case_.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {case_.category}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          12 annotations
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <UploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
              />
            </div>
          )}
          {activeView === "settings" && (
            <div className="p-6 space-y-6" data-testid="view-settings">
              <h2 className="text-2xl font-bold mb-4">Account Settings</h2>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Manage instructor profile, theme, and preferences.
                  </p>

                  <Button onClick={() => setLocation("/settings")} className="w-full">
                    Open Settings Page
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
