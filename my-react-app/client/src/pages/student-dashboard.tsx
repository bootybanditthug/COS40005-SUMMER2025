// src/pages/student-dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import ProfileMenu from "@/components/profile-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth, useHeartbeat } from "@/hooks/use-auth";
import { mockCases, mockPerformanceData, mockUpcomingAssignments } from "@/lib/mock-data";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import CaseCard from "@/components/case-card";
import UploadModal from "@/components/upload-modal";
import {
  UserRound, Gauge, FolderOpen, Edit, Users, ChartLine, Settings,
  CheckCircle, MessageCircle, Flame, LogOut, Upload, Calendar, AlertCircle
} from "lucide-react";

// discussion 
import DiscussionThread from "@/components/discussion/DiscussionThread";

// icon Assignments
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";


// === Homework metadata 
type HomeworkMeta = { dueAt: string; closed: boolean };
const homeworkByCase: Record<string, HomeworkMeta> = {
  "case-1": { dueAt: new Date(Date.now() + 2 * 86400000).toISOString(), closed: false },
  "case-2": { dueAt: new Date(Date.now() + 5 * 86400000).toISOString(), closed: false },
  "case-3": { dueAt: new Date(Date.now() + 7 * 86400000).toISOString(), closed: true },
};

// === Trạng thái bài nộp của riêng học sinh 
type MySubmissionStatus = { score?: number; status: "grading" | "graded" | "none" };
const mySubmissionByCase: Record<string, MySubmissionStatus> = {
  "case-1": { status: "grading" },          // đã nộp, đang chấm
  "case-2": { status: "none" },             // chưa nộp
  "case-3": { status: "graded", score: 9 }, // đã chấm
};

const daysLeft = (iso?: string) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

// === Danh sách "My Annotations" 
const myAnnotations = mockCases
  .filter(c => (mySubmissionByCase[c.id]?.status ?? "none") !== "none")
  .map(c => ({
    caseId: c.id,
    caseTitle: c.title,
    updatedAgo: "today",
  }));


type StudentView = "overview" | "cases" | "annotations" | "collaboration" | "progress" | "settings";

type StudentStats = {
  casesCompleted: number;
  activeAnnotations: number;
  feedbackReceived: number;
  studyStreakDays: number;
  annotationAccuracyPct: number;
  completionRatePct: number;
  collaborationScorePct: number;
};

const VALID_TABS: StudentView[] = ["overview", "cases", "annotations", "collaboration", "progress", "settings"];
const VIEW_STORAGE_KEY = "student.activeView";

