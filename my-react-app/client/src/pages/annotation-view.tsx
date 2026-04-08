import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth, useHeartbeat } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useAnnotation } from "@/hooks/use-annotation";
import { useI18n } from "@/i18n";
import { useSubmission, SubmissionFile } from "@/hooks/use-submission";
import { mockCases } from "@/lib/mock-data";
import AnnotationToolbar from "@/components/annotation-toolbar";
import AnnotationCanvas from "@/components/annotation-canvas";
import AnnotationHistory from "@/components/annotation-history";
import PeerComparison from "@/components/peer-comparison";
import ChatPanel from "@/components/chat-panel";
import InlineTextEditor from "@/components/inline-text-editor";
import AnnotationPropertiesPanel from "@/components/annotation-properties-panel";
import AIChatAssistant from "@/components/ai-chat-assistant";
import AIAnnotationSuggestions from "@/components/ai-annotation-suggestions";
import SubmissionPanel from "@/components/submission-panel";
import AssignmentRequirements from "@/components/assignment-requirements";
import { ArrowLeft, Save, Bot, Eye, Clock, AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Info, Lock, LockOpen, Edit2, X, Plus } from "lucide-react";

// Collaborative imports
import { useVersions } from "@/hooks/use-versions";
import VersionList from "@/components/versions/VersionList";
import CompareToggle from "@/components/compare/CompareToggle";

// + add
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import InstructorCaseManager from "@/components/grading/InstructorCaseManager";
import AssignmentDetailsPanel from "@/components/assignment-details-panel";

const API_BASE = "http://127.0.0.1:8000";

type Classroom = {
  id: string;
  name: string;
  year: string;
  display: string;
  members_count: number;
};

type IndexedSubmission = {
  id?: string;
  status?: "none" | "submitted" | "grading" | "graded";
  score?: number | null;
  notes?: string;
  files?: SubmissionFile[];
  answers?: Array<{ index: number; value: any }>;
  updated_at?: string;
  created_at?: string;
  feedback?: string;
  student_id?: string;
  homework_id?: string;
  case_id?: string;
};

type PeerCompareEntry = {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: "student" | "instructor";
  };
  annotations: any[];
  color: string;
  visible: boolean;
  createdAt: string;
};

const PEER_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const normalizeClassTag = (value: string) => value.trim().toLowerCase();

