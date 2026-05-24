import React, { useState } from "react";
import { Brain, Search, PlusCircle, Bookmark, CheckSquare, Trash, Sparkles } from "lucide-react";
import { KnowledgeItem } from "../types";
import { localStore } from "../lib/firebase";

interface KnowledgeViewProps {
  user: any;
  items: KnowledgeItem[];
  onRefreshStates: () => void;
}

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({
  user,
  items,
  onRefreshStates,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [useAsMemory, setUseAsMemory] = useState(true);

  // Semantic states
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticResults, setSemanticResults] = useState<{ noteId: string; relevanceScore: number }[]>([]);

  const handleSemanticSearch = async (queryStr: string) => {
    if (!queryStr.trim() || items.length === 0) {
      setSemanticResults([]);
      return;
    }
    setSemanticLoading(true);
    try {
      const records = items.map(idx => ({
        noteId: idx.itemId,
        title: idx.title,
        content: idx.body,
      }));
      const response = await fetch("/api/gemini/semantic-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryStr, notes: records }),
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.results)) {
        setSemanticResults(data.results);
      }
    } catch (error) {
      console.error("Semantic search failed:", error);
    } finally {
      setSemanticLoading(false);
    }
  };

  const filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  let displayedItems = filteredItems;
  if (searchMode === "semantic" && searchQuery.trim() && semanticResults.length > 0) {
    displayedItems = [...items]
      .map(item => {
        const scoreObj = semanticResults.find(r => r.noteId === item.itemId);
        return { ...item, score: scoreObj ? scoreObj.relevanceScore : 0 };
      })
      .filter(item => (item.score as number) > 2) // only show relevant items
      .sort((a: any, b: any) => b.score - a.score) as any[];
  }

  const handleCreateKnowledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    const newItem: KnowledgeItem = {
      itemId: "know-" + Math.random().toString(36).substring(3, 9),
      userId: user?.userId ?? "local-user-id",
      title,
      body,
      useAsMemory,
      createdAt: new Date().toISOString(),
    };

    localStore.saveKnowledge(newItem);
    onRefreshStates();
    setTitle("");
    setBody("");
    setAddingNote(false);
  };

  const handleToggleMemorySetting = (item: KnowledgeItem) => {
    const updated: KnowledgeItem = {
      ...item,
      useAsMemory: !item.useAsMemory,
    };
    localStore.saveKnowledge(updated);
    onRefreshStates();
  };

  const handleDeleteItem = (id: string) => {
    localStore.deleteKnowledge(id);
    onRefreshStates();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm">
        <div>
          <h3 className="text-md md:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" /> OmniMind Semantic Knowledge Base
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Integrate notes to act as contextual AI memory when launching conversations
          </p>
        </div>

        <button
          id="knowledge_add_snippet_toggle"
          onClick={() => setAddingNote(!addingNote)}
          className="px-4.5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <PlusCircle className="w-4 h-4" /> {addingNote ? "Close Form" : "Add Memory Field"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col: Add new item or view guidelines */}
        <div className="space-y-6">
          {addingNote ? (
            <form onSubmit={handleCreateKnowledge} className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Add Memory snippet</span>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Title Topic</label>
                <input
                  id="know_title"
                  type="text"
                  required
                  placeholder="e.g., Client deployment guidelines"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-[#141a24] text-gray-900 dark:text-white border border-transparent rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Context information</label>
                <textarea
                  id="know_body"
                  rows={6}
                  required
                  placeholder="Paste rules or private definitions..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full text-xs p-2.5 bg-gray-50 dark:bg-[#141a24] text-gray-900 dark:text-white border border-transparent rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold placeholder-gray-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="know_memory_chk"
                  type="checkbox"
                  checked={useAsMemory}
                  onChange={(e) => setUseAsMemory(e.target.checked)}
                  className="w-4 h-4 text-indigo-500 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">Inject as active AI Memory Context</span>
              </div>

              <button
                id="know_submit_btn"
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1 transition-all"
              >
                Upload to Memory Core
              </button>
            </form>
          ) : (
            <div className="bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block font-sans">Cognitive Memory</span>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Items added to your Knowledge Repository act as specialized context injection vectors. Toggling the <strong className="text-indigo-500">Inject</strong> selector forces the platform backend endpoints to keep those concepts loaded in conversational buffers automatically.
              </p>
              <div className="p-3 bg-indigo-50/25 dark:bg-indigo-950/10 text-[10px] rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-950/30 flex gap-2">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <span>Supports code configurations libraries formatting and markdown sheets.</span>
              </div>
            </div>
          )}
        </div>

        {/* Right col: Search list card */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0f131a] p-6 rounded-2xl border border-gray-100 dark:border-[#1e2530] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Memory Node Repositories</h4>
              <p className="text-xs text-gray-400">Local semantic indices</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-gray-50 dark:bg-[#141a24] p-1 rounded-xl text-[10px] border border-gray-100 dark:border-[#1e2530] select-none shrink-0">
                <button
                  type="button"
                  onClick={() => setSearchMode("keyword")}
                  className={`px-2 py-1 rounded-lg font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                    searchMode === "keyword"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-450 hover:text-indigo-500"
                  }`}
                >
                  Keyword
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchMode("semantic");
                    handleSemanticSearch(searchQuery);
                  }}
                  className={`px-2 py-1 rounded-lg font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                    searchMode === "semantic"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-450 hover:text-indigo-500"
                  }`}
                >
                  AI Semantic
                </button>
              </div>

              <div className="relative min-w-40 sm:min-w-48">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  id="know_search_input"
                  type="text"
                  placeholder={searchMode === "semantic" ? "Ask a concept..." : "Search definitions..."}
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    if (searchMode === "semantic") {
                      handleSemanticSearch(val);
                    }
                  }}
                  className="w-full text-xs pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-[#141a24] text-gray-900 dark:text-white border border-transparent focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl"
                />
              </div>
            </div>
          </div>

          {searchMode === "semantic" && semanticLoading && (
            <p className="text-xs text-indigo-500 font-semibold animate-pulse text-center">Gemini AI scoring knowledge relevance scores...</p>
          )}

          <div className="space-y-4 max-h-[56vh] overflow-y-auto pr-1">
            {displayedItems.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-8">
                {searchMode === "semantic" && searchQuery.trim() 
                  ? "No semantically highly relevant memory records matched." 
                  : "No matching records found in database."}
              </p>
            ) : (
              displayedItems.map((item: any) => (
                <div
                  id={`know_card_${item.itemId}`}
                  key={item.itemId}
                  className="p-4 bg-gray-50 dark:bg-[#141a24] border border-gray-100 dark:border-transparent hover:border-indigo-100 dark:hover:border-indigo-950/40 rounded-2xl transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-indigo-500" />
                      <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200">{item.title}</h5>
                      {searchMode === "semantic" && item.score !== undefined && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded font-bold uppercase tracking-wide">
                          Relevance: {item.score}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        id={`toggle_memory_${item.itemId}`}
                        onClick={() => handleToggleMemorySetting(item)}
                        className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold flex items-center gap-1 transition-all ${
                          item.useAsMemory
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-gray-200 dark:bg-[#131922] text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        Memory: {item.useAsMemory ? "ACTIVE" : "OFF"}
                      </button>

                      <button
                        id={`delete_know_${item.itemId}`}
                        onClick={() => handleDeleteItem(item.itemId)}
                        className="text-gray-400 hover:text-rose-500 p-0.5"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-mono font-medium whitespace-pre-wrap">
                    {item.body}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