export default function StudentDashboard() {

  const [onlineCount, setOnlineCount] = useState<number>(0);

  useEffect(() => {
    async function fetchOnlineUsers() {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/admin/users");
        if (!res.ok) throw new Error("Failed to load users");
        const data = await res.json();
        const online = data.filter((u: any) => u.online).length;
        setOnlineCount(online);
      } catch {
        setOnlineCount(0);
      }
    }

    fetchOnlineUsers();
  }, []);

  const [, setLocation] = useLocation();
  const { user, logout, isLoading } = useAuth();
  useHeartbeat(user?.user_id);

  // Persist the active sub-view so reloads restore it
  const [activeView, setActiveView] = useState<StudentView>(() => {
    const saved = (localStorage.getItem(VIEW_STORAGE_KEY) || "") as StudentView;
    return VALID_TABS.includes(saved) ? saved : "overview";
  });
  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, activeView);
  }, [activeView]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Close profile menu on outside click or Escape
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

  // One source of truth for stats (cards + CSV both consume this)
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    console.log("Current user in dashboard:", user);
    if (!isLoading && (!user || user.role !== "student")) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  // Fetch from your API (fallback to mock if API missing/failed)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setStatsError(null);
        // Adjust the endpoint to your backend. Expect a shape compatible with StudentStats.
        const res = await fetch("/api/student/overview", { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        const data = await res.json();

        // Defensive mapping to our local type (rename keys if your API differs)
        const next: StudentStats = {
          casesCompleted: Number(data?.casesCompleted ?? 0),
          activeAnnotations: Number(data?.activeAnnotations ?? 0),
          feedbackReceived: Number(data?.feedbackReceived ?? 0),
          studyStreakDays: Number(data?.studyStreakDays ?? 0),
          annotationAccuracyPct: Number(data?.annotationAccuracyPct ?? 0),
          completionRatePct: Number(data?.completionRatePct ?? 0),
          collaborationScorePct: Number(data?.collaborationScorePct ?? 0),
        };
        if (!cancelled) setStats(next);
      } catch (e) {
        // Fallback mock so the UI still works on dev
        if (!cancelled) {
          setStats({
            casesCompleted: 12,
            activeAnnotations: 8,
            feedbackReceived: 5,
            studyStreakDays: 21,
            annotationAccuracyPct: 85,
            completionRatePct: 92,
            collaborationScorePct: 78,
          });
        }
      }
    }
    load();

    return () => { cancelled = true; };
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (!user) return null;

  const navItems = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "cases", label: "Case Library", icon: FolderOpen },
    { id: "annotations", label: "My Annotations", icon: Edit },
    { id: "collaboration", label: "Forums", icon: Users },
    { id: "progress", label: "Progress", icon: ChartLine },
  ] as const;

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const exportStudentProgressCSV = () => {
    if (!stats) return;
    const rows = [
      ["Student", `${user.firstName} ${user.lastName}`],
      ["Email", user.email],
      [],
      ["Metric", "Value"],
      ["Cases Completed", String(stats.casesCompleted)],
      ["Active Annotations", String(stats.activeAnnotations)],
      ["Feedback Received", String(stats.feedbackReceived)],
      ["Study Streak (days)", String(stats.studyStreakDays)],
      ["Annotation Accuracy (%)", String(stats.annotationAccuracyPct)],
      ["Case Completion Rate (%)", String(stats.completionRatePct)],
      ["Collaboration Score (%)", String(stats.collaborationScorePct)],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `progress_${user.lastName}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const StatCard = ({
    label,
    value,
    icon: Icon,
    valueClass = "",
    testId,
  }: {
    label: string; value: string | number; icon: any; valueClass?: string; testId: string;
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${valueClass}`} data-testid={testId}>
              {value}
            </p>
          </div>
          <Icon className={`h-8 w-8 ${valueClass || "text-primary"}`} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background" data-testid="student-dashboard">
      {/* Sticky Header */}
      <header className="bg-card border-b border-border px-6 h-16 flex items-center sticky top-0 z-40">
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => setLocation("/home")}
            className="flex items-center space-x-4 focus:outline-none hover:opacity-80 transition"
          >
            <UserRound className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-semibold">Medical Imaging Platform</h1>
          </button>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${onlineCount > 0 ? "bg-green-500" : "bg-gray-400"} animate-pulse`}></div>
              <span className="text-sm text-muted-foreground">
                {onlineCount} {onlineCount === 1 ? "user" : "users"} online
              </span>
            </div>

            {/* Avatar + Name + ProfileMenu */}
            <div className="flex items-center space-x-2 relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfileMenu((v) => !v);
                }}
                className="flex items-center space-x-2 focus:outline-none hover:opacity-80 transition"
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
              >
                <img
                  src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=40&h=40"
                  alt="Student Avatar"
                  className="w-8 h-8 rounded-full border-2 border-primary"
                />
                <span className="text-sm font-medium" data-testid="text-username">
                  {user.firstName} {user.lastName}
                </span>
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
              const isActive = activeView === item.id;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`w-full justify-start hover:bg-transparent ${isActive
                    ? "text-primary hover:text-primary"
                    : "text-foreground hover:text-foreground"
                    }`}
                  onClick={() => {
                    {
                      setActiveView(item.id);
                    }
                  }}
                  data-testid={`nav-${item.id}`}
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
          {statsError && (
            <div className="mx-6 mt-4 p-3 text-sm rounded bg-yellow-50 border border-yellow-200 text-yellow-800">
              {statsError}
            </div>
          )}

          {activeView === "overview" && stats && (
            <div className="p-6" data-testid="view-overview">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Welcome back, {user.firstName}!</h2>
                <p className="text-muted-foreground">Continue your medical imaging studies</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard label="Cases Completed" value={stats.casesCompleted} icon={CheckCircle} valueClass="text-primary" testId="stat-cases-completed" />
                <StatCard label="Active Annotations" value={stats.activeAnnotations} icon={Edit} valueClass="text-accent" testId="stat-active-annotations" />
                <StatCard label="Feedback Received" value={stats.feedbackReceived} icon={MessageCircle} valueClass="text-yellow-500" testId="stat-feedback-received" />
                <StatCard label="Average Score" value={`${Math.round(stats.annotationAccuracyPct)}%`} icon={ChartLine} valueClass="text-accent" testId="stat-average-score" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Performance Trend</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={mockPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-sm text-muted-foreground mt-2">Your performance has improved by 19% over the last 7 weeks</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-primary" />
                      Upcoming Assignments
                    </h3>
                    <div className="space-y-3">
                      {mockUpcomingAssignments.map((assignment) => {
                        const daysUntilDue = Math.ceil((assignment.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        const isUrgent = daysUntilDue <= 2;
                        return (
                          <div key={assignment.id} className={`p-3 rounded-lg border ${isUrgent ? 'border-destructive/30 bg-destructive/10' : 'border-border bg-muted'}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{assignment.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{assignment.category}</p>
                              </div>
                              {isUrgent && <AlertCircle className="h-4 w-4 text-red-500" />}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className={`text-xs px-2 py-1 rounded ${assignment.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {assignment.priority}
                              </span>
                              <span className="text-xs text-muted-foreground">Due in {daysUntilDue} days</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Recent Cases</h3>
                    <div className="space-y-4">
                      {mockCases.slice(0, 2).map((case_) => (
                        <div
                          key={case_.id}
                          className="flex items-center space-x-4 p-3 rounded-lg hover:bg-secondary cursor-pointer"
                          onClick={() => setLocation(`/annotation/${case_.id}`)}
                          data-testid={`recent-case-${case_.id}`}
                        >
                          <img src={case_.imageUrl} alt={case_.title} className="w-12 h-12 rounded object-cover" />
                          <div className="flex-1">
                            <p className="font-medium">{case_.title}</p>
                            <p className="text-sm text-muted-foreground">Last reviewed 2 hours ago</p>
                          </div>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Completed</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Recent Feedback</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-primary/10 rounded-lg border-l-4 border-primary hover:bg-secondary cursor-pointer">
                        <div className="flex items-start space-x-3">
                          <img src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&auto=format&fit=crop&w=40&h=40" alt="Dr. Smith" className="w-8 h-8 rounded-full" />
                          <div><p className="font-medium text-sm">Dr. Smith</p><p className="text-sm text-muted-foreground">Great work on identifying the lesion. Consider the surrounding tissue changes.</p></div>
                        </div>
                      </div>
                      <div className="p-4 bg-primary/10 rounded-lg border-l-4 border-primary hover:bg-secondary cursor-pointer">
                        <div className="flex items-start space-x-3">
                          <img src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=40&h=40" alt="Dr. Johnson" className="w-8 h-8 rounded-full" />
                          <div><p className="font-medium text-sm">Dr. Johnson</p><p className="text-sm text-muted-foreground">Excellent annotation accuracy. Your diagnostic skills are improving!</p></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeView === "collaboration" && (
            <div className="p-6" data-testid="view-collaboration">
              <DiscussionThread />
            </div>
          )}

          {activeView === "annotations" && (
            <div className="p-6" data-testid="view-annotations">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">My Annotations</h2>
                <Link href="/student">
                  <Button variant="outline" size="sm">Back to Overview</Button>
                </Link>
              </div>

              {myAnnotations.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  You don’t have any annotations yet. Open a case in <b>Case Library</b> to start.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myAnnotations.map((annot) => {
                    const hw = homeworkByCase[annot.caseId];
                    const my = mySubmissionByCase[annot.caseId];

                    return (
                      <div key={annot.caseId} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-semibold">{annot.caseTitle}</h4>
                            <p className="text-xs text-muted-foreground">Last edited {annot.updatedAgo}</p>
                          </div>

                          {/* Status badge theo yêu cầu */}
                          <div className="flex items-center gap-2">
                            {hw && <Badge>Homework</Badge>}
                            {hw?.closed ? (
                              my?.status === "graded" ? (
                                <Badge variant="default">Score: {my?.score}/10</Badge>
                              ) : (
                                <Badge variant="secondary">Grading</Badge>
                              )
                            ) : (
                              hw && (
                                <Badge variant="outline">
                                  Due in {Math.max(0, daysLeft(hw?.dueAt) ?? 0)} days
                                </Badge>
                              )
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          {hw?.closed ? (
                            <Button size="sm" variant="outline" disabled>Closed</Button>
                          ) : (
                            <Link href={`/annotation/${annot.caseId}`}>
                              <Button size="sm">Open</Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}


          {activeView === "cases" && (
            <div className="p-6" data-testid="view-cases">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Case Library</h2>
                <Button onClick={() => setShowUploadModal(true)} className="bg-primary text-primary-foreground hover:opacity-90" data-testid="button-upload-case">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Case
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockCases.map((case_) => {
                  const hw = homeworkByCase[case_.id];
                  const dl = hw ? Math.max(0, daysLeft(hw?.dueAt) ?? 0) : null;

                  return (
                    <div key={case_.id} className="space-y-2">
                      {/* Card gốc */}
                      <CaseCard
                        case={case_}
                        onClick={() => setLocation(`/annotation/${case_.id}`)}
                      />

                      {/* Meta bar cho Assignment */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          {hw && <Badge>Homework</Badge>}
                          {hw ? (
                            hw.closed ? (
                              <Badge variant="destructive">Closed</Badge>
                            ) : (
                              <Badge variant="secondary">Due in {dl} days</Badge>
                            )
                          ) : null}
                        </div>

                        <div>
                          {hw ? (
                            hw.closed ? (
                              <Button size="sm" variant="outline" disabled>Closed</Button>
                            ) : (
                              <Link href={`/annotation/${case_.id}`}>
                                <Button size="sm">Open</Button>
                              </Link>
                            )
                          ) : (
                            <Link href={`/annotation/${case_.id}`}>
                              <Button size="sm" variant="ghost">Open</Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeView === "progress" && stats && (
            <div className="p-6" data-testid="view-progress">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Learning Progress</h2>
                <Button onClick={exportStudentProgressCSV}>Export CSV</Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Overall Performance</h3>
                    <div className="space-y-4">
                      <div><div className="flex justify-between text-sm mb-1"><span>Annotation Accuracy</span><span data-testid="accuracy-percentage">{stats.annotationAccuracyPct}%</span></div><Progress value={stats.annotationAccuracyPct} className="h-2" /></div>
                      <div><div className="flex justify-between text-sm mb-1"><span>Case Completion Rate</span><span data-testid="completion-percentage">{stats.completionRatePct}%</span></div><Progress value={stats.completionRatePct} className="h-2" /></div>
                      <div><div className="flex justify-between text-sm mb-1"><span>Collaboration Score</span><span data-testid="collaboration-percentage">{stats.collaborationScorePct}%</span></div><Progress value={stats.collaborationScorePct} className="h-2" /></div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Recent Achievements</h3>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div>Case Master — Completed {Math.max(1, Math.round(stats.casesCompleted / 2))} cases this week</div>
                      <div>Perfect Annotation — {stats.annotationAccuracyPct}% accuracy on stroke case</div>
                      <div>Team Player — Collaboration score {stats.collaborationScorePct}%</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Study Timeline</h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4 p-3 border-l-4 border-green-500 bg-green-500/10">
                      <div className="flex-shrink-0"><div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm"><CheckCircle className="h-4 w-4" /></div></div>
                      <div className="flex-1"><p className="font-medium">Completed Brain MRI Case</p><p className="text-sm text-muted-foreground">2 hours ago - Score: 95%</p></div>
                    </div>
                    <div className="flex items-center space-x-4 p-3 border-l-4 border-primary bg-primary/10">
                      <div className="flex-shrink-0"><div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm"><MessageCircle className="h-4 w-4" /></div></div>
                      <div className="flex-1"><p className="font-medium">Received Feedback</p><p className="text-sm text-muted-foreground">4 hours ago - Dr. Smith reviewed your work</p></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {activeView === "settings" && (
            <div className="p-6 space-y-6" data-testid="view-settings">
              <h2 className="text-2xl font-bold mb-4">Account Settings</h2>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Manage your profile information.</p>
                  </div>
                  <Button onClick={() => setLocation("/settings")} className="w-full">
                    Open Settings Page
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />
    </div>
  );
}
