import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, User as FirebaseUser } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, collection, getDocs, query, where, getDocFromServer } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import firebaseConfig from "../firebase-applet-config.json";
import { ChatSession, ChatMessage, DocumentRecord, NoteRecord, TaskRecord, GoalRecord, KnowledgeItem, UserProfile } from "../types";

// Secure, non-leaking configuration resolution supporting environment variables first
const metaEnv = (import.meta as any).env || {};
const resolvedConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || firebaseConfig?.apiKey || "",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig?.authDomain || "",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || firebaseConfig?.projectId || "",
  firestoreDatabaseId: metaEnv.VITE_FIREBASE_DATABASE_ID || metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig?.firestoreDatabaseId || "",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig?.storageBucket || "",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig?.messagingSenderId || "",
  appId: metaEnv.VITE_FIREBASE_APP_ID || firebaseConfig?.appId || "",
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig?.measurementId || ""
};

// Detect if Firebase can be fully loaded (checks if config properties are non-empty strings)
export const isFirebaseConfigured =
  resolvedConfig &&
  resolvedConfig.apiKey &&
  resolvedConfig.apiKey !== "" &&
  resolvedConfig.projectId &&
  resolvedConfig.projectId !== "";

let firebaseApp: any = null;
let realAuth: any = null;
let realDb: any = null;
let realStorage: any = null;

if (isFirebaseConfigured) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(resolvedConfig) : getApp();
    realAuth = getAuth(firebaseApp);
    realDb = getFirestore(firebaseApp, resolvedConfig.firestoreDatabaseId);
    realStorage = getStorage(firebaseApp);
    console.info("OmniMind AI: Firebase initialized on cloud cluster.");
  } catch (error) {
    console.error("OmniMind AI: Failed to initialize Firebase SDK. Falling back to local offline-mode.", error);
  }
}

export const auth = realAuth;
export const db = realDb;
export const storage = realStorage;

// Validate Connection to Firestore (Per Blocking Skill Requirement)
async function testConnection() {
  if (!isFirebaseConfigured || !realDb) return;
  try {
    await getDocFromServer(doc(realDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Firebase Storage Helpers
export const uploadFileToStorage = async (path: string, file: File | Blob): Promise<string> => {
  if (isFirebaseConfigured && storage) {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error("Firebase Storage Upload Error:", error);
      throw error;
    }
  }
  throw new Error("Firebase Storage is not configured.");
};

export const deleteFileFromStorage = async (path: string): Promise<void> => {
  if (isFirebaseConfigured && storage) {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (error) {
      console.error("Firebase Storage Delete Error:", error);
      throw error;
    }
  }
};

// ==========================================
// STANDARD AND COMPLIANT FIRESTORE ERROR HANDLING INTERFACES
// ==========================================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ==========================================
// BACKGROUND FIRESTORE WRAPPERS FOR OFFLINE FIRST
// ==========================================
export const saveToFirestore = async (colPath: string, docId: string, data: any) => {
  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, colPath, docId), data);
    } catch (e) {
      console.warn(`Firestore background save deferred (offline/permission): ${colPath}/${docId}`, e);
    }
  }
};

export const deleteFromFirestore = async (colPath: string, docId: string) => {
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, colPath, docId));
    } catch (e) {
      console.warn(`Firestore background delete deferred (offline/permission): ${colPath}/${docId}`, e);
    }
  }
};