const dedupeClassTags = (tags: string[]) => {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = normalizeClassTag(tag);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dedupeClassIds = (ids: string[]) => {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const key = id.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const ALL_STUDENTS_OPTION_ID = "__all_students__";

export default function AnnotationView() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ caseId: string }>("/annotation/:caseId");
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const caseId = params?.caseId || "";

  type HomeworkMeta = {
    id: string;
    dueAt: string;
    closed: boolean;
    description: string;
    points: number;
    homeworkType?: "Q&A" | "Annotate";
    audience?: string;
    className?: string;
    classYear?: string;
    classIds?: string[];
    classLabels?: string[];
    visibility?: "public" | "private";
    password?: string;
    instructions?: string;
    uploads?: any[];
    referenceImages?: string[];
    annotationImage?: string;
    questions?: any[];
  };

  const [remoteCase, setRemoteCase] = useState<any | null>(null);
  const [remoteHomework, setRemoteHomework] = useState<HomeworkMeta | undefined>(undefined);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const case_ = remoteCase ?? mockCases.find((c) => c.id === caseId);
  const hw = remoteHomework;
  const isQnAHomework = hw?.homeworkType === "Q&A";
  const isQnAStudentMode = user?.role === "student" && isQnAHomework;

  // Timer key scoped to case + user so timers are not shared between users
  const timerKey = `timer_${caseId}_${user?.user_id ?? 'guest'}`;

  const annotation = useAnnotation(caseId, user?.user_id || "current-user");
  const { submission, loading: subLoading, error: subError, submitHomework, uploadFile, fetchSubmission } = useSubmission(
    hw?.id || "",
    caseId,
    user?.user_id || "current-user"
  );
  const [indexedSubmission, setIndexedSubmission] = useState<IndexedSubmission | null>(null);

  // Load submission on mount
  useEffect(() => {
    if (hw?.id && caseId && user?.user_id) {
      fetchSubmission();
    }
  }, [hw?.id, caseId, user?.user_id, fetchSubmission]);

  useEffect(() => {
    if (user?.role !== "student" || !user?.user_id || !hw?.id || !caseId) {
      setIndexedSubmission(null);
      return;
    }

    let cancelled = false;

    const loadIndexedSubmission = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/instructor/submissions`);
        if (!res.ok) return;
        const rows = await res.json();
        if (!Array.isArray(rows)) return;

        const matched = rows
          .filter((row: any) => {
            const sameStudent = String(row?.student_id || "") === String(user.user_id);
            const sameHomework = String(row?.homework_id || "") === String(hw.id);
            const sameCase = String(row?.case_id || "") === String(caseId);
            return sameStudent && sameHomework && sameCase;
          })
          .sort((a: any, b: any) => {
            const at = new Date(a?.updated_at ?? a?.created_at ?? 0).getTime();
            const bt = new Date(b?.updated_at ?? b?.created_at ?? 0).getTime();
            return bt - at;
          });

        if (!cancelled) {
          setIndexedSubmission((matched[0] as IndexedSubmission) ?? null);
        }
      } catch {
        if (!cancelled) {
          setIndexedSubmission(null);
        }
      }
    };

    loadIndexedSubmission();

    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.user_id, hw?.id, caseId, submission?.updated_at, submission?.status, submission?.score]);

  useEffect(() => {
    if (user?.role !== "student" || isQnAStudentMode || !user?.user_id || !caseId) {
      setPeerCompareEntries([]);
      setSelectedPeerId("");
      return;
    }

    let cancelled = false;

    const loadPeerCompareEntries = async () => {
      try {
        const usersRes = await fetch(`${API_BASE}/api/admin/users`);
        const usersList = usersRes.ok ? await usersRes.json() : [];
        const userById = new Map<string, any>();
        if (Array.isArray(usersList)) {
          for (const u of usersList) {
            const uid = String(u?.id || u?.user_id || "");
            if (uid) userById.set(uid, u);
          }
        }

        const resolvePeerIdentity = (peerId: string) => {
          const userInfo = userById.get(String(peerId));
          const normalizedRole = String(userInfo?.role || "student").trim().toLowerCase();
          const role: "student" | "instructor" =
            normalizedRole === "instructor" || normalizedRole === "admin"
              ? "instructor"
              : "student";
          return {
            firstName: userInfo?.firstName || "Peer",
            lastName: userInfo?.lastName || String(peerId).slice(-4),
            role,
          };
        };

        const normalizeAnnotations = (value: any) => {
          if (Array.isArray(value)) return value;
          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
          return [];
        };

        const toTimestamp = (value: any) => {
          const ts = new Date(value ?? 0).getTime();
          return Number.isFinite(ts) ? ts : 0;
        };

        const entryById = new Map<string, PeerCompareEntry>();

        const res = await fetch(`${API_BASE}/api/instructor/submissions`);
        const rows = res.ok ? await res.json() : [];

        const addEntry = (entry: PeerCompareEntry) => {
          const existing = entryById.get(entry.id);
          if (!existing || new Date(entry.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
            entryById.set(entry.id, entry);
          }
        };

        for (const row of Array.isArray(rows) ? rows : []) {
          const sameCase = String(row?.case_id || "") === String(caseId);
          const isOtherStudent = String(row?.student_id || "") !== String(user.user_id);
          const annotations = normalizeAnnotations(row?.annotations);
          const hasAnnotations = annotations.length > 0;
          if (!sameCase || !isOtherStudent || !hasAnnotations) continue;

          const sid = String(row.student_id || "unknown");
          const identity = resolvePeerIdentity(sid);
          const createdAt = row?.updated_at ?? row?.created_at ?? new Date().toISOString();
          const entryId = `submission:${String(row?.id || `${sid}:${toTimestamp(createdAt)}`)}`;

          addEntry({
            id: entryId,
            user: {
              id: sid,
              firstName: identity.firstName,
              lastName: identity.lastName,
              role: identity.role,
            },
            annotations,
            color: PEER_COLORS[Math.abs(sid.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % PEER_COLORS.length],
            visible: false,
            createdAt,
          });
        }

        const versionsRes = await fetch(`${API_BASE}/annotations/version/case/${encodeURIComponent(caseId)}`);
        const versionRows = versionsRes.ok ? await versionsRes.json() : [];
        for (const row of Array.isArray(versionRows) ? versionRows : []) {
          const sid = String(row?.userId || row?.user_id || "");
          if (!sid || sid === String(user.user_id)) continue;

          const identity = resolvePeerIdentity(sid);
          if (identity.role !== "student") continue;

          const annotations = normalizeAnnotations(row?.annotations);
          if (annotations.length === 0) continue;

          const createdAt = row?.updatedAt ?? row?.createdAt ?? new Date().toISOString();
          const baseVersionId = String(row?.id || row?._id || row?.version || "").trim();
          const entryId = `version:${baseVersionId || `${sid}:${toTimestamp(createdAt)}`}`;

          addEntry({
            id: entryId,
            user: {
              id: sid,
              firstName: identity.firstName,
              lastName: identity.lastName,
              role: identity.role,
            },
            annotations,
            color: PEER_COLORS[Math.abs(sid.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % PEER_COLORS.length],
            visible: false,
            createdAt,
          });
        }

        const entries: PeerCompareEntry[] = Array.from(entryById.values()).sort(
          (a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt)
        );

        if (!cancelled) {
          setPeerCompareEntries(entries);
          setSelectedPeerId((prev) => {
            if (prev && entries.some((entry) => entry.id === prev)) return prev;
            return entries[0]?.id ?? "";
          });
        }
      } catch {
        if (!cancelled) {
          setPeerCompareEntries([]);
          setSelectedPeerId("");
        }
      }
    };

    loadPeerCompareEntries();

    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.user_id, isQnAStudentMode, hw?.id, caseId, annotation.annotations.length]);

  useEffect(() => {
    let cancelled = false;

    const loadCasePageData = async () => {
      if (!caseId) {
        if (!cancelled) {
          setPageLoading(false);
          setPageError("Missing case id");
        }
        return;
      }

      try {
        setPageLoading(true);
        setPageError(null);

        const [casesRes, homeworkRes] = await Promise.all([
          fetch(`${API_BASE}/api/instructor/cases`),
          fetch(`${API_BASE}/api/instructor/homeworks/by-case?caseId=${encodeURIComponent(caseId)}&userId=${encodeURIComponent(user?.user_id || "current-user")}`),
        ]);

        if (!casesRes.ok) {
          throw new Error(`Failed to load case (${casesRes.status})`);
        }

        const cases = await casesRes.json();
        const found = Array.isArray(cases)
          ? cases.find((c: any) => (c.case_id ?? c.id) === caseId)
          : null;

        if (!cancelled) {
          if (found) {
            setRemoteCase({
              id: found.case_id ?? found.id,
              title: found.title,
              description: found.description || "",
              category: found.case_type || found.category || "General",
              imageUrl: found.image_url || found.imageUrl,
              createdBy: found.author_id || found.createdBy || "",
              createdAt: found.created_at ? new Date(found.created_at) : new Date(),
            });
          } else {
            setRemoteCase(null);
          }
        }

        if (homeworkRes.ok) {
          const homeworkData = await homeworkRes.json();
          if (!cancelled) {
            const assigned = homeworkData?.assigned ?? true;
            const hwData = homeworkData?.homework ?? homeworkData;
            const qnaData = homeworkData?.qna;

            const hwId = hwData?._id || hwData?.homework_id || hwData?.homeworkId || hwData?.id || "";

            if (assigned && hwData && hwId) {
              const questionList = qnaData?.questions || hwData?.questions || [];
              const totalPoints = Array.isArray(questionList)
                ? questionList.reduce((sum: number, q: any) => sum + Number(q.points || 0), 0)
                : 0;

              setRemoteHomework({
                id: hwId,
                dueAt: hwData.due_at || new Date().toISOString(),
                closed: hwData.status !== "active",
                description: hwData.instructions || qnaData?.instructions || "Complete this assignment.",
                instructions: hwData.instructions || qnaData?.instructions || "",
                points: Number(hwData.max_points) || (totalPoints > 0 ? totalPoints : 100),
                homeworkType: (hwData.homework_type || found?.homework_type || "Annotate") as "Q&A" | "Annotate",
                audience: hwData.audience || undefined,
                visibility: String(hwData.visibility || "public").toLowerCase() === "private" ? "private" : "public",
                className: hwData.class_name || undefined,
                classYear: hwData.year || undefined,
                classIds: Array.isArray(hwData.class_ids) ? hwData.class_ids.map((id: any) => String(id)) : [],
                classLabels: Array.isArray(hwData.class_labels) ? hwData.class_labels.map((label: any) => String(label)) : [],
                password: hwData.password || undefined,
                uploads: hwData.uploads || [],
                referenceImages: Array.isArray(homeworkData?.annot?.reference_images) ? homeworkData.annot.reference_images : [],
                annotationImage: homeworkData?.annot?.annotation_image || found?.image_url || found?.imageUrl,
                questions: questionList,
              });
            } else {
              setRemoteHomework(undefined);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load annotation page data", err);
        if (!cancelled) {
          setPageError(err instanceof Error ? err.message : "Failed to load case");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    loadCasePageData();

    return () => {
      cancelled = true;
    };
  }, [caseId, user?.user_id]);

  // Heartbeat
  useHeartbeat(user?.user_id);

  // Versions
  const { mine, create } = useVersions(caseId);

  // UI state toggles
  const [showHistory, setShowHistory] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showAIVision, setShowAIVision] = useState(false);
  const [showAssignmentDetails, setShowAssignmentDetails] = useState(false);
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number | undefined>(undefined);
  const [showCaseEditor, setShowCaseEditor] = useState(false);
  const [caseLocked, setCaseLocked] = useState(false);
  const [aiChatMinimized, setAIChatMinimized] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [compare, setCompare] = useState<{ peer?: any; alpha?: number }>({});
  const [peerComparisonMode, setPeerComparisonMode] = useState<"overlay" | "side-by-side">("overlay");
  const [peerCompareEntries, setPeerCompareEntries] = useState<PeerCompareEntry[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string>("");
  const [showClosedCaseNotification, setShowClosedCaseNotification] = useState(false);

  // Case editor state
  const [editCaseTitle, setEditCaseTitle] = useState(case_?.title || "");
  const [editCaseDesc, setEditCaseDesc] = useState(case_?.description || "");
  const [editCaseCategory, setEditCaseCategory] = useState(case_?.category || "");
  const [editCaseImageFile, setEditCaseImageFile] = useState<File | null>(null);
  const [editCaseImagePreview, setEditCaseImagePreview] = useState<string>("");
  const [editCaseClasses, setEditCaseClasses] = useState<string[]>([]);
  const [caseTags, setCaseTags] = useState<Array<{ label: string; highlighted: boolean }>>([
    { label: "Fix: Overlapping regions", highlighted: true },
    { label: "Fix: Incorrect boundary", highlighted: true },
    { label: "Fix: Missed edema area", highlighted: true },
    { label: "Practice: Anatomical localization", highlighted: true },
    { label: "Practice: Contrast handling", highlighted: true },
    { label: "Practice: Annotation labeling", highlighted: true }
  ]);
  const [newTagInput, setNewTagInput] = useState("");
  
  // Homework editor state
  const [editHwDescription, setEditHwDescription] = useState(hw?.description || "");
  const [editHwPoints, setEditHwPoints] = useState(hw?.points || 0);
  const [editHwDueDate, setEditHwDueDate] = useState(hw?.dueAt ? new Date(hw.dueAt).toISOString().split('T')[0] : "");
  const [editHwPassword, setEditHwPassword] = useState(hw?.password || "");
  const [editVisibility, setEditVisibility] = useState<"public" | "private">("public");
  const [editQnaQuestions, setEditQnaQuestions] = useState<any[]>([]);
  const [homeworkTags, setHomeworkTags] = useState<Array<{ label: string; highlighted: boolean }>>([
    { label: "Identify structures", highlighted: true },
    { label: "Note abnormalities", highlighted: true }
  ]);
  const [newHomeworkTagInput, setNewHomeworkTagInput] = useState("");
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [editCaseClassIds, setEditCaseClassIds] = useState<string[]>([]);
  
  // Add Classes modal state
  const [showAddClassesModal, setShowAddClassesModal] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<Classroom[]>([]);
  const [selectedClassesInModal, setSelectedClassesInModal] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Password prompt state
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordValidated, setPasswordValidated] = useState(false);

  // Check if password is required for homework access
  useEffect(() => {
    if (pageLoading || !hw || !user) return;

    if (user.role === "student" && hw.password && !passwordValidated) {
      setShowPasswordPrompt(true);
    }
  }, [pageLoading, hw, user, passwordValidated]);

  // Load classrooms from API
  const loadClassrooms = async () => {
    try {
      setLoadingClasses(true);
      const res = await fetch(`${API_BASE}/api/classroom/all`);
      if (res.ok) {
        const data = await res.json();
        setAvailableClasses(data.classrooms ?? []);
      }
    } catch (e) {
      console.error("Failed to load classrooms", e);
    } finally {
      setLoadingClasses(false);
    }
  };

  // Load classrooms when modal opens
  useEffect(() => {
    if (showAddClassesModal) {
      if (editCaseClasses.some((label) => normalizeClassTag(label) === "all students")) {
        setSelectedClassesInModal([ALL_STUDENTS_OPTION_ID]);
      } else {
        setSelectedClassesInModal(editCaseClassIds);
      }
      loadClassrooms();
    }
  }, [showAddClassesModal, editCaseClassIds, editCaseClasses]);

  // Case image upload handler
  const handleEditCaseImageUpload = (file: File | null) => {
    if (!file) return;
    setEditCaseImageFile(file);
    const url = URL.createObjectURL(file);
    setEditCaseImagePreview(url);
  };

  const clearEditCaseImage = () => {
    setEditCaseImageFile(null);
    setEditCaseImagePreview("");
  };
  
  // Sidebar tab state: "annotate" | "collaborate" | "ai-assistant" | "homework"
  const [activeSidebarTab, setActiveSidebarTab] = useState<"annotate" | "collaborate" | "ai-assistant" | "homework">("collaborate");
  const [showTabDropdown, setShowTabDropdown] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [qnaNotes, setQnaNotes] = useState("");
  const [qnaAnswers, setQnaAnswers] = useState<Array<{ index: number; value: any }>>([]);
  const [qnaFiles, setQnaFiles] = useState<SubmissionFile[]>([]);
  const [submissionStatusOverride, setSubmissionStatusOverride] = useState<"submitted" | "grading" | "graded" | null>(null);
  const [qnaUploadingFiles, setQnaUploadingFiles] = useState(false);
  const qnaFileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const savedCanvasScrollTopRef = useRef(0);
  const lastAnnotationCountRef = useRef(0);

  const switchSidebarTab = (tab: "annotate" | "collaborate" | "ai-assistant" | "homework") => {
    if (canvasScrollRef.current) {
      savedCanvasScrollTopRef.current = canvasScrollRef.current.scrollTop;
    }
    setActiveSidebarTab(tab);
    setShowTabDropdown(false);
    requestAnimationFrame(() => {
      if (canvasScrollRef.current) {
        canvasScrollRef.current.scrollTop = savedCanvasScrollTopRef.current;
      }
    });
  };

  // Assignment requirements screen - check if already accepted (per-user per-case)
  const [showRequirements, setShowRequirements] = useState(() => {
    if (typeof window === "undefined") return true;
    const accepted = localStorage.getItem(`assignment_accepted_${caseId}_${user?.user_id}`);
    return !accepted;
  });

  const handlePeerVisibilityToggle = (entryId: string, visible: boolean) => {
    setPeerCompareEntries((prev) =>
      prev.map((peer) =>
        peer.id === entryId ? { ...peer, visible } : peer
      )
    );
  };

  const handlePeerSelectForComparison = (entryId: string) => {
    setSelectedPeerId(entryId);
    setPeerCompareEntries((prev) =>
      prev.map((peer) =>
        peer.id === entryId ? { ...peer, visible: true } : peer
      )
    );
  };

  const studentSidebarVisible =
    user?.role === "student" &&
    !showHistory &&
    !showComparison &&
    !showProperties &&
    !showAIChat &&
    !showAIVision &&
    !showAssignmentDetails;

  const studentControlsDock: "none" | "collapsed" | "expanded" =
    user?.role === "student"
      ? showAssignmentDetails || showHistory || showComparison || showProperties || showAIChat || showAIVision
        ? "expanded"
        : studentSidebarVisible
          ? (sidebarExpanded ? "expanded" : "collapsed")
          : "none"
      : "none";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showRequirements) {
      localStorage.setItem(`assignment_accepted_${caseId}_${user?.user_id}`, "true");
    }
  }, [showRequirements, caseId, user?.user_id]);

  const handleAcceptRequirements = () => {
    setShowRequirements(false);
    // Show closed case notification if case is closed (students only)
    if (hw?.closed && user?.role === 'student') {
      setShowClosedCaseNotification(true);
    }
  };

  // Timer state - persistent with localStorage and scoped per-user
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem(timerKey);
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(timerKey, elapsedSeconds.toString());
  }, [elapsedSeconds, timerKey]);

  // Only run the timer for student users and after requirements are accepted
  useEffect(() => {
    if (!isQnAStudentMode) return;
    setActiveSidebarTab((prev) => (prev === "annotate" ? "homework" : prev));
    setShowHistory(false);
    setShowComparison(false);
    setShowProperties(false);
    setShowAIVision(false);
  }, [isQnAStudentMode]);

  useEffect(() => {
    if (!isQnAStudentMode) return;
    const sourceNotes = indexedSubmission?.notes ?? submission?.notes;
    const sourceAnswers = indexedSubmission?.answers ?? submission?.answers;
    const sourceFiles = indexedSubmission?.files ?? submission?.files;
    const sourceStatus = indexedSubmission?.score != null
      ? "graded"
      : indexedSubmission?.status ?? submission?.status;

    setQnaNotes(sourceNotes || "");
    setQnaAnswers(sourceAnswers || []);
    setQnaFiles(sourceFiles || []);
    if (sourceStatus && sourceStatus !== "none") {
      setSubmissionStatusOverride(null);
    }
  }, [
    isQnAStudentMode,
    submission?.notes,
    submission?.answers,
    submission?.files,
    submission?.status,
    indexedSubmission?.notes,
    indexedSubmission?.answers,
    indexedSubmission?.files,
    indexedSubmission?.status,
    indexedSubmission?.score,
  ]);

  useEffect(() => {
    const sourceStatus = indexedSubmission?.score != null
      ? "graded"
      : indexedSubmission?.status ?? submission?.status;
    if (sourceStatus && sourceStatus !== "none") {
      setSubmissionStatusOverride(null);
    }
  }, [submission?.status, indexedSubmission?.status, indexedSubmission?.score]);

  useEffect(() => {
    lastAnnotationCountRef.current = annotation.annotations.length;
  }, [caseId]);

  useEffect(() => {
    if (showRequirements) return;
    if (user?.role !== "student") return; // instructors don't have per-user timers here
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [showRequirements, user?.user_id, user?.role]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!user) setLocation("/login");
  }, [user, setLocation]);

  // Keyboard shortcuts
  useEffect(() => {
    if (isQnAStudentMode) return;
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === "Delete" && annotation.selectedAnnotationIds.length > 0) {
        annotation.deleteSelectedAnnotations();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "c" &&
        annotation.selectedAnnotationIds.length > 0
      ) {
        e.preventDefault();
        // annotation.copySelectedAnnotations(); // Assuming this exists on your hook
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        // annotation.pasteAnnotations(); // Assuming this exists on your hook
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "d" &&
        annotation.selectedAnnotationIds.length > 0
      ) {
        e.preventDefault();
        annotation.duplicateAnnotations(annotation.selectedAnnotationIds);
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [annotation, isQnAStudentMode]);

  // Auto-open properties on selection, but do not force-close on deselection.
  useEffect(() => {
    if (isQnAStudentMode) {
      setShowProperties(false);
      return;
    }
    if (annotation.selectedAnnotationIds.length > 0) {
      setShowProperties(true);
    }
  }, [annotation.selectedAnnotationIds, isQnAStudentMode]);

  const handleBack = () => {
    if (user?.role === "student") setLocation("/student");
    else setLocation("/instructor");
  };

  useEffect(() => {
    if (case_) {
      setEditCaseTitle(case_.title || "");
      setEditCaseDesc(case_.description || "");
      setEditCaseCategory(case_.category || "");
    }
  }, [case_?.id, case_?.title, case_?.description, case_?.category]);

  useEffect(() => {
    if (hw) {
      setEditHwDescription(hw.description || "");
      setEditHwPoints(hw.points || 0);
      setEditHwDueDate(hw?.dueAt ? new Date(hw.dueAt).toISOString().split('T')[0] : "");
      setEditHwPassword(hw?.password || "");
      setEditVisibility(hw?.visibility || "public");
      setEditQnaQuestions(Array.isArray(hw?.questions) ? hw.questions : []);
      const tags: string[] = [];
      if (hw.audience === "All Students") {
        tags.push("All students");
      }
      if (Array.isArray(hw.classLabels) && hw.classLabels.length > 0) {
        tags.push(...hw.classLabels);
      } else if (hw.className) {
        tags.push(`${hw.className}${hw.classYear ? ` (${hw.classYear})` : ""}`);
      }
      const uniqueTags = dedupeClassTags(tags);
      setAssignedClasses(uniqueTags);
      setEditCaseClasses(uniqueTags);
      setEditCaseClassIds(dedupeClassIds(Array.isArray(hw.classIds) ? hw.classIds : []));
    } else {
      setAssignedClasses([]);
      setEditCaseClasses([]);
      setEditCaseClassIds([]);
      setEditHwPassword("");
      setEditVisibility("public");
      setEditQnaQuestions([]);
    }
  }, [hw?.id, hw?.description, hw?.points, hw?.dueAt, hw?.audience, hw?.className, hw?.classYear, hw?.classIds, hw?.classLabels, hw?.password, hw?.visibility, hw?.questions]);

  const handlePanelWheel = useCallback((e: React.WheelEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight <= el.clientHeight) return;

    e.preventDefault();
    e.stopPropagation();
    el.scrollTop += e.deltaY;
  }, []);

  useEffect(() => {
    const versions = annotation.versions || [];
    if (versions.length === 0) {
      setCurrentVersionNumber(undefined);
      return;
    }

    const knownVersions = new Set(
      versions
        .map((v: any) => v?.version)
        .filter((v: any) => typeof v === "number"),
    );

    if (currentVersionNumber == null || !knownVersions.has(currentVersionNumber)) {
      setCurrentVersionNumber(versions[0]?.version);
    }
  }, [annotation.versions, currentVersionNumber]);

  const submissionStatusStorageKey =
    typeof window !== "undefined" && user?.user_id && hw?.id
      ? `submission_status_${caseId}_${user.user_id}_${hw.id}`
      : "";

  const isServerStatusKnown = Boolean(submission?.status && submission.status !== "none");
  const qnaDraftStorageKey =
    typeof window !== "undefined" && user?.user_id && hw?.id
      ? `qna_draft_${caseId}_${user.user_id}_${hw.id}`
      : "";

  useEffect(() => {
    if (!submissionStatusStorageKey || isServerStatusKnown) return;
    const saved = localStorage.getItem(submissionStatusStorageKey);
    if (saved === "submitted" || saved === "grading" || saved === "graded") {
      setSubmissionStatusOverride(saved);
    }
  }, [submissionStatusStorageKey, isServerStatusKnown]);

  useEffect(() => {
    if (!submissionStatusStorageKey) return;

    const statusToPersist =
      submission?.score != null
        ? "graded"
        : submission?.status && submission.status !== "none"
        ? submission.status
        : submissionStatusOverride;

    if (statusToPersist) {
      localStorage.setItem(submissionStatusStorageKey, statusToPersist);
    }
  }, [submissionStatusStorageKey, submission?.status, submissionStatusOverride]);

  useEffect(() => {
    if (!isQnAStudentMode || !qnaDraftStorageKey) return;
    const hasServerData = Boolean(
      (submission?.status && submission.status !== "none") ||
        (submission?.notes && submission.notes.trim().length > 0) ||
        (submission?.answers && submission.answers.length > 0) ||
        (submission?.files && submission.files.length > 0)
    );
    if (hasServerData) return;

    const savedDraft = localStorage.getItem(qnaDraftStorageKey);
    if (!savedDraft) return;

    try {
      const parsed = JSON.parse(savedDraft) as {
        notes?: string;
        answers?: Array<{ index: number; value: any }>;
        files?: SubmissionFile[];
      };

      if (typeof parsed.notes === "string") {
        setQnaNotes(parsed.notes);
      }
      if (Array.isArray(parsed.answers)) {
        setQnaAnswers(parsed.answers);
      }
      if (Array.isArray(parsed.files)) {
        setQnaFiles(parsed.files);
      }
    } catch {
      // Ignore invalid draft payloads.
    }
  }, [
    isQnAStudentMode,
    qnaDraftStorageKey,
    submission?.status,
    submission?.notes,
    submission?.answers,
    submission?.files,
  ]);

  useEffect(() => {
    if (!isQnAStudentMode || !qnaDraftStorageKey) return;

    const statusForDraft =
      submission?.score != null
        ? "graded"
        : submission?.status && submission.status !== "none"
        ? submission.status
        : submissionStatusOverride ?? "none";

    const shouldPersistDraft =
      statusForDraft === "none" || statusForDraft === "submitted";

    if (!shouldPersistDraft) {
      localStorage.removeItem(qnaDraftStorageKey);
      return;
    }

    const payload = JSON.stringify({
      notes: qnaNotes,
      answers: qnaAnswers,
      files: qnaFiles,
    });

    localStorage.setItem(qnaDraftStorageKey, payload);
  }, [
    isQnAStudentMode,
    qnaDraftStorageKey,
    qnaNotes,
    qnaAnswers,
    qnaFiles,
    submission?.score,
    submission?.status,
    submissionStatusOverride,
  ]);

  if (!user || pageLoading) {
    return <div>Loading...</div>;
  }

  if (pageError && !case_) {
    return <div className="p-6 text-sm text-muted-foreground">{pageError}</div>;
  }

  if (!case_) {
    return <div className="p-6 text-sm text-muted-foreground">Case not found.</div>;
  }

  // Show assignment requirements first (students only)
  if (showRequirements && user?.role === 'student') {
    return (
      <AssignmentRequirements
        case={case_}
        homework={hw}
        onReturn={handleBack}
        onAccept={handleAcceptRequirements}
      />
    );
  }

  // Save a version (both local + collaborative)
  const handleSaveVersion = async () => {
    try {
      await annotation.saveAllAnnotationsSnapshot();
      const payload = {
        boxes: annotation.annotations,
        notes: JSON.stringify({
          tool: annotation.tool,
          color: annotation.color,
          timestamp: new Date().toISOString(),
        }),
      };
      await create(payload);
      console.log("Saved version:", payload);
    } catch (e) {
      console.error("Save version failed", e);
    }
  };

  const myAnnotationVersions = annotation.versions.map((v: any) => ({
    id: v.id || v._id || `version-${v.version}`,
    caseId,
    authorId: v.userId || user?.user_id || "current-user",
    authorName:
      user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.email || "Me",
    createdAt: v.createdAt || new Date().toISOString(),
    data: {
      boxes: Array.isArray(v.annotations) ? v.annotations : [],
      notes: `Version ${v.version ?? "-"}`,
    },
  }));

  const handleRestoreVersion = async (version: any) => {
    await annotation.restoreVersion(version);
    setCurrentVersionNumber(version?.version);
    toast({
      title: "Version restored",
      description: `Restored version v${version?.version ?? "-"}`,
    });
  };

  const handleDeleteVersion = async (versionId: string) => {
    await annotation.deleteVersion(versionId);
    toast({
      title: "Version deleted",
      description: "Version history refreshed.",
    });
  };

  // Compare toggle
  const handleCompareChange = (peer?: any, alpha = 0.4) => {
    setCompare({ peer, alpha });
    if (peer?.id) {
      setSelectedPeerId(peer.id);
      setPeerCompareEntries((prev) =>
        prev.map((entry) =>
          entry.id === peer.id ? { ...entry, visible: true } : entry
        )
      );
    }
  };

  const visiblePeerAnnotations = peerCompareEntries.filter((entry) => entry.visible);
  const selectedPeerAnnotations =
    peerCompareEntries.find((entry) => entry.id === selectedPeerId)?.annotations || [];

  const comparePeers = peerCompareEntries.map((entry) => ({
    id: entry.id,
    caseId,
    authorId: entry.user.id,
    authorName: `${entry.user.firstName} ${entry.user.lastName}`,
    createdAt: entry.createdAt,
    data: {
      boxes: entry.annotations,
      notes: `Peer ${entry.user.id}`,
    },
  }));

  const qnaQuestions = Array.isArray(hw?.questions) ? hw.questions : [];

  const indexedStatus = indexedSubmission?.score != null
    ? "graded"
    : indexedSubmission?.status;

  const effectiveSubmissionStatus =
    indexedStatus && indexedStatus !== "none"
      ? indexedStatus
      : submission?.score != null
      ? "graded"
      : submission?.status && submission.status !== "none"
      ? submission.status
      : submissionStatusOverride ?? "none";

  const effectiveSubmissionScore = indexedSubmission?.score ?? submission?.score;
  const effectiveSubmissionNotes = indexedSubmission?.notes ?? submission?.notes;
  const effectiveSubmissionFiles = indexedSubmission?.files ?? submission?.files;
  const effectiveSubmissionAnswers = indexedSubmission?.answers ?? submission?.answers;
  const effectiveTeacherFeedback = indexedSubmission?.feedback ?? null;

  const isMarkedSubmission = effectiveSubmissionScore != null || effectiveSubmissionStatus === "graded";

  const getQnaAnswerValue = (index: number) =>
    qnaAnswers.find((answer) => answer.index === index)?.value ?? "";

  const setQnaAnswerValue = (index: number, value: any) => {
    setQnaAnswers((prev) => {
      const next = [...prev];
      const foundIndex = next.findIndex((answer) => answer.index === index);
      if (foundIndex >= 0) {
        next[foundIndex] = { index, value };
      } else {
        next.push({ index, value });
      }
      return next;
    });
  };

  const handleQnAFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (!hw) {
      toast({
        title: "No homework assigned",
        description: "Attach files is only available when a homework is assigned.",
        variant: "destructive",
      });
      return;
    }

    if (hw.closed || isMarkedSubmission) {
      toast({
        title: "Submission locked",
        description: "This assignment can no longer accept file attachments.",
        variant: "destructive",
      });
      return;
    }

    setQnaUploadingFiles(true);
    try {
      for (const file of selectedFiles) {
        const uploaded = await uploadFile(file);
        if (uploaded) {
          setQnaFiles((prev) => [...prev, uploaded]);
        }
      }
    } finally {
      setQnaUploadingFiles(false);
      if (qnaFileInputRef.current) qnaFileInputRef.current.value = "";
    }
  };

  const removeQnAFile = (index: number) => {
    setQnaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submitQnAResponses = async () => {
    if (!hw?.id) {
      toast({
        title: "No homework assigned",
        description: "This case does not have an active homework yet.",
        variant: "destructive",
      });
      return;
    }

    if (hw.closed) {
      toast({
        title: "Assignment closed",
        description: "This assignment is closed and cannot accept submissions.",
        variant: "destructive",
      });
      return;
    }

    if (isMarkedSubmission) {
      toast({
        title: "Already marked",
        description: "This assignment is marked and can no longer be submitted.",
        variant: "destructive",
      });
      return;
    }

    if (effectiveSubmissionStatus === "submitted" || effectiveSubmissionStatus === "grading") {
      const shouldResubmit = window.confirm(
        "You have already submitted this homework. Do you want to submit again and replace your previous submission?"
      );
      if (!shouldResubmit) return;
    }

    const result = await submitHomework({
      notes: qnaNotes,
      files: qnaFiles,
      answers: qnaAnswers,
    });

    if (result) {
      setSubmissionStatusOverride(result.status && result.status !== "none" ? result.status : "submitted");
      if (qnaDraftStorageKey) {
        localStorage.removeItem(qnaDraftStorageKey);
      }
      fetchSubmission();
    }
  };

  const handleValidatePassword = async () => {
    if (!passwordInput.trim()) {
      setPasswordError("Password is required");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/instructor/homeworks/validate-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          password: passwordInput.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          setPasswordValidated(true);
          setShowPasswordPrompt(false);
          setPasswordError("");
        } else {
          setPasswordError("Incorrect password");
        }
      } else {
        setPasswordError("Failed to validate password");
      }
    } catch (error) {
      setPasswordError("Network error. Please try again.");
    }
  };

  // Show password prompt if required
  if (showPasswordPrompt && user?.role === 'student') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Dialog open={showPasswordPrompt} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Homework Password Required</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This homework requires a password to access. Please enter the password provided by your instructor.
              </p>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Enter password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleValidatePassword();
                    }
                  }}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-sm text-red-600">{passwordError}</p>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleBack}>
                  Cancel
                </Button>
                <Button onClick={handleValidatePassword}>
                  Submit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden silver-ambient flex flex-col" data-testid="annotation-view">
      {/* Case Locked Notification (students only) */}
      {caseLocked && user?.role === 'student' && (
        <div className="bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800 px-6 py-3">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-semibold text-sm text-red-800 dark:text-red-200">Case Locked</p>
              <p className="text-xs text-red-700 dark:text-red-300">This case is currently locked by the instructor. You cannot make changes at this time.</p>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">
              {case_.title} - {isQnAStudentMode ? "Q&A Assignment" : "Annotation"}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            {/* Assignment Details Button (students only) */}
            {user?.role === 'student' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAssignmentDetails(!showAssignmentDetails)}
                className={showAssignmentDetails ? "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800" : ""}
              >
                <Info className="h-4 w-4 mr-2" />
                Details
              </Button>
            )}

            {/* Timer Display (students only) */}
            {user?.role === 'student' && (
              <>
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-muted rounded-lg">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-mono font-medium">{formatTime(elapsedSeconds)}</span>
                </div>

                {!isQnAStudentMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAIVision(!showAIVision)}
                    className={showAIVision ? "bg-purple-50 border-purple-200" : ""}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    AI Vision
                  </Button>
                )}
              </>
            )}
            {user?.role === 'student' && !isQnAStudentMode && (
              <Button
                className="bg-primary text-primary-foreground hover:opacity-90"
                onClick={handleSaveVersion}
                data-testid="button-save"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Version
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Annotation Toolbar (Horizontal at top) */}
      {user?.role === 'student' && !isQnAStudentMode && (
        <AnnotationToolbar
          annotation={annotation}
          onToggleHistory={() => setShowHistory(!showHistory)}
          onToggleComparison={() => {
            const next = !showComparison;
            setShowComparison(next);
            if (next) {
              switchSidebarTab("annotate");
            }
          }}
          showHistory={showHistory}
          showComparison={showComparison}
        />
      )}

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas area */}
        <main className="flex-1 flex overflow-hidden relative">
          {/* Canvas */}
          <div
            ref={canvasScrollRef}
            className="flex-1 p-0 overflow-auto"
            onScroll={() => {
              if (canvasScrollRef.current) {
                savedCanvasScrollTopRef.current = canvasScrollRef.current.scrollTop;
              }
            }}
          >
            {isQnAHomework ? (
              <div className="p-6 space-y-6">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-semibold">{case_.title}</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          {case_.description || "Answer the questions below and submit your work."}
                        </p>
                      </div>
                    </div>

                    {hw?.instructions && (
                      <div className="rounded-lg border p-4 bg-card">
                        <div className="font-medium mb-2">Instructions</div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {hw.instructions}
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Questions</h3>
                      {qnaQuestions.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          No questions are available for this homework yet.
                        </div>
                      ) : (
                        qnaQuestions.map((question: any, index: number) => (
                          <div key={index} className="rounded-lg border bg-card p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">Question {index + 1}</p>
                                <p className="text-sm mt-1 whitespace-pre-wrap">{question.prompt}</p>
                              </div>
                              <Badge variant="secondary">{Number(question.points || 0)} pts</Badge>
                            </div>

                            {question.guidance && (
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{question.guidance}</p>
                            )}

                            {(question.image_url || question.imageUrl) && (
                              <div className="overflow-hidden rounded-md border bg-muted/30">
                                <img
                                  src={question.image_url || question.imageUrl}
                                  alt={`Question ${index + 1}`}
                                  className="max-h-64 w-full object-contain bg-background"
                                />
                              </div>
                            )}

                            {question.type === "mcq" && Array.isArray(question.options) ? (
                              <div className="space-y-2">
                                {question.options.map((option: string, optionIndex: number) => (
                                  <label key={optionIndex} className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`qna-question-${index}`}
                                      checked={String(getQnaAnswerValue(index)) === String(optionIndex)}
                                      onChange={() => setQnaAnswerValue(index, optionIndex)}
                                      disabled={user?.role !== "student" || hw?.closed || subLoading || effectiveSubmissionStatus === "graded"}
                                    />
                                    <span>{option}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <Textarea
                                value={String(getQnaAnswerValue(index) || "")}
                                onChange={(e) => setQnaAnswerValue(index, e.target.value)}
                                placeholder="Type your answer here..."
                                className="min-h-[120px]"
                                disabled={user?.role !== "student" || hw?.closed || subLoading || effectiveSubmissionStatus === "graded"}
                              />
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Additional Notes</label>
                      <Textarea
                        value={qnaNotes}
                        onChange={(e) => setQnaNotes(e.target.value)}
                        placeholder="Optional notes for your instructor..."
                        className="min-h-[100px]"
                        disabled={user?.role !== "student" || hw?.closed || subLoading || effectiveSubmissionStatus === "graded"}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm font-medium">Attached Files</label>
                        {user?.role === "student" && !hw?.closed && effectiveSubmissionStatus !== "graded" && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => qnaFileInputRef.current?.click()}
                            disabled={subLoading || qnaUploadingFiles}
                            className="shrink-0"
                          >
                            {qnaUploadingFiles ? "Uploading..." : "Add Files"}
                          </Button>
                        )}
                      </div>

                      <input
                        ref={qnaFileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        aria-label="Attach files"
                        title="Attach files"
                        onChange={handleQnAFileSelect}
                        disabled={user?.role !== "student" || hw?.closed || subLoading || effectiveSubmissionStatus === "graded" || qnaUploadingFiles}
                      />

                      {qnaFiles.length > 0 ? (
                        <div className="space-y-2">
                          {qnaFiles.map((file, idx) => (
                            <div key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-xs">
                              <span className="truncate">{file.name}</span>
                              {user?.role === "student" && !hw?.closed && effectiveSubmissionStatus !== "graded" && (
                                <button
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => removeQnAFile(idx)}
                                  aria-label={`Remove ${file.name}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No files attached yet.</p>
                      )}
                    </div>

                    {user?.role === "student" && (
                      <div className="flex justify-end">
                        <Button
                          onClick={submitQnAResponses}
                          disabled={hw?.closed || subLoading || effectiveSubmissionStatus === "graded"}
                        >
                          {subLoading ? "Submitting..." : "Submit Q&A Answers"}
                        </Button>
                      </div>
                    )}

                    {effectiveSubmissionStatus === "graded" && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        This homework is marked. Further submissions and file updates are locked.
                      </div>
                    )}

                  </CardContent>
                </Card>
              </div>
            ) : (
              <AnnotationCanvas
                imageUrl={case_.imageUrl}
                annotation={annotation}
                peerAnnotations={visiblePeerAnnotations}
                compareMode={peerComparisonMode}
                selectedPeerAnnotations={selectedPeerAnnotations as any}
                peerOpacity={compare.alpha || 0.5}
                controlsDock={studentControlsDock}
              />
            )}
          </div>

          {user?.role === 'instructor' && (
            <aside className="w-72 bg-card border-l border-border overflow-y-auto flex flex-col">
              {/* Case Management Header with Buttons */}
              <div className="p-3 border-b border-border space-y-2">
                <h3 className="font-semibold text-sm">Case Management</h3>
                <div className="space-y-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full" 
                    onClick={() => setShowCaseEditor(!showCaseEditor)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Case
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full" 
                    onClick={() => setCaseLocked(!caseLocked)}
                  >
                    {caseLocked ? (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Unlock Case
                      </>
                    ) : (
                      <>
                        <LockOpen className="h-4 w-4 mr-2" />
                        Lock Case
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Case Information Section */}
              <div className="p-3 border-b border-border space-y-2">
                <h4 className="font-semibold text-sm">Case Information</h4>
                <div className="space-y-1 text-xs">
                  <div>
                    <p className="text-muted-foreground">Case Type:</p>
                    <p className="font-medium text-blue-600 dark:text-blue-400">{case_.category || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Classes:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {assignedClasses.map((cls) => (
                        <Badge key={cls} variant="outline" className="text-xs">
                          {cls}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due Date:</p>
                    <p className="font-medium">{hw?.dueAt ? new Date(hw.dueAt).toISOString().split('T')[0] : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status:</p>
                    <p className="font-medium">{caseLocked ? "🔒 Locked" : "🔓 Active"}</p>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div className="p-3 border-b border-border space-y-2 flex-1 overflow-y-auto">
                <h4 className="font-semibold text-sm">Description</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {case_.description || "No description available."}
                </p>
              </div>
              
              {/* Case Editor Modal Dialog */}
              <Dialog open={showCaseEditor} onOpenChange={setShowCaseEditor}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <div className="flex items-center justify-between w-full">
                      <DialogTitle>Edit Case</DialogTitle>
                    </div>
                  </DialogHeader>

                  <div className="space-y-3">
                    {/* Case Image Upload */}
                    <div className="space-y-2 pb-3 border-b border-border">
                      <h4 className="text-xs font-medium text-muted-foreground">CASE IMAGE</h4>
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleEditCaseImageUpload(e.target.files?.[0] ?? null)}
                        />
                        <div
                          className={[
                            "aspect-video w-full rounded-lg border-2 border-dashed",
                            "flex items-center justify-center text-center cursor-pointer transition",
                            editCaseImagePreview ? "border-border bg-background" : "border-border hover:bg-muted/50",
                          ].join(" ")}
                        >
                          {editCaseImagePreview ? (
                            <div className="relative w-full h-full">
                              <img
                                src={editCaseImagePreview}
                                alt="Case preview"
                                className="w-full h-full object-cover rounded-lg"
                              />
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  clearEditCaseImage();
                                }}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                title="Remove image"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="p-4">
                              <p className="text-xs text-muted-foreground">Click to upload case image</p>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* Case Information Section */}
                    <div className="space-y-2 pb-3 border-b border-border">
                      <h4 className="text-xs font-medium text-muted-foreground">CASE DETAILS</h4>
                      <div>
                        <label htmlFor="edit-case-title" className="block text-xs font-medium mb-1">Case Title</label>
                        <input
                          id="edit-case-title"
                          type="text"
                          value={editCaseTitle}
                          onChange={(e) => setEditCaseTitle(e.target.value)}
                          placeholder="Case title"
                          title="Case Title"
                          className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-case-desc" className="block text-xs font-medium mb-1">Description</label>
                        <textarea
                          id="edit-case-desc"
                          value={editCaseDesc}
                          onChange={(e) => setEditCaseDesc(e.target.value)}
                          placeholder="Case description"
                          title="Case Description"
                          className="w-full px-3 py-1.5 text-xs border border-border rounded-md bg-background"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-case-category" className="block text-xs font-medium mb-1">Case Type (Specialty)</label>
                        <select
                          id="edit-case-category"
                          value={editCaseCategory}
                          onChange={(e) => setEditCaseCategory(e.target.value)}
                          title="Case Type"
                          className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-background"
                        >
                          <option value="">Select a case type</option>
                          <option value="Neurology">Neurology</option>
                          <option value="Pulmonology">Pulmonology</option>
                          <option value="Cardiology">Cardiology</option>
                          <option value="Gastroenterology">Gastroenterology</option>
                          <option value="Oncology">Oncology</option>
                          <option value="Radiology">Radiology</option>
                          <option value="Orthopedics">Orthopedics</option>
                        </select>
                      </div>
                    </div>

                    {/* Suggested Focus Tags Section */}
                    <div className="space-y-2 pb-3 border-b border-border">
                      <h4 className="text-xs font-medium text-muted-foreground">SUGGESTED FOCUS</h4>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {caseTags.map((tag, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setCaseTags(caseTags.map((t, i) => 
                                  i === idx ? { ...t, highlighted: !t.highlighted } : t
                                ));
                              }}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                tag.highlighted
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 ring-1 ring-blue-300'
                                  : 'bg-muted text-muted-foreground opacity-50'
                              } hover:ring-1 hover:ring-blue-300 cursor-pointer`}
                              title={`Click to ${tag.highlighted ? 'remove highlight' : 'highlight'}`}
                            >
                              {tag.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && newTagInput.trim()) {
                                setCaseTags([...caseTags, { label: newTagInput.trim(), highlighted: true }]);
                                setNewTagInput("");
                              }
                            }}
                            placeholder="Add new focus area (press Enter)"
                            className="flex-1 px-3 py-1.5 text-xs border border-border rounded-md bg-background"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (newTagInput.trim()) {
                                setCaseTags([...caseTags, { label: newTagInput.trim(), highlighted: true }]);
                                setNewTagInput("");
                              }
                            }}
                            className="px-2"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Homework Assignment Section */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground">HOMEWORK ASSIGNMENT</h4>
                      
                      {hw ? (
                        <div className="space-y-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-2 rounded-lg">
                          <div>
                            <label htmlFor="hw-description" className="block text-xs font-medium mb-1">Description</label>
                            <textarea
                              id="hw-description"
                              value={editHwDescription}
                              onChange={(e) => setEditHwDescription(e.target.value)}
                              title="Homework Description"
                              className="w-full px-3 py-1.5 text-xs border border-border rounded-md bg-background"
                              rows={2}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label htmlFor="hw-points" className="block text-xs font-medium mb-1">Maximum Points</label>
                              <input
                                id="hw-points"
                                type="number"
                                value={editHwPoints}
                                onChange={(e) => setEditHwPoints(parseInt(e.target.value) || 0)}
                                title="Maximum Points"
                                className="w-full px-3 py-1.5 text-xs border border-border rounded-md bg-background"
                              />
                            </div>
                            <div>
                              <label htmlFor="hw-visibility" className="block text-xs font-medium mb-1">Visibility</label>
                              <select
                                id="hw-visibility"
                                value={editVisibility}
                                onChange={(e) => setEditVisibility(e.target.value as "public" | "private")}
                                title="Visibility"
                                className="w-full px-3 py-1.5 text-xs border border-border rounded-md bg-background"
                              >
                                <option value="public">Public</option>
                                <option value="private">Private</option>
                              </select>
                            </div>
                            <div>
                              <label htmlFor="hw-duedate" className="block text-xs font-medium mb-1">Due Date</label>
                              <input
                                id="hw-duedate"
                                type="date"
                                value={editHwDueDate}
                                onChange={(e) => setEditHwDueDate(e.target.value)}
                                title="Due Date"
                                className="w-full px-3 py-1.5 text-xs border border-border rounded-md bg-background"
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="hw-password" className="block text-xs font-medium mb-1">Change Password</label>
                            <input
                              id="hw-password"
                              type="text"
                              value={editHwPassword}
                              onChange={(e) => setEditHwPassword(e.target.value)}
                              title="Change Password"
                              placeholder="Leave empty to remove password"
                              className="w-full px-3 py-1.5 text-xs border border-border rounded-md bg-background"
                            />
                          </div>

                          {hw?.homeworkType === "Q&A" && (
                            <div className="space-y-2">
                              <h5 className="text-xs font-semibold text-muted-foreground">Q&A Questions (Student Layout)</h5>
                              {editQnaQuestions.length === 0 ? (
                                <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3">
                                  No Q&A questions configured.
                                </div>
                              ) : (
                                <div className="space-y-3 max-h-72 overflow-auto pr-1">
                                  {editQnaQuestions.map((question, index) => (
                                    <div key={index} className="rounded-lg border p-3 bg-background space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs font-medium">Question {index + 1}</p>
                                        <span className="text-[10px] px-2 py-0.5 rounded border">
                                          {question.type === "mcq" ? "MCQ" : "Essay"}
                                        </span>
                                      </div>

                                      <textarea
                                        value={question.prompt || ""}
                                        onChange={(e) => {
                                          const next = [...editQnaQuestions];
                                          next[index] = { ...next[index], prompt: e.target.value };
                                          setEditQnaQuestions(next);
                                        }}
                                        rows={2}
                                        className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
                                        placeholder="Question prompt"
                                      />

                                      {(question.image_url || question.imageUrl) && (
                                        <div className="overflow-hidden rounded-md border bg-muted/30">
                                          <img
                                            src={question.image_url || question.imageUrl}
                                            alt={`Question ${index + 1}`}
                                            className="max-h-40 w-full object-contain"
                                          />
                                        </div>
                                      )}

                                      <div className="grid grid-cols-2 gap-2">
                                        <input
                                          type="number"
                                          value={Number(question.points || 0)}
                                          onChange={(e) => {
                                            const next = [...editQnaQuestions];
                                            next[index] = { ...next[index], points: Number(e.target.value) || 0 };
                                            setEditQnaQuestions(next);
                                          }}
                                          className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
                                          title="Points"
                                        />
                                        <input
                                          value={question.guidance || ""}
                                          onChange={(e) => {
                                            const next = [...editQnaQuestions];
                                            next[index] = { ...next[index], guidance: e.target.value };
                                            setEditQnaQuestions(next);
                                          }}
                                          className="w-full px-2 py-1.5 text-xs border border-border rounded-md bg-background"
                                          placeholder="Guidance"
                                          title="Guidance"
                                        />
                                      </div>

                                      {question.type === "mcq" && Array.isArray(question.options) && (
                                        <div className="space-y-1">
                                          {question.options.map((option: string, optionIndex: number) => (
                                            <div key={optionIndex} className="flex items-center gap-2">
                                              <input
                                                value={option}
                                                onChange={(e) => {
                                                  const next = [...editQnaQuestions];
                                                  const options = [...(next[index].options || [])];
                                                  options[optionIndex] = e.target.value;
                                                  next[index] = { ...next[index], options };
                                                  setEditQnaQuestions(next);
                                                }}
                                                className="w-full px-2 py-1 text-xs border border-border rounded-md bg-background"
                                                placeholder={`Option ${optionIndex + 1}`}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-muted p-2 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground">
                            No homework assignment created yet. Create one in the instructor dashboard.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Class Tags Section */}
                    <div className="space-y-2 pb-3 border-b border-border">
                      <h4 className="text-xs font-medium text-muted-foreground">ASSIGNED CLASSES</h4>
                      <div className="flex flex-wrap gap-2">
                        {editCaseClasses.map((classLabel, index) => (
                          <div
                            key={`${classLabel}-${index}`}
                            className="flex items-center gap-2 bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-100 px-3 py-1 rounded-full text-xs"
                          >
                            <span>{classLabel}</span>
                            <button
                              onClick={() => {
                                const nextLabels = editCaseClasses.filter((_, i) => i !== index);
                                setEditCaseClasses(nextLabels);

                                if (classLabel.toLowerCase() === "all students") {
                                  return;
                                }

                                const matchedClass = availableClasses.find(
                                  (cls) => `${cls.name} (${cls.year})` === classLabel
                                );

                                if (matchedClass) {
                                  setEditCaseClassIds(editCaseClassIds.filter((id) => id !== matchedClass.id));
                                  return;
                                }

                                if (editCaseClasses.length === editCaseClassIds.length && editCaseClassIds[index]) {
                                  setEditCaseClassIds(editCaseClassIds.filter((_, i) => i !== index));
                                }
                              }}
                              className="hover:opacity-70"
                              title="Remove class"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {editCaseClasses.length === 0 && (
                          <p className="text-xs text-muted-foreground">No classes assigned yet</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddClassesModal(true)}
                        className="mt-2"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Classes
                      </Button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2\">
                      
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={async () => {
                          try {
                            const form = new FormData();
                            form.append("title", editCaseTitle);
                            form.append("description", editCaseDesc);
                            form.append("case_type", editCaseCategory);
                            if (user?.user_id) {
                              form.append("author_id", user.user_id);
                            }
                            if (editCaseImageFile) {
                              form.append("image", editCaseImageFile);
                            }

                            const res = await fetch(`${API_BASE}/api/instructor/cases/${caseId}`, {
                              method: "PUT",
                              body: form,
                            });

                            if (!res.ok) {
                              const text = await res.text();
                              console.error("Failed to update case", text);
                              throw new Error(text || "Update failed");
                            }

                            if (hw?.id) {
                              const classroomLabels = editCaseClasses.filter(
                                (label) => label.toLowerCase() !== "all students"
                              );
                              const selectedClassrooms = availableClasses.filter((cls) =>
                                editCaseClassIds.includes(cls.id)
                              );
                              const firstClass = selectedClassrooms[0];
                              const useClassroomAudience = editCaseClassIds.length > 0 || classroomLabels.length > 0;

                              const hwRes = await fetch(`${API_BASE}/api/instructor/homeworks/by-case/${caseId}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  instructions: editHwDescription,
                                  due_at: editHwDueDate ? new Date(`${editHwDueDate}T23:59:00`).toISOString() : undefined,
                                  max_points: hw?.homeworkType === "Q&A"
                                    ? editQnaQuestions.reduce((sum: number, q: any) => sum + Number(q.points || 0), 0)
                                    : editHwPoints,
                                  password: editHwPassword.trim() || null,
                                  visibility: editVisibility,
                                  questions: hw?.homeworkType === "Q&A" ? editQnaQuestions : undefined,
                                  audience: useClassroomAudience ? "Classrooms" : "All Students",
                                  class_ids: editCaseClassIds,
                                  class_labels: classroomLabels,
                                  class_name: firstClass?.name,
                                  year: firstClass?.year,
                                }),
                              });

                              if (!hwRes.ok) {
                                const hwText = await hwRes.text();
                                console.error("Failed to update homework", hwText);
                                throw new Error(hwText || "Homework update failed");
                              }
                            }

                            setAssignedClasses(editCaseClasses);
                            setRemoteHomework((prev) => {
                              if (!prev) return prev;
                              const classroomLabels = editCaseClasses.filter(
                                (label) => label.toLowerCase() !== "all students"
                              );
                              const selectedClassrooms = availableClasses.filter((cls) =>
                                editCaseClassIds.includes(cls.id)
                              );
                              const firstClass = selectedClassrooms[0];
                              return {
                                ...prev,
                                audience: editCaseClassIds.length > 0 || classroomLabels.length > 0 ? "Classrooms" : "All Students",
                                visibility: editVisibility,
                                classIds: editCaseClassIds,
                                classLabels: classroomLabels,
                                className: firstClass?.name || prev.className,
                                classYear: firstClass?.year || prev.classYear,
                                password: editHwPassword.trim() || undefined,
                                questions: hw?.homeworkType === "Q&A" ? editQnaQuestions : prev.questions,
                              };
                            });

                            toast({ description: "Case changes saved" });
                            setShowCaseEditor(false);
                          } catch (err) {
                            console.error(err);
                            toast({
                              title: "Failed to save case",
                              description: "Please try again or contact support.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Add Classes Modal */}
              <Dialog open={showAddClassesModal} onOpenChange={setShowAddClassesModal}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Classes to Case</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Select one or more classes to publish this case and homework to:
                    </p>

                    {/* Class List with Checkboxes */}
                    <div className="space-y-2 max-h-64 overflow-y-auto border border-border rounded-md p-3">
                      {loadingClasses ? (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          Loading classes...
                        </div>
                      ) : availableClasses.length === 0 ? (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          No classes available
                        </div>
                      ) : (
                        <>
                          <label className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded border border-emerald-200 dark:border-emerald-800">
                            <input
                              type="checkbox"
                              checked={selectedClassesInModal.includes(ALL_STUDENTS_OPTION_ID)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedClassesInModal([ALL_STUDENTS_OPTION_ID]);
                                } else {
                                  setSelectedClassesInModal([]);
                                }
                              }}
                              className="w-4 h-4 rounded"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium">All students</div>
                              <div className="text-xs text-muted-foreground">Publish this case to every student</div>
                            </div>
                            {editCaseClasses.some((label) => normalizeClassTag(label) === "all students") && (
                              <div className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded dark:bg-emerald-950 dark:text-emerald-300">
                                Added
                              </div>
                            )}
                          </label>

                          {availableClasses.map((cls) => (
                            <label key={cls.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded">
                              <input
                                type="checkbox"
                                checked={selectedClassesInModal.includes(cls.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedClassesInModal((prev) =>
                                      dedupeClassIds([
                                        ...prev.filter((id) => id !== ALL_STUDENTS_OPTION_ID),
                                        cls.id,
                                      ])
                                    );
                                  } else {
                                    setSelectedClassesInModal((prev) => prev.filter((c) => c !== cls.id));
                                  }
                                }}
                                className="w-4 h-4 rounded"
                              />
                              <div className="flex-1">
                                <div className="text-sm font-medium">{cls.name}</div>
                                <div className="text-xs text-muted-foreground">{cls.year} • {cls.members_count} students</div>
                              </div>
                              {editCaseClassIds.includes(cls.id) && (
                                <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded dark:bg-green-950 dark:text-green-300">
                                  Added
                                </div>
                              )}
                            </label>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Selected Count */}
                    <div className="text-sm text-muted-foreground">
                      {selectedClassesInModal.length > 0 
                        ? `${selectedClassesInModal.length} class(es) selected`
                        : "No classes selected"
                      }
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddClassesModal(false);
                          setSelectedClassesInModal([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={loadingClasses || selectedClassesInModal.length === 0}
                        onClick={() => {
                          if (selectedClassesInModal.includes(ALL_STUDENTS_OPTION_ID)) {
                            setEditCaseClassIds([]);
                            setEditCaseClasses(["All students"]);
                            toast({ description: "Assigned to all students" });
                            setShowAddClassesModal(false);
                            setSelectedClassesInModal([]);
                            return;
                          }

                          const existingLabelSet = new Set(
                            editCaseClasses
                              .filter((label) => normalizeClassTag(label) !== "all students")
                              .map((label) => normalizeClassTag(label))
                          );

                          const newClassIds = selectedClassesInModal.filter(
                            (clsId) => !editCaseClassIds.includes(clsId)
                          );

                          if (newClassIds.length > 0) {
                            const addablePairs = newClassIds.map((clsId) => {
                              const cls = availableClasses.find((c) => c.id === clsId);
                              const label = cls ? `${cls.name} (${cls.year})` : clsId;
                              return { id: clsId, label };
                            }).filter(({ label }) => !existingLabelSet.has(normalizeClassTag(label)));

                            const filteredNewClassIds = addablePairs.map((pair) => pair.id);
                            const newClassLabels = addablePairs.map((pair) => pair.label);

                            if (filteredNewClassIds.length === 0) {
                              toast({
                                description: "All selected classes are already added"
                              });
                              setShowAddClassesModal(false);
                              setSelectedClassesInModal([]);
                              return;
                            }

                            setEditCaseClassIds((prev) => dedupeClassIds([...prev, ...filteredNewClassIds]));
                            setEditCaseClasses((prev) => dedupeClassTags([
                              ...prev.filter((label) => normalizeClassTag(label) !== "all students"),
                              ...newClassLabels,
                            ]));
                            toast({ 
                              description: `Added ${filteredNewClassIds.length} class(es) to the case`
                            });
                          } else {
                            toast({ 
                              description: "All selected classes are already added"
                            });
                          }
                          setShowAddClassesModal(false);
                          setSelectedClassesInModal([]);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Selected Classes
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </aside>
          )}

          <div className="absolute inset-y-0 right-0 z-20 flex pointer-events-none">
          {user?.role === 'student' && !isQnAStudentMode && showHistory && (
            <div className="pointer-events-auto">
              <AnnotationHistory
                versions={annotation.versions as any}
                currentVersion={currentVersionNumber}
                onRestore={handleRestoreVersion as any}
                onDelete={handleDeleteVersion}
              />
            </div>
          )}

          {user?.role === 'student' && !isQnAStudentMode && (
            <div
              className={`pointer-events-auto border-l border-border bg-card overflow-hidden ${showProperties ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none"}`}
            >
              <AnnotationPropertiesPanel
                className="h-full"
                allAnnotations={annotation.annotations as any}
                selectedAnnotations={annotation.annotations.filter((a) =>
                  annotation.selectedAnnotationIds.includes(a.id)
                ) as any}
                onSelectAnnotation={(id) => annotation.setSelectedAnnotations?.([id])}
                onClose={() => setShowProperties(false)}
                onUpdateAnnotation={annotation.updateAnnotation as any}
                onDeleteAnnotations={annotation.deleteSelectedAnnotations}
                onLockAnnotations={annotation.lockAnnotations}
                onDuplicateAnnotations={annotation.duplicateAnnotations}
                onToggleVisibility={annotation.toggleAnnotationsVisibility}
              />
            </div>
          )}

          {/* AI Vision Assistant Panel */}
          {user?.role === 'student' && !isQnAStudentMode && showAIVision && (
            <aside className="w-80 bg-card border-l border-border overflow-y-auto subtle-scrollbar pointer-events-auto" onWheel={handlePanelWheel}>
              <AIAnnotationSuggestions
                imageUrl={case_.imageUrl}
                context={{
                  caseId: caseId,
                  caseTitle: case_.title,
                  caseDescription: case_.description,
                  imageUrl: case_.imageUrl,
                  annotations: annotation.annotations as any,
                  homeworkInstructions: hw ? "Complete annotations and submit homework" : undefined,
                  userRole: user.role as "student" | "instructor",
                  userId: user.user_id || ""
                }}
                onSuggestionClick={(suggestion) => {
                  console.log("Suggestion clicked:", suggestion);
                }}
                className="h-full"
              />
            </aside>
          )}

          {/* AI Chat Assistant Panel */}
          {user?.role === 'student' && showAIChat && (
            <aside className="w-80 bg-card border-l border-border overflow-y-auto subtle-scrollbar pointer-events-auto" onWheel={handlePanelWheel}>
              <AIChatAssistant
                context={{
                  caseId: caseId,
                  caseTitle: case_.title,
                  caseDescription: case_.description,
                  imageUrl: case_.imageUrl,
                  annotations: annotation.annotations as any,
                  homeworkInstructions: hw ? "Complete annotations and submit homework" : undefined,
                  userRole: user.role as "student" | "instructor",
                  userId: user.user_id || ""
                }}
                isMinimized={aiChatMinimized}
                onMinimize={() => setAIChatMinimized(!aiChatMinimized)}
                onClose={() => setShowAIChat(false)}
                className="h-full"
              />
            </aside>
          )}

          {/* Assignment Details Panel */}
          {user?.role === 'student' && showAssignmentDetails && (
            <aside className="w-80 bg-card border-l border-border overflow-y-auto subtle-scrollbar pointer-events-auto" onWheel={handlePanelWheel}>
              <AssignmentDetailsPanel
                title={case_.title}
                description={hw?.instructions || hw?.description || case_.description || "No assignment instructions yet."}
                dueDate={hw?.dueAt}
                points={hw?.points ?? 100}
                submissionStatus={effectiveSubmissionStatus as "none" | "submitted" | "grading" | "graded"}
                score={effectiveSubmissionScore ?? undefined}
                closed={hw?.closed ?? false}
                hasHomework={Boolean(hw?.id)}
                autoChecklist={
                  isQnAHomework
                    ? [
                        "Answer every question with clear reasoning",
                        "Reference image findings where relevant",
                        "Review spelling and medical terminology",
                        "Submit before the deadline",
                      ]
                    : [
                        "Identify key structures and abnormalities",
                        "Use labels for all major findings",
                        "Keep annotations precise and readable",
                        "Save versions while you work",
                      ]
                }
                onClose={() => setShowAssignmentDetails(false)}
              />
            </aside>
          )}

          {/* Default collaborative sidebar with dropdown tab selector */}
          {user?.role === 'student' && !isQnAStudentMode && !showHistory && !showProperties && !showAIChat && !showAIVision && !showAssignmentDetails && (
            <div className="relative flex pointer-events-auto">
              {/* Toggle button – lives outside the aside so overflow-hidden doesn't clip it */}
              <button
                type="button"
                className="absolute left-0 top-1/2 z-20 h-12 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card hover:bg-muted text-foreground shadow-md transition-colors"
                onClick={() => {
                  setSidebarExpanded((prev) => !prev);
                  setShowTabDropdown(false);
                }}
                title={sidebarExpanded ? "Close sidebar" : "Open sidebar"}
                aria-label={sidebarExpanded ? "Close sidebar" : "Open sidebar"}
              >
                <span className="sr-only">{sidebarExpanded ? "Close sidebar" : "Open sidebar"}</span>
                {sidebarExpanded ? <ChevronRight className="mx-auto h-4 w-4" /> : <ChevronLeft className="mx-auto h-4 w-4" />}
              </button>

            <aside
              className={`${sidebarExpanded ? "w-80" : "w-16"} bg-card border-l border-border flex flex-col overflow-hidden`}
            >
              <div className={`${sidebarExpanded ? "hidden" : "flex"} flex-col items-center gap-3 py-3`}>
                {!isQnAStudentMode && (
                  <button
                    type="button"
                    className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeSidebarTab === "annotate" ? "bg-primary/10 border-primary/40" : "border-border"}`}
                    onClick={() => { setSidebarExpanded(true); switchSidebarTab("annotate"); }}
                    title="Annotate"
                  >
                    <span className="text-base">📝</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeSidebarTab === "collaborate" ? "bg-primary/10 border-primary/40" : "border-border"}`}
                  onClick={() => { setSidebarExpanded(true); switchSidebarTab("collaborate"); }}
                  title="Collaborate"
                >
                  <span className="text-base">👥</span>
                </button>
                <button
                  type="button"
                  className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeSidebarTab === "ai-assistant" ? "bg-primary/10 border-primary/40" : "border-border"}`}
                  onClick={() => { setSidebarExpanded(true); switchSidebarTab("ai-assistant"); }}
                  title="AI Assistant"
                >
                  <span className="text-base">🤖</span>
                </button>
                <button
                  type="button"
                  className={`h-10 w-10 rounded-md border flex items-center justify-center ${activeSidebarTab === "homework" ? "bg-primary/10 border-primary/40" : "border-border"}`}
                  onClick={() => { setSidebarExpanded(true); switchSidebarTab("homework"); }}
                  title="Homework"
                >
                  <span className="text-base">📋</span>
                </button>
              </div>

              <div className={`${sidebarExpanded ? "flex" : "hidden"} flex-1 flex-col min-w-0 min-h-0`}>
              {/* Dropdown Tab Selector */}
              <div className="border-b border-border p-2">
                <div className="relative">
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setShowTabDropdown(!showTabDropdown)}
                  >
                    <span className="flex items-center gap-2">
                      {!isQnAStudentMode && activeSidebarTab === "annotate" && <span className="text-base">📝</span>}
                      {activeSidebarTab === "collaborate" && <span className="text-base">👥</span>}
                      {activeSidebarTab === "ai-assistant" && <span className="text-base">🤖</span>}
                      {activeSidebarTab === "homework" && <span className="text-base">📋</span>}
                      <span className="capitalize">
                        {activeSidebarTab === "ai-assistant" ? "AI Assistant" : activeSidebarTab.charAt(0).toUpperCase() + activeSidebarTab.slice(1)}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showTabDropdown ? "rotate-180" : ""}`} />
                  </Button>
                  
                  {/* Dropdown Menu with Smooth Animation */}
                  {showTabDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                      {!isQnAStudentMode && (
                        <button
                          type="button"
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors ${
                            activeSidebarTab === "annotate" ? "bg-primary/10" : ""
                          }`}
                          onClick={() => {
                            switchSidebarTab("annotate");
                          }}
                        >
                          <span className="text-base">📝</span>
                          <span>Annotate</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors ${
                          activeSidebarTab === "collaborate" ? "bg-primary/10" : ""
                        }`}
                        onClick={() => {
                          switchSidebarTab("collaborate");
                        }}
                      >
                        <span className="text-base">👥</span>
                        <span>Collaborate</span>
                      </button>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors ${
                          activeSidebarTab === "ai-assistant" ? "bg-primary/10" : ""
                        }`}
                        onClick={() => {
                          switchSidebarTab("ai-assistant");
                        }}
                      >
                        <span className="text-base">🤖</span>
                        <span>AI Assistant</span>
                      </button>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors ${
                          activeSidebarTab === "homework" ? "bg-primary/10" : ""
                        }`}
                        onClick={() => {
                          switchSidebarTab("homework");
                        }}
                      >
                        <span className="text-base">📋</span>
                        <span>Homework</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab Content - Annotate */}
              {!isQnAStudentMode && activeSidebarTab === "annotate" && (
                <div className="flex-1 overflow-y-auto subtle-scrollbar p-2 space-y-2" onWheel={handlePanelWheel}>
                  <div className="border rounded-lg p-2 bg-muted/50">
                    <h4 className="font-semibold text-xs mb-1">Current Annotations</h4>
                    <p className="text-xs text-muted-foreground">
                      {annotation.annotations.length} annotation{annotation.annotations.length !== 1 ? 's' : ''} created
                    </p>
                  </div>
                  {annotation.selectedAnnotationIds.length > 0 && (
                    <div className="border rounded-lg p-2 bg-blue-50 dark:bg-blue-950">
                      <h4 className="font-semibold text-xs mb-1">Properties</h4>
                      <div className="text-xs text-muted-foreground">
                        {annotation.selectedAnnotationIds.length} selected
                      </div>
                    </div>
                  )}
                  <CompareToggle
                    peers={comparePeers as any}
                    onModeChange={setPeerComparisonMode}
                    onChange={(peer, alpha) =>
                      handleCompareChange(peer, alpha)
                    }
                  />

                  {showComparison && (
                    <PeerComparison
                      peerAnnotations={peerCompareEntries as any}
                      currentUserId={user?.user_id || "current-user"}
                      onToggleUserAnnotations={handlePeerVisibilityToggle}
                      onSelectForComparison={handlePeerSelectForComparison}
                      onComparisonModeChange={setPeerComparisonMode}
                    />
                  )}
                </div>
              )}

              {/* Tab Content - Collaborate */}
              {activeSidebarTab === "collaborate" && (
                <div className="flex-1 overflow-y-auto subtle-scrollbar p-2 space-y-2" onWheel={handlePanelWheel}>
                  <VersionList
                    title="My versions"
                    items={myAnnotationVersions as any}
                    onSelect={(v) => {
                      const version = annotation.versions.find(
                        (item: any) => item.id === v.id || item._id === v.id,
                      );
                      if (!version) {
                        toast({
                          title: "Version not found",
                          description: "The selected version could not be restored.",
                          variant: "destructive",
                        });
                        return;
                      }
                      handleRestoreVersion(version);
                    }}
                  />
                  <VersionList
                    title="Peers' versions"
                    items={comparePeers as any}
                    onSelect={(v) => {
                      const peerVersion = comparePeers.find((item: any) => item.id === v.id);
                      if (!peerVersion) return;
                      setPeerComparisonMode("overlay");
                      setShowComparison(true);
                      handleCompareChange(peerVersion as any, compare.alpha || 0.5);
                    }}
                  />

                  {/* Replace Collaboration Chat with Create Discussion button for this case */}
                  <div className="flex items-center justify-center py-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCreating) return;
                        if (!user || !user.user_id) {
                          toast({ title: "Not signed in", description: "Please sign in to create a discussion.", variant: 'destructive' });
                          return;
                        }

                        const prefill = {
                          title: case_.title,
                          message: case_.description || "",
                          tags: [case_.category].filter(Boolean),
                          caseId: caseId,
                          imageUrl: hw?.annotationImage || case_.imageUrl || undefined,
                        };
                        try {
                          sessionStorage.setItem("discussionPrefill", JSON.stringify(prefill));
                          try {
                            window.dispatchEvent(new CustomEvent('discussion-prefill', { detail: prefill }));
                          } catch (e) {}
                          setLocation("/student?openDiscussion=1");
                        } catch (err) {
                          console.error("Could not open discussion prefill", err);
                          toast({ title: 'Error', description: 'Unable to open discussion composer', variant: 'destructive' });
                        }
                      }}
                    >
                      Create Discussion
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab Content - AI Assistant */}
              {activeSidebarTab === "ai-assistant" && (
                <div className="flex-1 overflow-y-auto subtle-scrollbar flex flex-col min-h-0" onWheel={handlePanelWheel}>
                  <AIChatAssistant
                    context={{
                      caseId: caseId,
                      caseTitle: case_.title,
                      caseDescription: case_.description,
                      imageUrl: case_.imageUrl,
                      annotations: annotation.annotations as any,
                      homeworkInstructions: hw ? "Complete annotations and submit homework" : undefined,
                      userRole: user.role as "student" | "instructor",
                      userId: user.user_id || ""
                    }}
                    isMinimized={false}
                    onMinimize={() => {}}
                    onClose={() => switchSidebarTab("collaborate")}
                    className="h-full"
                  />
                </div>
              )}

              {/* Tab Content - Assignment Requirements */}
              {activeSidebarTab === "homework" && (
                <div className="flex-1 overflow-y-auto subtle-scrollbar p-2 space-y-2" onWheel={handlePanelWheel}>
                  {!isQnAStudentMode && (
                    <SubmissionPanel
                        status={effectiveSubmissionStatus as "none" | "submitted" | "grading" | "graded"}
                        dueDate={hw?.dueAt}
                        score={effectiveSubmissionScore ?? undefined}
                        maxPoints={hw?.points ?? 100}
                        notes={effectiveSubmissionNotes}
                        files={effectiveSubmissionFiles}
                        questions={hw?.questions || []}
                        uploads={hw?.uploads || []}
                        answers={effectiveSubmissionAnswers || []}
                        homeworkType={hw?.homeworkType || "Annotate"}
                        closed={hw?.closed ?? false}
                        loading={subLoading}
                        error={subError}
                        teacherFeedback={effectiveTeacherFeedback}
                        onSubmit={async (notes, files, answers) => {
                          if (!hw?.id) {
                            toast({
                              title: "No homework assigned",
                              description: "This case does not have an active homework yet.",
                              variant: "destructive",
                            });
                            return;
                          }

                          if (hw.closed) {
                            toast({
                              title: "Assignment closed",
                              description: "This assignment is closed and cannot accept submissions.",
                              variant: "destructive",
                            });
                            return;
                          }

                          if (isMarkedSubmission) {
                            toast({
                              title: "Already marked",
                              description: "This assignment is marked and can no longer be submitted.",
                              variant: "destructive",
                            });
                            return;
                          }

                          const result = await submitHomework({
                            notes,
                            files,
                            answers,
                          });

                          if (result) {
                            setSubmissionStatusOverride(result.status && result.status !== "none" ? result.status : "submitted");
                            fetchSubmission();
                          }
                        }}
                        onUploadFile={async (file) => {
                          if (!hw) {
                            toast({
                              title: "No homework assigned",
                              description: "Attach files is only available when a homework is assigned.",
                              variant: "destructive",
                            });
                            return null;
                          }

                          if (hw.closed || isMarkedSubmission) {
                            toast({
                              title: "Submission locked",
                              description: "This assignment can no longer accept files.",
                              variant: "destructive",
                            });
                            return null;
                          }

                          return uploadFile(file);
                        }}
                      />
                  )}
                  {!hw && (
                    <div className="text-center py-2">
                      <p className="text-xs text-muted-foreground">
                        No active homework is assigned to this case yet.
                      </p>
                    </div>
                  )}
                </div>
              )}
              </div>
            </aside>
            </div>
          )}
          </div>

          {/* Closed Case Notification Modal (students only) */}
          {user?.role === 'student' && showClosedCaseNotification && hw?.closed && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-base">Assignment Closed</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This assignment is closed and no longer accepting new submissions. You can still view and edit your existing annotations, but you will not be able to submit new work.
                    </p>
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded p-3">
                  <p className="text-xs text-orange-900 dark:text-orange-200">
                    <strong>Note:</strong> The deadline for this assignment has passed. Contact your instructor if you have questions.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => setShowClosedCaseNotification(false)}
                >
                  Understand
                </Button>
              </div>
            </div>
          )}

          {/* Floating AI Chat (when minimized) */}
          {user?.role === 'student' && showAIChat && aiChatMinimized && (
            <AIChatAssistant
              context={{
                caseId: caseId,
                caseTitle: case_.title,
                caseDescription: case_.description,
                imageUrl: case_.imageUrl,
                annotations: annotation.annotations as any,
                homeworkInstructions: hw ? "Complete annotations and submit homework" : undefined,
                userRole: user.role as "student" | "instructor",
                userId: user.user_id || ""
              }}
              isMinimized={true}
              onMinimize={() => setAIChatMinimized(false)}
              onClose={() => setShowAIChat(false)}
            />
          )}
        </main>
      </div>
    </div>
  );
}



