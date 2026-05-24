import React, { useState, useEffect } from "react";
import { Folder, Search, FileText, Plus, Save, Trash, Wifi, WifiOff } from "lucide-react";
import { NoteRecord } from "../types";
import { localStore } from "../lib/firebase";

interface NotesViewProps {
  user: any;
  notes: NoteRecord[];
  onRefreshStates: () => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  user,
  notes,
  onRefreshStates,
}) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("All");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [folder, setFolder] = useState("General");
  const [saving, setSaving] = useState(false);

  // Set first note as active on load
  useEffect(() => {
    if (notes.length > 0 && !selectedNoteId) {
      setSelectedNoteId(notes[0].noteId);
    }
  }, [notes, selectedNoteId]);

  // Load active note details
  useEffect(() => {
    if (selectedNoteId) {
      const activeNote = notes.find((n) => n.noteId === selectedNoteId);
      if (activeNote) {
        setTitle(activeNote.title);
        setContent(activeNote.content);
        setFolder(activeNote.folder || "General");
      }
    } else {
      setTitle("");
      setContent("");
      setFolder("General");
    }
  }, [selectedNoteId, notes]);

  // Folder categorisation aggregation
  const folderTabs = ["All", ...Array.from(new Set(notes.map((n) => n.folder || "General")))];

  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = activeFolder === "All" || n.folder === activeFolder;
    return matchesSearch && matchesFolder;
  });

  const handleCreateNewNote = () => {
    const newNoteId = "note-" + Math.random().toString(36).substring(3, 9);
    const newNote: NoteRecord = {
      noteId: newNoteId,
      userId: user?.userId ?? "local-user-id",
      title: "Untitled Note",
      content: "# Untitled Note\n\nWrite down lists and details here...",
      folder: activeFolder === "All" ? "General" : activeFolder,
      isSynced: true, // Default to true client-cached state
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStore.saveNote(newNote);
    onRefreshStates();
    setSelectedNoteId(newNoteId);
  };

  const handleSaveNote = () => {
    if (!selectedNoteId) return;
    setSaving(true);

    const updated: NoteRecord = {
      noteId: selectedNoteId,
      userId: user?.userId ?? "local-user-id",
      title: title || "Untitled Note",
      content,
      folder: folder || "General",
      isSynced: true,
      createdAt: notes.find((n) => n.noteId === selectedNoteId)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStore.saveNote(updated);
    setTimeout(() => {
      onRefreshStates();
      setSaving(false);
    }, 300);
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    localStore.deleteNote(id);
    onRefreshStates();
    if (selectedNoteId === id) {
      setSelectedNoteId("");
    }
  };

  const activeNote = notes.find((n) => n.noteId === selectedNoteId);

  return (
    <div className="h-[80vh] flex bg-white dark:bg-[#0f131a] rounded-2xl border border-gray-100 dark:border-[#1e2530] overflow-hidden transition-colors duration-200">
      {/* Scrollable list panel */}
      <div id="notes_list_panel" className="w-80 border-r border-gray-100 dark:border-[#1e2530] flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-[#1e2530] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">My Notebook</span>
            <button
              id="notes_create_new"
              onClick={handleCreateNewNote}
              className="p-1 rounded-lg text-indigo-500 hover:bg-gray-50 dark:hover:bg-[#151a24] transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              id="notes_search_input"
              type="text"
              placeholder="Search note tags/body..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-[#151a24] text-gray-900 dark:text-white border border-transparent focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl"
            />
          </div>
        </div>

        {/* Directory Categorisations */}
        <div className="flex gap-1.5 overflow-x-auto p-3.5 border-b border-gray-100 dark:border-[#1e2530] flex-shrink-0">
          {folderTabs.map((fName) => (
            <button
              id={`folder_tab_${fName}`}
              key={fName}
              onClick={() => setActiveFolder(fName)}
              className={`px-3 py-1 text-[10px] uppercase font-bold rounded-full transition-all whitespace-nowrap ${
                activeFolder === fName
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-50 dark:bg-[#141a24] text-gray-500 hover:text-indigo-500"
              }`}
            >
              {fName}
            </button>
          ))}
        </div>

        {/* List of note links */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNotes.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-8">Notebook folder is empty.</p>
          ) : (
            filteredNotes.map((n) => (
              <div
                id={`note_tab_row_${n.noteId}`}
                key={n.noteId}
                onClick={() => setSelectedNoteId(n.noteId)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  selectedNoteId === n.noteId
                    ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#141b25]"
                }`}
              >
                <div className="flex-1 truncate pr-2">
                  <p className="text-xs font-bold truncate">{n.title || "Untitled"}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap overflow-hidden truncate">
                    {n.content ? n.content.replace(/[#*_\n]/g, "").substring(0, 32) : "Empty doc."}
                  </p>
                </div>
                <button
                  id={`delete_note_${n.noteId}`}
                  onClick={(e) => handleDeleteNote(n.noteId, e)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-500 transition-colors"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Note Editor Area */}
      <div className="flex-grow bg-gray-50/30 dark:bg-[#07090e] p-6 flex flex-col justify-between h-full space-y-4">
        {!selectedNoteId ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-2 animate-bounce" />
            <h4 className="text-sm font-bold text-gray-700 dark:text-white">Note Editor Workspace</h4>
            <p className="text-xs text-gray-400 max-w-sm">Pick a note from the left, or compose a new file to save formatting.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between space-y-4 h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-[#1e2530] pb-4">
              <div className="flex-1">
                <input
                  id="editor_title_input"
                  type="text"
                  placeholder="Note title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-lg font-extrabold bg-transparent text-gray-900 dark:text-white focus:outline-none placeholder-gray-400"
                />
                {activeNote && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Last modified: {new Date(activeNote.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-[#141b25] text-[10px] font-extrabold text-emerald-500 rounded-xl border border-transparent">
                  <Wifi className="w-3.5 h-3.5" /> CACHED OFFLINE
                </div>

                <button
                  id="notebook_save_action"
                  onClick={handleSaveNote}
                  disabled={saving}
                  className="px-4.5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Note"}
                </button>
              </div>
            </div>

            {/* Editing Field split inputs */}
            <div className="flex gap-2 text-xs">
              <span className="text-gray-400 font-semibold uppercase tracking-wider block mt-1.5 whitespace-nowrap">Folder:</span>
              <input
                id="editor_folder_input"
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="p-1 px-3.5 bg-white dark:bg-[#0f131a] text-gray-900 dark:text-white border border-gray-100 dark:border-[#1e2530] rounded-xl focus:outline-none font-semibold focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <textarea
              id="editor_content_area"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full p-4 text-xs font-mono bg-white dark:bg-[#0f131a] text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-[#1e2530] rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all placeholder-gray-400"
              placeholder="# Markdown header&#10;&#10;Write markdown lists and information modules..."
            />
          </div>
        )}
      </div>
    </div>
  );
};