export const syncOfflineChangesToCloud = async () => {
  if (!isFirebaseConfigured || !db) return;
  console.info("OmniMind AI: Triggering cloud auto-sync worker...");
  try {
    const user = localStore.getUserProfile();
    if (!user || !user.userId) return;

    // 1. Sync User Profile
    await setDoc(doc(db, "users", user.userId), user);

    // 2. Sync Chats
    const chats = localStore.getChats();
    for (const c of chats) {
      await setDoc(doc(db, "chats", c.chatId), c);
    }

    // 3. Sync Messages
    const msgs = localStore.getAllMessages();
    for (const m of msgs) {
      await setDoc(doc(db, "chats", m.chatId, "messages", m.messageId), m);
    }

    // 4. Sync Documents
    const docs = localStore.getDocuments();
    for (const d of docs) {
      await setDoc(doc(db, "documents", d.documentId), d);
    }

    // 5. Sync Knowledge
    const know = localStore.getKnowledge();
    for (const k of know) {
      await setDoc(doc(db, "knowledge", k.itemId), k);
    }

    // 6. Sync Notes
    const notes = localStore.getNotes();
    for (const n of notes) {
      await setDoc(doc(db, "notes", n.noteId), n);
    }

    // 7. Sync Tasks
    const tasks = localStore.getTasks();
    for (const t of tasks) {
      await setDoc(doc(db, "tasks", t.taskId), t);
    }

    // 8. Sync Goals
    const goals = localStore.getGoals();
    for (const g of goals) {
      await setDoc(doc(db, "goals", g.goalId), g);
    }

    console.info("OmniMind AI: Cloud sync completed successfully.");
    return true;
  } catch (error) {
    console.error("OmniMind AI: Error in cloud auto-sync loop:", error);
    return false;
  }
};

// ==========================================
// SEED DATA FOR IMMACULATE FIRST TOUCH
// ==========================================
const DEFAULT_USER: UserProfile = {
  userId: "local-user-id",
  email: "chinnirahul2003@gmail.com",
  displayName: "Rahul Chinni",
  theme: "dark",
  ttsVoice: "Zephyr",
  createdAt: new Date().toISOString(),
};

const DEFAULT_CHATS: ChatSession[] = [
  {
    chatId: "chat-seed-1",
    userId: "local-user-id",
    title: "React Web Dashboard Optimization",
    category: "coder",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    chatId: "chat-seed-2",
    userId: "local-user-id",
    title: "Market Segment Content Draft",
    category: "content-writer",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 23).toISOString(),
  }
];

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    messageId: "msg-seed-1",
    chatId: "chat-seed-1",
    userId: "local-user-id",
    role: "user",
    content: "Can you help optimize this functional state hook in React to avoid redundant rendering sweeps?",
    type: "text",
    createdAt: new Date(Date.now() - 3600000 * 2 + 60000).toISOString(),
  },
  {
    messageId: "msg-seed-2",
    chatId: "chat-seed-1",
    userId: "local-user-id",
    role: "model",
    content: "Certainly! To secure performance parameters, we can implement state-stabilizing hooks. For example:\n\n```tsx\nimport React, { useMemo, useCallback } from 'react';\n\nexport const StableDashboard = React.memo(({ items }) => {\n  const formattedItems = useMemo(() => {\n    return items.map(item => ({ ...item, rank: item.currentValue / item.targetValue }));\n  }, [items]);\n\n  const handleSelect = useCallback((id: string) => {\n    console.log('Selected metric target:', id);\n  }, []);\n\n  return <div>{/* Render clean content elements here */}</div>;\n});\n```\n\n**Key factors**:\n- **`useMemo`** stabilizes complex computations unless array references mutate.\n- **`React.memo`** overrides child component evaluation unless parameters carry new memory locations.",
    type: "code",
    createdAt: new Date(Date.now() - 3600000 * 2 + 120000).toISOString(),
  }
];

