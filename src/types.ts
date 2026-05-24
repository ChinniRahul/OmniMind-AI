export type VoiceSpeaker = "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr";

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  theme: "light" | "dark";
  ttsVoice: VoiceSpeaker;
  createdAt: string;
}

export interface ChatSession {
  chatId: string;
  userId: string;
  title: string;
  category: "general" | "coder" | "debugger" | "content-writer" | "translator" | "summarizer" | "study-assistant" | "resume-builder" | "interview-prep";
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  messageId: string;
  chatId: string;
  userId: string;
  role: "user" | "model";
  content: string;
  type: string;
  voiceAudio?: string; // Base64 audio returned from Gemini TTS or empty
  createdAt: string;
}

export interface DocumentRecord {
  documentId: string;
  userId: string;
  name: string;
  type: "pdf" | "docx" | "txt";
  content: string;
  summary?: string;
  keyPoints?: string[];
  createdAt: string;
}

export interface KnowledgeItem {
  itemId: string;
  userId: string;
  title: string;
  body: string;
  useAsMemory: boolean;
  createdAt: string;
}

export interface NoteRecord {
  noteId: string;
  userId: string;
  title: string;
  content: string;
  folder: string;
  isSynced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  taskId: string;
  userId: string;
  title: string;
  description?: string;
  status: "pending" | "completed";
  dueDate?: string;
  goalId?: string;
  reminderEnabled: boolean;
  createdAt: string;
}

export interface GoalRecord {
  goalId: string;
  userId: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline?: string;
  createdAt: string;
}
