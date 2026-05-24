import { useState, useEffect } from "react";
import {
  Sparkles,
  LayoutDashboard,
  Brain,
  FileText,
  CheckSquare,
  User,
  Settings,
  BookOpen,
  LogOut,
  Menu,
  X,
  Wifi,
  Download,
  Laptop,
  Smartphone,
} from "lucide-react";
import { UserProfile, ChatSession, NoteRecord, TaskRecord, GoalRecord, DocumentRecord, KnowledgeItem } from "./types";
import { localStore, syncOfflineChangesToCloud, isFirebaseConfigured, auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { AuthView } from "./components/AuthView";
import { DashboardView } from "./components/DashboardView";
import { ChatView } from "./components/ChatView";
import { DocumentsView } from "./components/DocumentsView";
import { KnowledgeView } from "./components/KnowledgeView";
import { NotesView } from "./components/NotesView";
import { TasksView } from "./components/TasksView";
import { ProfileView } from "./components/ProfileView";
import { SettingsView } from "./components/SettingsView";

export default function App() {
  const [initializing, setInitializing] = useState(isFirebaseConfigured);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const prof = localStore.getUserProfile();
      if (prof && prof.email && prof.userId !== "local-user-id") {
        return prof;
      }
    } catch (e) {
      console.warn("Failed to read user profile", e);
    }
    if (!isFirebaseConfigured) {
      return {
        userId: "local-user-id",
        email: "chinnirahul2003@gmail.com",
        displayName: "Rahul Chinni",
        theme: "dark",
        ttsVoice: "Zephyr",
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  });
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  // Progressive Web App State Hooks
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOnline, setIsOnline] = useState(() => {
    return typeof window !== "undefined" ? window.navigator.onLine : true;
  });
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    }
    return false;
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default";
  });

  // PWA Event Listeners
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log("OmniMind PWA: beforeinstallprompt intercepted.");
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log("OmniMind PWA: App installation complete.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleStandaloneChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
    };
    try {
      mediaQuery.addEventListener("change", handleStandaloneChange);
    } catch {
      // Fallback for older engines
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      try {
        mediaQuery.removeEventListener("change", handleStandaloneChange);
      } catch {}
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      alert("Installation is handled by your browser context. If already installed, open OmniMind AI right from your system's app drawer.");
      return;
    }
    deferredPrompt.prompt();
    try {
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`OmniMind PWA installation outcome: ${outcome}`);
    } catch (err) {
      console.error("Installation failed or cancelled:", err);
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const handleRequestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("This device environment doesn't support Web Push Notifications.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted" && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification("OmniMind AI Workspace", {
          body: "Push alerts configured. You will receive updates about your active workspaces!",
          icon: "/pwa-192.svg",
          badge: "/pwa-192.svg"
        });
      }
    } catch (err) {
      console.error("Failed to requests notification status:", err);
    }
  };

  // Core collections data state arrays
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);

  // Initial load hook
  useEffect(() => {
    // Immediate data loading
    refreshDataStates();
    applyTheme(user?.theme || "dark");

    // Async application initializer (runs in background without blocking UI render)
    const initAppBackground = async () => {
      try {
        if (navigator.onLine && isFirebaseConfigured) {
          // Sync background changes without blocking screen or waiting
          await syncOfflineChangesToCloud().catch(err => {
            console.warn("Background sync failed / timed out or offline", err);
          });
        }
      } catch (err) {
        console.error("OmniMind AI: Background init exception: ", err);
      }
    };

    initAppBackground();

    // Auto-sync worker listening on connectivity restoration
    const handleOnlineSync = () => {
      console.info("OmniMind AI: Network restored. Committing auto-sync...");
      setIsOnline(true);
      syncOfflineChangesToCloud().then(() => refreshDataStates());
    };
    const handleOfflineSync = () => {
      console.info("OmniMind AI: Network offline.");
      setIsOnline(false);
    };
    window.addEventListener("online", handleOnlineSync);
    window.addEventListener("offline", handleOfflineSync);
    return () => {
      window.removeEventListener("online", handleOnlineSync);
      window.removeEventListener("offline", handleOfflineSync);
    };
  }, []);

  // Synchronous Firebase Authentication state listener
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setInitializing(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const localProfile = localStore.getUserProfile();
        const updatedProfile: UserProfile = {
          userId: firebaseUser.uid,
          email: firebaseUser.email || localProfile?.email || "chinnirahul2003@gmail.com",
          displayName: firebaseUser.displayName || localProfile?.displayName || "Rahul Chinni",
          theme: localProfile?.theme || "dark",
          ttsVoice: localProfile?.ttsVoice || "Zephyr",
          createdAt: localProfile?.createdAt || new Date().toISOString(),
        };

        localStore.saveUserProfile(updatedProfile);
        setUser(updatedProfile);
        applyTheme(updatedProfile.theme || "dark");
        refreshDataStates();
      } else {
        localStorage.removeItem("omnimind_user");
        setUser(null);
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshDataStates = () => {
    setChats(localStore.getChats());
    setNotes(localStore.getNotes());
    setTasks(localStore.getTasks());
    setGoals(localStore.getGoals());
    setDocuments(localStore.getDocuments());
    setKnowledge(localStore.getKnowledge());
  };

  const applyTheme = (theme: "light" | "dark") => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const handleToggleTheme = (newTheme: "light" | "dark") => {
    if (!user) return;
    const updated = localStore.saveUserProfile({ theme: newTheme });
    setUser(updated);
    applyTheme(newTheme);
  };

  const handleAuthComplete = (completedUser: UserProfile) => {
    setUser(completedUser);
    applyTheme(completedUser.theme || "dark");
    refreshDataStates();
    setCurrentTab("dashboard");
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
      } catch (err) {
        console.error("Firebase signOut failure:", err);
      }
    }
    localStorage.removeItem("omnimind_user");
    setUser(null);
    setCurrentTab("dashboard");
  };

  // Compile active AI Memory context snippets
  const memoryContextStr = knowledge
    .filter((k) => k.useAsMemory)
    .map((k) => `${k.title}: ${k.body}`)
    .join("\n\n");



  if (initializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#07090e] transition-colors duration-200">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.08),transparent_40%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.15),transparent_40%)] pointer-events-none" />
        <div className="relative z-10 text-center space-y-4 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-8 h-8 animate-spin" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">OmniMind Workspace Core</h1>
          <p className="text-xs text-gray-400 animate-pulse font-mono">SECURED IDENTITY SYNC_</p>
        </div>
      </div>
    );
  }

  if (!user || !user.email) {
    return <AuthView onAuthComplete={handleAuthComplete} />;
  }

  // Sidebar item list configuration
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "chat", label: "AI Chat Console", icon: Sparkles },
    { id: "documents", label: "Document Analysers", icon: FileText },
    { id: "knowledge", label: "AI Knowledge Base", icon: Brain },
    { id: "notes", label: "Personal Notebook", icon: BookOpen },
    { id: "tasks", label: "Tasks & Goals", icon: CheckSquare },
    { id: "profile", label: "Users Profile", icon: User },
    { id: "settings", label: "Platform Settings", icon: Settings },
  ];

  return (
    <div id="app_frame" className="min-h-screen flex bg-[#f8fafc] dark:bg-[#07090e] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Background radial gradient decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(99,102,241,0.03),transparent_35%)] dark:bg-[radial-gradient(circle_at_15%_10%,rgba(99,102,241,0.07),transparent_35%)] pointer-events-none" />

      {/* Mobile Header Menu Trigger bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-[#0f131a] border-b border-gray-100 dark:border-[#1e2530] px-4 flex items-center justify-between z-30 transition-colors">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
          <span className="font-extrabold text-sm tracking-tight text-gray-900 dark:text-white">OmniMind AI</span>
        </div>
        <button
          id="mobile_sidebar_trigger"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-[#1e2530] text-gray-600 dark:text-gray-300 transition-colors"
        >
          {sidebarExpanded ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* NAVIGATION SIDEBAR DRAWER PANEL */}
      <aside
        id="side_navigation_drawer"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 md:w-72 bg-white dark:bg-[#0f131a] border-r border-gray-100 dark:border-[#1e2530] flex flex-col justify-between p-4 transform lg:transform-none transition-all duration-300 ease-out-quad select-none ${
          sidebarExpanded ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="space-y-6 pt-12 lg:pt-0">
          {/* Platform Branding Slot */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-gray-900 dark:text-white tracking-tight">OmniMind AI</h2>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">Edge Workspace</p>
            </div>
          </div>

          {/* Connected state telemetry badge */}
          <div className="px-2">
            <div className="space-y-1.5 font-bold">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] uppercase font-sans ${
                isOnline 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/15" 
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/15 animate-pulse"
              }`}>
                <Wifi className="w-4 h-4 shrink-0" />
                <span>{isOnline ? "Secured Cognitive Synced" : "Standalone Offline Core"}</span>
              </div>
              
              {isStandalone && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 text-indigo-500 border border-indigo-500/15 rounded-xl text-[10px] uppercase font-sans">
                  <Laptop className="w-4 h-4 shrink-0" />
                  <span>Standalone Workspace Active</span>
                </div>
              )}
              
              {isInstallable && (
                <button
                  id="pwa_sidebar_install_btn"
                  onClick={handleInstallPWA}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-[10px] uppercase font-extrabold shadow-sm hover:shadow-indigo-500/25 transition-all text-center cursor-pointer animate-[bounce_2s_infinite]"
                >
                  <Download className="w-4 h-4 shrink-0 animate-pulse" />
                  <span>Install App Workspace</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Links list */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  id={`nav_tab_${item.id}`}
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setSidebarExpanded(false);
                  }}
                  className={`w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-extrabold transition-all duration-150 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50/50 dark:hover:bg-[#141b25]"
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Log out slot */}
        <div className="space-y-3.5 border-t border-gray-100 dark:border-[#1e2530] pt-4 px-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 font-extrabold flex items-center justify-center text-xs uppercase shadow-inner">
              {user?.displayName?.charAt(0) || "U"}
            </div>
            <div className="truncate flex-1">
              <p className="text-xs font-bold text-gray-950 dark:text-white truncate">{user?.displayName || "Rahul Chinni"}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{user?.email || ""}</p>
            </div>
          </div>

          <button
            id="workspace_logout_btn"
            onClick={handleLogout}
            className="w-full py-2 bg-rose-50 dark:bg-[#1a1215] hover:bg-rose-100/50 dark:hover:bg-[#2e181c] text-rose-500 hover:text-rose-600 text-[10px] uppercase font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all outline-none"
          >
            <LogOut className="w-3.5 h-3.5" /> Force Logout Core
          </button>
        </div>
      </aside>

      {/* Main Container Area */}
      <main className="flex-1 min-w-0 pt-20 pb-8 px-4 sm:px-6 lg:pt-8 lg:px-8 overflow-x-hidden relative h-screen overflow-y-auto">
        <div className="max-w-7xl mx-auto h-full">
          {warningMessage && (
            <div id="startup_warning_banner" className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-between gap-4 text-xs animate-fade-in relative z-20">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <p className="font-semibold">{warningMessage}</p>
              </div>
              <button 
                onClick={() => setWarningMessage(null)}
                className="opacity-60 hover:opacity-100 transition-opacity font-bold uppercase tracking-wider text-[10px]"
              >
                Dismiss
              </button>
            </div>
          )}
          {currentTab === "dashboard" && (
            <DashboardView
              user={user}
              chats={chats}
              notes={notes}
              tasks={tasks}
              goals={goals}
              onNavigate={setCurrentTab}
              onRefreshStates={refreshDataStates}
            />
          )}

          {currentTab === "chat" && (
            <ChatView
              user={user}
              chats={chats}
              onRefreshStates={refreshDataStates}
              knowledgeContext={memoryContextStr}
            />
          )}

          {currentTab === "documents" && (
            <DocumentsView
              user={user}
              documents={documents}
              onRefreshStates={refreshDataStates}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === "knowledge" && (
            <KnowledgeView
              user={user}
              items={knowledge}
              onRefreshStates={refreshDataStates}
            />
          )}

          {currentTab === "notes" && (
            <NotesView
              user={user}
              notes={notes}
              onRefreshStates={refreshDataStates}
            />
          )}

          {currentTab === "tasks" && (
            <TasksView
              user={user}
              tasks={tasks}
              goals={goals}
              onRefreshStates={refreshDataStates}
            />
          )}

          {currentTab === "profile" && (
            <ProfileView
              user={user}
              onRefreshStates={refreshDataStates}
            />
          )}

          {currentTab === "settings" && (
            <SettingsView
              user={user}
              onRefreshStates={refreshDataStates}
              onToggleTheme={handleToggleTheme}
              isInstallable={isInstallable}
              isStandalone={isStandalone}
              deferredPrompt={deferredPrompt}
              notificationPermission={notificationPermission}
              onInstallPWA={handleInstallPWA}
              onRequestNotificationPermission={handleRequestNotificationPermission}
            />
          )}
        </div>
      </main>

      {/* Sidebar background overlay trigger active on smaller viewports */}
      {sidebarExpanded && (
        <div
          id="sidebar_backdrop_mobile"
          onClick={() => setSidebarExpanded(false)}
          className="fixed inset-0 bg-black/40 z-35 lg:hidden animate-fade-in"
        />
      )}
    </div>
  );
}