const DEFAULT_NOTES: NoteRecord[] = [
  {
    noteId: "note-seed-1",
    userId: "local-user-id",
    title: "OmniMind Platform Architecture Options",
    content: "# Unified Platform Design\n\nThis application incorporates dynamic data routing through a clean architecture. It bridges web features with responsive layouts to look consistent on phone form factors.\n\n### Core Pillars:\n- **Offline First**: All states fall back smoothly to client caches to keep layouts working offline.\n- **Zero-Latency State Sync**: Synchronization re-attempts are dispatched instantly on connectivity restoral.",
    folder: "Architecture",
    isSynced: true,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    noteId: "note-seed-2",
    userId: "local-user-id",
    title: "Marketing Copy Ideas",
    content: "# Platform Copy Concepts\n- OmniMind: The Ultimate AI-Driven Workspace Core.\n- Boost productivity by consolidating tasks, calendars, document reviews, and study guides inside one secure, local-first ecosystem.",
    folder: "Marketing",
    isSynced: true,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 11).toISOString(),
  }
];

const DEFAULT_TASKS: TaskRecord[] = [
  {
    taskId: "task-seed-1",
    userId: "local-user-id",
    title: "Complete OmniMind UI layout",
    description: "Align negative margins, hover triggers, responsive menus, and dark/light modes.",
    status: "completed",
    dueDate: new Date().toISOString().split("T")[0],
    goalId: "goal-seed-1",
    reminderEnabled: true,
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    taskId: "task-seed-2",
    userId: "local-user-id",
    title: "Integrate Voice to Text models",
    description: "Check mic permissions, encode local binary frames, and translate voices using API endpoints.",
    status: "pending",
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
    goalId: "goal-seed-1",
    reminderEnabled: false,
    createdAt: new Date().toISOString(),
  },
  {
    taskId: "task-seed-3",
    userId: "local-user-id",
    title: "Write documentation review summary",
    description: "Upload study guidelines document, query summary parameters, and save result to the architecture file.",
    status: "pending",
    dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split("T")[0],
    reminderEnabled: true,
    createdAt: new Date().toISOString(),
  }
];

const DEFAULT_GOALS: GoalRecord[] = [
  {
    goalId: "goal-seed-1",
    userId: "local-user-id",
    title: "OmniMind Platform Release",
    targetValue: 10,
    currentValue: 6,
    unit: "Milestones",
    deadline: new Date(Date.now() + 86400000 * 14).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
  },
  {
    goalId: "goal-seed-2",
    userId: "local-user-id",
    title: "Deep Learning Thesis Core notes",
    targetValue: 5,
    currentValue: 2,
    unit: "Summaries",
    deadline: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
  }
];

const DEFAULT_KNOWLEDGE: KnowledgeItem[] = [
  {
    itemId: "know-seed-1",
    userId: "local-user-id",
    title: "Model Capabilities Note",
    body: "Gemini 3.5-flash serves as the baseline models for general text processing. High reasoning assignments deploy gemini-3.1-pro-preview.",
    useAsMemory: true,
    createdAt: new Date().toISOString(),
  }
];

// Helper to assure localStorage entities exist
const ensureLocalStorageInitialized = () => {
  if (!isFirebaseConfigured && !localStorage.getItem("omnimind_user")) {
    localStorage.setItem("omnimind_user", JSON.stringify(DEFAULT_USER));
  }
  if (!localStorage.getItem("omnimind_chats")) {
    localStorage.setItem("omnimind_chats", JSON.stringify(DEFAULT_CHATS));
  }
  if (!localStorage.getItem("omnimind_messages")) {
    localStorage.setItem("omnimind_messages", JSON.stringify(DEFAULT_MESSAGES));
  }
  if (!localStorage.getItem("omnimind_notes")) {
    localStorage.setItem("omnimind_notes", JSON.stringify(DEFAULT_NOTES));
  }
  if (!localStorage.getItem("omnimind_tasks")) {
    localStorage.setItem("omnimind_tasks", JSON.stringify(DEFAULT_TASKS));
  }
  if (!localStorage.getItem("omnimind_goals")) {
    localStorage.setItem("omnimind_goals", JSON.stringify(DEFAULT_GOALS));
  }
  if (!localStorage.getItem("omnimind_knowledge")) {
    localStorage.setItem("omnimind_knowledge", JSON.stringify(DEFAULT_KNOWLEDGE));
  }
  if (!localStorage.getItem("omnimind_documents")) {
    localStorage.setItem("omnimind_documents", JSON.stringify([]));
  }
};

