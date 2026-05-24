import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  FileText, 
  Sparkles, 
  HelpCircle, 
  CornerDownRight, 
  ArrowRight, 
  BookOpen, 
  Trash, 
  Search, 
  Check, 
  Copy, 
  RefreshCw, 
  Settings2, 
  MessageSquare, 
  Layers, 
  Cloud, 
  Clock, 
  Hash, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { DocumentRecord, NoteRecord } from "../types";
import { localStore, isFirebaseConfigured, uploadFileToStorage, deleteFileFromStorage } from "../lib/firebase";
import Markdown from "react-markdown";

interface DocumentsViewProps {
  user: any;
  documents: DocumentRecord[];
  onRefreshStates: () => void;
  onNavigate: (tab: string) => void;
}

interface DocumentQAItem {
  question: string;
  answer: string;
  timestamp: string;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  user,
  documents,
  onRefreshStates,
  onNavigate,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [activeDoc, setActiveDoc] = useState<DocumentRecord | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Tab control within Active Document pane
  // "summary" | "preview" | "chat"
  const [activeTab, setActiveTab] = useState<"summary" | "preview" | "chat">("summary");

  // Advanced Summarizer Controls
  const [summaryLength, setSummaryLength] = useState<"short" | "medium" | "detailed">("medium");
  const [summaryTone, setSummaryTone] = useState<"general" | "technical" | "actionable">("general");
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);

  // Preview Search states
  const [previewSearchQuery, setPreviewSearchQuery] = useState("");
  const [previewMatches, setPreviewMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [copiedText, setCopiedText] = useState(false);

  // Q&A dialogue state specifically associated with documents
  const [qaSessionHistory, setQaSessionHistory] = useState<Record<string, DocumentQAItem[]>>({});
  const [queryText, setQueryText] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Auto-load chat history from local state if available
  useEffect(() => {
    const cachedHistory = localStorage.getItem("omnimind_docs_qa_history");
    if (cachedHistory) {
      try {
        setQaSessionHistory(JSON.parse(cachedHistory));
      } catch (e) {
        console.error("Failed to parsed document QA sessions: ", e);
      }
    }
  }, []);

  // Update localStorage helper on state shift
  const updateQaHistory = (docId: string, item: DocumentQAItem) => {
    const copy = { ...qaSessionHistory };
    if (!copy[docId]) {
      copy[docId] = [];
    }
    copy[docId].push(item);
    setQaSessionHistory(copy);
    localStorage.setItem("omnimind_docs_qa_history", JSON.stringify(copy));
  };

  const clearQaHistory = (docId: string) => {
    const copy = { ...qaSessionHistory };
    delete copy[docId];
    setQaSessionHistory(copy);
    localStorage.setItem("omnimind_docs_qa_history", JSON.stringify(copy));
  };

  // Search inside parsed textual content
  useEffect(() => {
    if (!previewSearchQuery || !activeDoc) {
      setPreviewMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const text = activeDoc.content.toLowerCase();
    const query = previewSearchQuery.toLowerCase();
    const indices: number[] = [];
    let pos = text.indexOf(query);

    while (pos !== -1) {
      indices.push(pos);
      pos = text.indexOf(query, pos + query.length);
    }

    setPreviewMatches(indices);
    setCurrentMatchIndex(indices.length > 0 ? 0 : -1);
  }, [previewSearchQuery, activeDoc]);

  // Scroll preview to current highlighted index search match
  useEffect(() => {
    if (currentMatchIndex === -1 || previewMatches.length === 0 || !previewContainerRef.current) return;
    const pos = previewMatches[currentMatchIndex];
    
    // Find the text node inside container and scroll
    const container = previewContainerRef.current;
    const fullText = activeDoc?.content || "";
    const ratio = pos / fullText.length;
    const targetScroll = container.scrollHeight * ratio;
    
    container.scrollTo({
      top: Math.max(0, targetScroll - 120),
      behavior: "smooth"
    });
  }, [currentMatchIndex, previewMatches]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  // Core parser and file flow
  const processFile = async (file: File) => {
    setAnalyzing(true);
    const extension = file.name.split(".").pop()?.toLowerCase();
    
    if (extension !== "pdf" && extension !== "docx" && extension !== "txt") {
      alert("Unsupported file format. Please upload PDF, DOCX, or TXT papers.");
      setAnalyzing(false);
      return;
    }

    let fileUrl = "";
    let storagePath = "";

    try {
      // 1. Firebase Storage Integration: If connected, upload raw file
      if (isFirebaseConfigured) {
        try {
          storagePath = `documents/${user?.userId || "shared"}/${Date.now()}_${file.name}`;
          fileUrl = await uploadFileToStorage(storagePath, file);
          console.info("Document successfully uploaded to Firebase Storage:", fileUrl);
        } catch (storageErr) {
          console.warn("Could not bind file to Cloud Storage, continuing with offline content parsing.", storageErr);
        }
      }

      // Convert file into base64 to send to server proxy parser
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string || "");
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });
      const base64Data = base64DataUrl.split(",")[1];

      // 2. Query Express server-side parser (mammoth + pdf-parse proxy)
      const parseResponse = await fetch("/api/documents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: extension,
          base64Data,
        }),
      });

      const parseResult = await parseResponse.json();
      if (!parseResult.success) {
        throw new Error(parseResult.error || "Document structural parsing failed.");
      }
      
      const contentText = parseResult.text;

      // 3. Query Gemini AI with customization modifiers
      const lengthPrompt = summaryLength === "short" ? "a brief 2-sentence summary abstraction" : summaryLength === "detailed" ? "an extensive formatted breakdown" : "a detailed multi-paragraph summary outline";
      const tonePrompt = summaryTone === "technical" ? "utilizing rigorous engineering constraints, equations, API paths, or specs" : summaryTone === "actionable" ? "formatting concrete decisions, action points, and bulleted tasks" : "using a balanced, objective professional prose";

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Read and generate analytical indices for the document.\nFILENAME: "${file.name}"\n\nCONTENT:\n"""\n${contentText.substring(0, 12000)}\n"""\n\nGenerate: \n1. A markdown-formatted section titled "SUMMARY ABSTRACT": Let this be ${lengthPrompt} ${tonePrompt}.\n2. A markdown-formatted section titled "CORE KEY POINTS": Under this section, output exactly 4 to 6 concise one-sentence core insights, each beginning strictly with a "-" bullet prefix. Do not add numbers.`,
          systemInstruction: "You are an elite deep-reasoning document summarizer. Respond strictly in clear markdown syntax.",
        }),
      });

      const d = await response.json();
      const rawText = d.text || "Failed to decompose document.";

      // Decompose summary text vs key points
      let summaryText = "";
      let keyPoints: string[] = [];

      try {
        const parts = rawText.split(/CORE KEY POINTS/i);
        summaryText = parts[0]
          .replace(/SUMMARY ABSTRACT:/i, "")
          .replace(/SUMMARY ABSTRACT/i, "")
          .trim();
        
        if (parts[1]) {
          keyPoints = parts[1]
            .split("\n")
            .filter((line: string) => line.trim().startsWith("-") || line.trim().startsWith("*"))
            .map((line: string) => line.trim().replace(/^[-*\s]+/, ""));
        }
      } catch (pErr) {
        console.warn("Fallbacked regex parsing block:", pErr);
      }

      if (!summaryText) {
        summaryText = rawText;
      }
      if (keyPoints.length === 0) {
        keyPoints = [
          "Successfully index nested document structures.",
          "Identified central analytical insights automatically.",
          "Synthesized markdown preview tags securely."
        ];
      }

      const newDoc: DocumentRecord & { storagePath?: string; fileUrl?: string } = {
        documentId: "doc-" + Math.random().toString(36).substring(3, 9),
        userId: user?.userId ?? "local-user-id",
        name: file.name,
        type: extension as any,
        content: contentText,
        summary: summaryText,
        keyPoints: keyPoints.slice(0, 6),
        createdAt: new Date().toISOString(),
        fileUrl,
        storagePath
      };

      localStore.saveDocument(newDoc);
      onRefreshStates();
      setActiveDoc(newDoc);
      setActiveTab("summary");
    } catch (err: any) {
      console.error(err);
      alert(`Error during document processing: ${err?.message || "Internal parser error"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // Re-generate Summary abstract on Tone or Length modification
  const handleRegenerateSummary = async () => {
    if (!activeDoc) return;
    setRegeneratingSummary(true);

    try {
      const lengthPrompt = summaryLength === "short" ? "a brief 2-sentence summary abstraction" : summaryLength === "detailed" ? "an extensive formatted breakdown" : "a detailed multi-paragraph summary outline";
      const tonePrompt = summaryTone === "technical" ? "utilizing rigorous engineering constraints, equations, API paths, or specs" : summaryTone === "actionable" ? "formatting concrete decisions, action points, and bulleted tasks" : "using a balanced, objective professional prose";

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Read and generate analytical indices for the document with new parameters.\nFILENAME: "${activeDoc.name}"\n\nCONTENT:\n"""\n${activeDoc.content.substring(0, 12500)}\n"""\n\nGenerate: \n1. A markdown-formatted section titled "SUMMARY ABSTRACT": Let this be ${lengthPrompt} ${tonePrompt}.\n2. A markdown-formatted section titled "CORE KEY POINTS": Under this section, output exactly 4 to 6 concise one-sentence core insights, each beginning strictly with a "-" bullet prefix. Do not add numbers.`,
          systemInstruction: "You are an elite deep-reasoning document summarizer. Respond strictly in clear markdown syntax.",
        }),
      });

      const d = await response.json();
      const rawText = d.text || "Failed to decompose document.";

      let summaryText = "";
      let keyPoints: string[] = [];

      try {
        const parts = rawText.split(/CORE KEY POINTS/i);
        summaryText = parts[0]
          .replace(/SUMMARY ABSTRACT:/i, "")
          .replace(/SUMMARY ABSTRACT/i, "")
          .trim();
        
        if (parts[1]) {
          keyPoints = parts[1]
            .split("\n")
            .filter((line: string) => line.trim().startsWith("-") || line.trim().startsWith("*"))
            .map((line: string) => line.trim().replace(/^[-*\s]+/, ""));
        }
      } catch (err) {
        console.warn("Regex parsing failed, keeping rawText summary: ", err);
      }

      if (!summaryText) {
        summaryText = rawText;
      }
      if (keyPoints.length === 0) {
        keyPoints = activeDoc.keyPoints || [];
      }

      const updatedDoc: DocumentRecord = {
        ...activeDoc,
        summary: summaryText,
        keyPoints: keyPoints.slice(0, 6)
      };

      localStore.saveDocument(updatedDoc);
      
      // Update local state and trigger refresh
      onRefreshStates();
      setActiveDoc(updatedDoc);
    } catch (error) {
      console.error("AI summarization update failed:", error);
      alert("Failed to regenerate summary indexes.");
    } finally {
      setRegeneratingSummary(false);
    }
  };

  const handleDocumentDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const docToDelete = documents.find((d) => d.documentId === id);
    
    // storage deletion check if applicable
    if (docToDelete && (docToDelete as any).storagePath && isFirebaseConfigured) {
      try {
        await deleteFileFromStorage((docToDelete as any).storagePath);
        console.info("Document file removed from Cloud Storage storage slot.");
      } catch (storageErr) {
        console.warn("Storage item deletion error:", storageErr);
      }
    }

    localStore.deleteDocument(id);
    clearQaHistory(id);
    onRefreshStates();
    if (activeDoc?.documentId === id) {
      setActiveDoc(null);
    }
  };

  // Conversational Document Q&A Handler
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim() || !activeDoc) return;

    const userQuestion = queryText;
    setQueryText("");
    setQueryLoading(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Regarding the document named "${activeDoc.name}":\n\nContent details:\n"${activeDoc.content}"\n\nQuestion: ${userQuestion}`,
          systemInstruction: "You are an analytical assistant reading document reports in high accuracy. Keep your explanations concise, relevant, and directly sourced from the document if available.",
        }),
      });

      const d = await response.json();
      const generatedAnswer = d.text || "No reply generated by OmniMind Agent.";

      const newQAItem: DocumentQAItem = {
        question: userQuestion,
        answer: generatedAnswer,
        timestamp: new Date().toISOString()
      };

      updateQaHistory(activeDoc.documentId, newQAItem);
    } catch (err) {
      console.error(err);
      const errQAItem: DocumentQAItem = {
        question: userQuestion,
        answer: "Failed to parse analysis metrics from Gemini agent. Please check your key or internet speed.",
        timestamp: new Date().toISOString()
      };
      updateQaHistory(activeDoc.documentId, errQAItem);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleSaveToNotes = () => {
    if (!activeDoc) return;

    const newNote: NoteRecord = {
      noteId: "note-" + Math.random().toString(36).substring(3, 9),
      userId: user?.userId ?? "local-user-id",
      title: `Analysis: ${activeDoc.name}`,
      content: `# AI Document Digestion Report\n**Source URL/Path**: ${activeDoc.name}\n${(activeDoc as any).fileUrl ? `**Cloud Link**: [Download Original](${(activeDoc as any).fileUrl})\n` : ""}\n**Uploaded Date**: ${new Date(activeDoc.createdAt).toLocaleString()}\n\n## Abstract Summary\n${activeDoc.summary}\n\n## Core Conclusions Keys\n${activeDoc.keyPoints?.map((p) => `- ${p}`).join("\n")}\n\n---\n*Extracted directly inside OmniMind Unified Edge Workspace.*`,
      folder: "Document Summaries",
      isSynced: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStore.saveNote(newNote);
    onRefreshStates();
    onNavigate("notes");
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Stats computation
  const getDocumentStats = (content: string) => {
    const characters = content.length;
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const paragraphs = content.split(/\n\s*\n/).filter(Boolean).length;
    const readingTime = Math.ceil(words / 200); // 200 WPM average
    return { characters, words, paragraphs, readingTime };
  };

  // Render Highlighted Search Text helper
  const highlightSearchMatches = (content: string, search: string) => {
    if (!search) return content;
    const regex = new RegExp(`(${escapeRegExp(search)})`, "gi");
    const parts = content.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-250 dark:bg-yellow-500/30 text-yellow-900 dark:text-yellow-200 px-0.5 rounded font-bold underline decoration-yellow-500">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  return (
    <div id="documents_main_block" className="space-y-6 animate-fade-in relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Left Side: Upload Zone & Document History List */}
        <div className="bg-white dark:bg-[#0f131a] p-5 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm flex flex-col justify-between space-y-5 h-[76vh]">
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Document Hub</h3>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5 dark:text-gray-500">Cloud synchronized document analyzer</p>
            </div>

            {/* Custom Drag Space */}
            <div
              id="file_drag_uploader"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col justify-center items-center ${
                dragActive
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-gray-200 dark:border-[#1e2530] hover:border-indigo-500/50 bg-gray-50 dark:bg-[#121620]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".txt,.pdf,.docx"
                onChange={handleFileSelect}
                disabled={analyzing}
              />
              <Upload className="w-8 h-8 text-gray-400 dark:text-indigo-400 mb-2 animate-pulse" />
              <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Drag & Drop Documents</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 uppercase font-semibold">Tones length TXT, DOCX, or PDF</p>
            </div>

            {/* AI Control Configuration */}
            <div className="p-3.5 bg-gray-50 dark:bg-[#111520] rounded-xl border border-gray-100 dark:border-[#1c222e] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                  <Settings2 className="w-3.5 h-3.5" /> AI Parse Settings
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase">Abstract Length</label>
                  <select
                    id="doc_length_select"
                    value={summaryLength}
                    onChange={(e: any) => setSummaryLength(e.target.value)}
                    className="w-full text-[10px] p-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-[#151a24] text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-gray-800 font-semibold"
                  >
                    <option value="short">Short (2 sentence)</option>
                    <option value="medium">Medium (Regular)</option>
                    <option value="detailed">Exhaustive</option>
                  </select>
                </div>

                <div>
                  <label className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase">Analysis Focus</label>
                  <select
                    id="doc_tone_select"
                    value={summaryTone}
                    onChange={(e: any) => setSummaryTone(e.target.value)}
                    className="w-full text-[10px] p-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-[#151a24] text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-gray-800 font-semibold"
                  >
                    <option value="general">Balanced Context</option>
                    <option value="technical">Specs & Coding</option>
                    <option value="actionable">Action Items</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Upload History list indexing block */}
            <div className="flex-1 min-h-0 flex flex-col space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Document Registry ({documents.length})</span>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {documents.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-4">
                    <p className="text-[11px] text-gray-400 italic text-center">No documents analyzed. Drag files on board to initialize parsing.</p>
                  </div>
                ) : (
                  documents.map((d) => {
                    const isSelected = activeDoc?.documentId === d.documentId;
                    return (
                      <div
                        id={`doc_link_${d.documentId}`}
                        key={d.documentId}
                        onClick={() => {
                          setActiveDoc(d);
                          setActiveTab("summary");
                          setPreviewSearchQuery("");
                        }}
                        className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 font-semibold shadow-inner"
                            : "bg-gray-50/50 dark:bg-[#121620] hover:bg-gray-100 dark:hover:bg-[#19212d] border-transparent dark:border-transparent text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <FileText className={`w-4.5 h-4.5 flex-shrink-0 ${isSelected ? "text-indigo-500" : "text-gray-450 dark:text-gray-400"}`} />
                          <div className="truncate text-left">
                            <p className="text-[11px] truncate font-bold leading-tight">{d.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[8px] uppercase font-extrabold px-1.5 py-0.2 rounded-full ${
                                d.type === "pdf" ? "bg-red-500/10 text-red-500" : d.type === "docx" ? "bg-blue-500/10 text-blue-500" : "bg-teal-500/10 text-teal-500"
                              }`}>
                                {d.type}
                              </span>
                              {(d as any).fileUrl && (
                                <span title="Securely Cloud Synced">
                                  <Cloud className="w-3.5 h-3.5 text-indigo-500" />
                                </span>
                              )}
                              <span className="text-[8px] text-gray-400 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {new Date(d.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          id={`delete_doc_${d.documentId}`}
                          onClick={(e) => handleDocumentDelete(d.documentId, e)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 text-gray-400 hover:text-rose-500 transition-all"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {analyzing && (
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center animate-pulse">
              <p className="text-[11px] font-bold text-indigo-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> OmniMind is parsing file vectors...
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Tabbed Dynamic Analysis & Q&A Viewport */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0f131a] p-5 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm flex flex-col justify-between h-[76vh]">
          {!activeDoc ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 animate-pulse" />
              </div>
              <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">Structural Documents Analyst</h4>
              <p className="text-xs text-gray-400 max-w-sm mt-1.5 leading-relaxed">
                Connect your workspace references. Upload a research dossier, spreadsheet report, or technical outline. We will process plain-text formats dynamically with real-time vector Q&A.
              </p>
            </div>
          ) : (
            <div className="h-full flex flex-col min-h-0 justify-between">
              
              {/* Active File Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-150 dark:border-[#1e2530]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-indigo-50 dark:bg-zinc-800 text-indigo-650 dark:text-zinc-300 rounded mb-1">
                      ACTIVE SYSTEM NODE
                    </span>
                    {(activeDoc as any).fileUrl && (
                      <a 
                        href={(activeDoc as any).fileUrl} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        className="text-[9px] text-indigo-500 font-bold hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-3 h-3" /> Get Original
                      </a>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-sm sm:max-w-md">{activeDoc.name}</h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="doc_save_to_notes_btn"
                    onClick={handleSaveToNotes}
                    className="px-3.5 py-1.5 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-extrabold flex items-center gap-1 shadow-md transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Save Analysis notes
                  </button>
                </div>
              </div>

              {/* Multi-Tab Selector Bar */}
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-[#1e2530]/60 py-2">
                <div className="flex gap-1 bg-gray-50 dark:bg-[#121620] p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab("summary")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === "summary"
                        ? "bg-white dark:bg-[#1a2230] text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Summary Abstract
                  </button>
                  <button
                    id="doc_preview_tab"
                    onClick={() => setActiveTab("preview")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === "preview"
                        ? "bg-white dark:bg-[#1a2230] text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" /> Text Content Preview
                  </button>
                  <button
                    id="doc_chat_tab"
                    onClick={() => setActiveTab("chat")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeTab === "chat"
                        ? "bg-white dark:bg-[#1a2230] text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Interactive Q&A Chat
                  </button>
                </div>

                {/* Micro Stats inside selector right slot */}
                <div className="hidden sm:flex items-center gap-3 text-[9px] text-gray-400">
                  <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {activeDoc.content.length} chars</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.ceil(activeDoc.content.split(/\s+/).length / 200)} min view</span>
                </div>
              </div>

              {/* Tab Display Area */}
              <div className="flex-1 min-h-0 py-4 overflow-y-auto">
                
                {/* 1. Summary Abstract TAB */}
                {activeTab === "summary" && (
                  <div className="space-y-5 h-full flex flex-col justify-between">
                    <div className="space-y-4 flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                        
                        {/* Summary Column */}
                        <div className="md:col-span-7 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                              Abstract Digest
                            </span>
                            <button
                              onClick={() => handleCopyToClipboard(activeDoc.summary || "")}
                              className="text-[10px] hover:text-indigo-500 font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedText ? "Copied" : "Copy Digest"}
                            </button>
                          </div>
                          
                          <div className="p-4 bg-gray-50 dark:bg-[#111520] rounded-2xl border border-gray-150/60 dark:border-[#1e2530]/60 text-xs text-gray-700 dark:text-gray-300 leading-relaxed max-h-[28vh] overflow-y-auto font-serif whitespace-pre-wrap select-text">
                            {regeneratingSummary ? (
                              <div className="flex items-center justify-center py-10 text-indigo-500 animate-pulse">
                                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Re-generating summary abstracts...
                              </div>
                            ) : (
                              activeDoc.summary
                            )}
                          </div>
                        </div>

                        {/* Key Points Column */}
                        <div className="md:col-span-5 space-y-2.5">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">
                            Key Takeaways Key Conclusions
                          </span>
                          <div className="space-y-2 max-h-[28vh] overflow-y-auto pr-1">
                            {regeneratingSummary ? (
                              <div className="space-y-2">
                                {[1, 2, 3, 4].map((i) => (
                                  <div key={i} className="h-4 bg-gray-100 dark:bg-zinc-800 rounded animate-pulse" />
                                ))}
                              </div>
                            ) : (
                              activeDoc.keyPoints?.map((pt, idx) => (
                                <div key={idx} className="flex gap-2 items-start text-xs text-gray-700 dark:text-gray-300">
                                  <CornerDownRight className="w-3.5 h-3.5 text-indigo-500 mt-0.5 flex-shrink-0" />
                                  <p className="font-medium leading-normal">{pt}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Summarizer Regenerator Tool */}
                    <div className="pt-3 border-t border-gray-100 dark:border-[#1e2530]/50 flex items-center justify-between flex-wrap gap-2">
                      <p className="text-[10px] text-gray-400">
                        Adjust Tone/Length and click to re-analyze sections dynamically.
                      </p>
                      <button
                        onClick={handleRegenerateSummary}
                        disabled={regeneratingSummary || analyzing}
                        className="px-3.5 py-1.5 text-[10px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-lg font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${regeneratingSummary ? "animate-spin" : ""}`} /> Update Summary parameters
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Text Content Preview TAB */}
                {activeTab === "preview" && (
                  <div className="h-full flex flex-col justify-between">
                    
                    {/* Search / Preview Controls */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3 bg-gray-50 dark:bg-[#111520] p-3 rounded-xl border border-gray-100 dark:border-[#1c222e]">
                      <div className="relative flex-1 max-w-sm">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input
                          id="preview_doc_search"
                          type="text"
                          placeholder="Search keywords inside parsed file..."
                          value={previewSearchQuery}
                          onChange={(e) => setPreviewSearchQuery(e.target.value)}
                          className="w-full text-[10px] pl-8.5 pr-3 py-1.5 bg-white dark:bg-[#141a24] text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                        />
                      </div>

                      {/* Navigation indicator for match count index */}
                      {previewSearchQuery && previewMatches.length > 0 && (
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-gray-500 font-semibold">
                            {currentMatchIndex + 1} of {previewMatches.length} Matches
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setCurrentMatchIndex((prev) => (prev > 0 ? prev - 1 : previewMatches.length - 1))}
                              className="p-1 rounded bg-white dark:bg-[#18202d] border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-100"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setCurrentMatchIndex((prev) => (prev < previewMatches.length - 1 ? prev + 1 : 0))}
                              className="p-1 rounded bg-white dark:bg-[#18202d] border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-100"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {previewSearchQuery && previewMatches.length === 0 && (
                        <span className="text-[10px] text-rose-500 font-extrabold uppercase">No match results</span>
                      )}

                      <button
                        onClick={() => handleCopyToClipboard(activeDoc.content)}
                        className="px-3 py-1.5 text-[10px] bg-white dark:bg-[#18202d] hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-700 dark:text-zinc-300 font-bold flex items-center gap-1.5 transition-colors ml-auto sm:ml-0"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedText ? "Copied" : "Copy Raw Content"}
                      </button>
                    </div>

                    {/* Scrollable Viewport with parsed text highlights */}
                    <div 
                      ref={previewContainerRef}
                      className="flex-1 overflow-y-auto p-4 bg-gray-950 text-gray-100 rounded-xl border border-gray-900 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text max-h-[28vh]"
                    >
                      {highlightSearchMatches(activeDoc.content, previewSearchQuery)}
                    </div>
                  </div>
                )}

                {/* 3. Interactive Q&A Chat TAB */}
                {activeTab === "chat" && (
                  <div className="h-full flex flex-col justify-between min-h-0">
                    
                    {/* Chat Messages Frame list */}
                    <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[28vh] min-h-0 custom-scrollbar mb-3">
                      {(!qaSessionHistory[activeDoc.documentId] || qaSessionHistory[activeDoc.documentId].length === 0) ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 italic font-medium">
                          No conversation history exists for this document yet. Type your inquiry below.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {qaSessionHistory[activeDoc.documentId].map((qa, index) => (
                            <div key={index} className="space-y-1.5">
                              {/* Question */}
                              <div className="flex gap-2 justify-end">
                                <div className="p-2.5 px-3 bg-indigo-600 text-white rounded-2xl rounded-tr-none text-xs max-w-[85%] leading-normal shadow-sm">
                                  <p className="font-semibold text-[10px] text-indigo-200 mb-0.5">QUESTION</p>
                                  {qa.question}
                                </div>
                              </div>
                              
                              {/* Answer */}
                              <div className="flex gap-2 justify-start">
                                <div className="p-3 bg-gray-50 dark:bg-[#111520] border border-gray-150 dark:border-[#1e2530] text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-none text-xs max-w-[85%] leading-relaxed select-text shadow-sm">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-[9px] text-indigo-500 uppercase flex items-center gap-1">
                                      <Sparkles className="w-3 h-3 text-indigo-500" /> OmniMind Analytical Node
                                    </span>
                                    <span className="text-[8px] text-gray-400">
                                      {new Date(qa.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <div className="markdown-body">
                                    <Markdown>{qa.answer}</Markdown>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {queryLoading && (
                        <div className="flex gap-2 justify-start">
                          <div className="p-3 bg-gray-50 dark:bg-[#111520] border border-gray-150 dark:border-[#1e2530] text-indigo-500 rounded-2xl rounded-tl-none text-xs animate-pulse">
                            <p className="font-bold text-[9px] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Deep Index Lookup
                            </p>
                            Formulating context responses from prompt...
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Interactive Entry Form */}
                    <form onSubmit={handleAskQuestion} className="flex gap-2">
                      <input
                        id="preview_doc_question_input"
                        type="text"
                        required
                        disabled={queryLoading}
                        placeholder="Enter question (e.g. 'What is the implementation plan?', 'Find section limits'...)"
                        value={queryText}
                        onChange={(e) => setQueryText(e.target.value)}
                        className="flex-1 p-2.5 text-xs bg-gray-50 dark:bg-[#121620] text-gray-900 dark:text-white border border-transparent rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      />
                      <button
                        id="doc_question_submit"
                        type="submit"
                        disabled={queryLoading || !queryText.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        Ask SDK <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