// ==========================================
// HIGH FIDELITY OFFLINE STORAGE ENGINE WITH FIRESTORE LINK
// ==========================================
export const localStore = {
  // User Profile Nodes
  getUserProfile: (): UserProfile | null => {
    ensureLocalStorageInitialized();
    const raw = localStorage.getItem("omnimind_user");
    return raw ? JSON.parse(raw) : null;
  },
  saveUserProfile: (profile: Partial<UserProfile>) => {
    const current = localStore.getUserProfile() || ({} as any);
    const updated = { ...current, ...profile };
    localStorage.setItem("omnimind_user", JSON.stringify(updated));
    if (updated.userId) {
      saveToFirestore("users", updated.userId, updated);
    }
    return updated;
  },

  // Chats Nodes
  getChats: (): ChatSession[] => {
    ensureLocalStorageInitialized();
    return JSON.parse(localStorage.getItem("omnimind_chats") || "[]");
  },
  saveChat: (chat: ChatSession) => {
    const list = localStore.getChats();
    const idx = list.findIndex((c) => c.chatId === chat.chatId);
    if (idx >= 0) {
      list[idx] = chat;
    } else {
      list.unshift(chat);
    }
    localStorage.setItem("omnimind_chats", JSON.stringify(list));
    saveToFirestore("chats", chat.chatId, chat);
    return chat;
  },
  deleteChat: (chatId: string) => {
    const chats = localStore.getChats().filter((c) => c.chatId !== chatId);
    const msgs = localStore.getAllMessages().filter((m) => m.chatId !== chatId);
    localStorage.setItem("omnimind_chats", JSON.stringify(chats));
    localStorage.setItem("omnimind_messages", JSON.stringify(msgs));
    deleteFromFirestore("chats", chatId);
  },

  // Messages Nodes
  getAllMessages: (): ChatMessage[] => {
    ensureLocalStorageInitialized();
    return JSON.parse(localStorage.getItem("omnimind_messages") || "[]");
  },
  getMessages: (chatId: string): ChatMessage[] => {
    return localStore.getAllMessages().filter((m) => m.chatId === chatId);
  },
  saveMessage: (message: ChatMessage) => {
    const list = localStore.getAllMessages();
    const idx = list.findIndex((m) => m.messageId === message.messageId);
    if (idx >= 0) {
      list[idx] = message;
    } else {
      list.push(message);
    }
    localStorage.setItem("omnimind_messages", JSON.stringify(list));

    // Update parent chat timestamp
    const chats = localStore.getChats();
    const pidx = chats.findIndex((c) => c.chatId === message.chatId);
    if (pidx >= 0) {
      chats[pidx].updatedAt = new Date().toISOString();
      if (chats[pidx].title === "New conversation" && message.role === "user") {
        chats[pidx].title = message.content.slice(0, 36) + (message.content.length > 36 ? "..." : "");
      }
      localStorage.setItem("omnimind_chats", JSON.stringify(chats));
      saveToFirestore("chats", chats[pidx].chatId, chats[pidx]);
    }
    saveToFirestore(`chats/${message.chatId}/messages`, message.messageId, message);
    return message;
  },

  // Documents Nodes
  getDocuments: (): DocumentRecord[] => {
    ensureLocalStorageInitialized();
    return JSON.parse(localStorage.getItem("omnimind_documents") || "[]");
  },
  saveDocument: (doc: DocumentRecord) => {
    const list = localStore.getDocuments();
    list.unshift(doc);
    localStorage.setItem("omnimind_documents", JSON.stringify(list));
    saveToFirestore("documents", doc.documentId, doc);
    return doc;
  },
  deleteDocument: (documentId: string) => {
    const list = localStore.getDocuments().filter((d) => d.documentId !== documentId);
    localStorage.setItem("omnimind_documents", JSON.stringify(list));
    deleteFromFirestore("documents", documentId);
  },

  // Knowledge Items Node
  getKnowledge: (): KnowledgeItem[] => {
    ensureLocalStorageInitialized();
    return JSON.parse(localStorage.getItem("omnimind_knowledge") || "[]");
  },
  saveKnowledge: (item: KnowledgeItem) => {
    const list = localStore.getKnowledge();
    const idx = list.findIndex((k) => k.itemId === item.itemId);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    localStorage.setItem("omnimind_knowledge", JSON.stringify(list));
    saveToFirestore("knowledge", item.itemId, item);
    return item;
  },
  deleteKnowledge: (itemId: string) => {
    const list = localStore.getKnowledge().filter((k) => k.itemId !== itemId);
    localStorage.setItem("omnimind_knowledge", JSON.stringify(list));
    deleteFromFirestore("knowledge", itemId);
  },

  // Notes Management Nodes
  getNotes: (): NoteRecord[] => {
    ensureLocalStorageInitialized();
    return JSON.parse(localStorage.getItem("omnimind_notes") || "[]");
  },
  saveNote: (note: NoteRecord) => {
    const list = localStore.getNotes();
    const idx = list.findIndex((n) => n.noteId === note.noteId);
    if (idx >= 0) {
      list[idx] = note;
    } else {
      list.unshift(note);
    }
    localStorage.setItem("omnimind_notes", JSON.stringify(list));
    saveToFirestore("notes", note.noteId, note);
    return note;
  },
  deleteNote: (noteId: string) => {
    const list = localStore.getNotes().filter((n) => n.noteId !== noteId);
    localStorage.setItem("omnimind_notes", JSON.stringify(list));
    deleteFromFirestore("notes", noteId);
  },

  // Task Productivity Nodes
  getTasks: (): TaskRecord[] => {
    ensureLocalStorageInitialized();
    return JSON.parse(localStorage.getItem("omnimind_tasks") || "[]");
  },
  saveTask: (task: TaskRecord) => {
    const list = localStore.getTasks();
    const idx = list.findIndex((t) => t.taskId === task.taskId);
    if (idx >= 0) {
      list[idx] = task;
    } else {
      list.unshift(task);
    }
    localStorage.setItem("omnimind_tasks", JSON.stringify(list));
    saveToFirestore("tasks", task.taskId, task);
    return task;
  },
  deleteTask: (taskId: string) => {
    const list = localStore.getTasks().filter((t) => t.taskId !== taskId);
    localStorage.setItem("omnimind_tasks", JSON.stringify(list));
    deleteFromFirestore("tasks", taskId);
  },

  // Goal Tracking Nodes
  getGoals: (): GoalRecord[] => {
    ensureLocalStorageInitialized();
    return JSON.parse(localStorage.getItem("omnimind_goals") || "[]");
  },
  saveGoal: (goal: GoalRecord) => {
    const list = localStore.getGoals();
    const idx = list.findIndex((g) => g.goalId === goal.goalId);
    if (idx >= 0) {
      list[idx] = goal;
    } else {
      list.unshift(goal);
    }
    localStorage.setItem("omnimind_goals", JSON.stringify(list));
    saveToFirestore("goals", goal.goalId, goal);
    return goal;
  },
  deleteGoal: (goalId: string) => {
    const list = localStore.getGoals().filter((g) => g.goalId !== goalId);
    localStorage.setItem("omnimind_goals", JSON.stringify(list));
    deleteFromFirestore("goals", goalId);

    // Also dereference matching goals in tasks
    const tasks = localStore.getTasks().map((t) => {
      if (t.goalId === goalId) {
        const up = { ...t, goalId: undefined };
        saveToFirestore("tasks", t.taskId, up);
        return up;
      }
      return t;
    });
    localStorage.setItem("omnimind_tasks", JSON.stringify(tasks));
  },
};
