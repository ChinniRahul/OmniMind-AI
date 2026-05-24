import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, Plus, Trash2, Search, Volume2, Mic, MicOff, Code, Languages, PenTool, BookOpen, FileSpreadsheet, FileText, UserSquare2, VolumeX, Terminal, Pin, Clipboard, Check, Square, Edit3 } from "lucide-react";
import { ChatSession, ChatMessage } from "../types";
import { useChat } from "../lib/useChat";
import Markdown from "react-markdown";

interface ChatViewProps {
  user: any;
  chats: ChatSession[];
  onRefreshStates: () => void;
  knowledgeContext?: string; // Passed from active memory context snippets
}

export const ChatView: React.FC<ChatViewProps> = ({
  user,
  chats: initialChats,
  onRefreshStates,
  knowledgeContext = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showVoiceDeck, setShowVoiceDeck] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Initialize our centralized useChat hook
  const {
    chats,
    activeChatId,
    setActiveChatId,
    messages,
    inputText,
    setInputText,
    selectedCategory,
    setSelectedCategory,
    targetLanguage,
    setTargetLanguage,
    generating,
    recording,
    speechLanguage,
    setSpeechLanguage,
    copiedMessageId,
    ttsLoadingId,
    playingAudio,
    setPlayingAudio,
    editingMessageId,
    editInputText,
    setEditInputText,
    handleCreateNewChat,
    handleDeleteChat,
    handleTogglePinChat,
    handleSendMessage,
    handleStopGeneration,
    handleRegenerateResponse,
    handleCopyMessageText,
    handleInitiateEditMessage,
    handleSaveEditedMessage,
    handleTalkMessage,
    handleMicrophoneCaptureLocal,
    playbackSpeed,
    setPlaybackSpeed,
    activeVoice,
    setActiveVoice,
    continuousListening,
    setContinuousListening,
    voiceCommandMode,
    setVoiceCommandMode,
    recognizedCommand,
    setRecognizedCommand,
  } = useChat({ user });

  // Sync back state updates on actions (creating/deleting chats) to refresh dashboard items
  useEffect(() => {
    onRefreshStates();
  }, [chats.length]);

  // Handle auto scrolling smoothly on new inputs or generating streams
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, generating]);

  // Categories definitions mapping
  const categories: Record<string, { label: string; icon: any; color: string; directive: string }> = {
    general: {
      label: "Conversational AI",
      icon: Sparkles,
      color: "from-blue-600 to-indigo-600",
      directive: "Conversational Chat Model",
    },
    coder: {
      label: "AI Code Generator",
      icon: Code,
      color: "from-purple-600 to-[#6366f1]",
      directive: "Generates elegant code blocks with full types.",
    },
    debugger: {
      label: "AI Debugger Assistant",
      icon: Terminal,
      color: "from-rose-600 to-[#6366f1]",
      directive: "Audits scripts, highlights logical errors, and outputs corrected scripts.",
    },
    "content-writer": {
      label: "AI Content Writer",
      icon: PenTool,
      color: "from-amber-600 to-[#6366f1]",
      directive: "Write summaries, newsletters, copywriting drafts, and blog articles.",
    },
    translator: {
      label: "AI Translator",
      icon: Languages,
      color: "from-emerald-600 to-[#6366f1]",
      directive: "Translate text directly in preferred language.",
    },
    summarizer: {
      label: "AI Summarizer",
      icon: FileText,
      color: "from-teal-600 to-[#6366f1]",
      directive: "Compile document snippets to clean structured bullets rosters.",
    },
    "study-assistant": {
      label: "AI Study Assistant",
      icon: BookOpen,
      color: "from-cyan-600 to-[#6366f1]",
      directive: "Synthesize textbook modules and print brief interactive revision quizzes.",
    },
    "resume-builder": {
      label: "AI Resume Builder",
      icon: FileSpreadsheet,
      color: "from-violet-600 to-[#6366f1]",
      directive: "Organize CV nodes into ATS-compliant markdown blocks.",
    },
    "interview-prep": {
      label: "AI Interview Prep",
      icon: UserSquare2,
      color: "from-pink-600 to-[#6366f1]",
      directive: "Simulates manager interview sessions and technical recruiters prompts.",
    },
  };

  const speechLanguages = [
    { label: "English", code: "en-US" },
    { label: "Spanish", code: "es-ES" },
    { label: "French", code: "fr-FR" },
    { label: "German", code: "de-DE" },
    { label: "Japanese", code: "ja-JP" },
    { label: "Chinese", code: "zh-CN" },
    { label: "Hindi", code: "hi-IN" },
  ];

  // Filter existing active chats inside sidebar query
  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="chats_main_panel" className="h-[80vh] flex bg-white dark:bg-[#0f131a] rounded-2xl border border-gray-100 dark:border-[#1e2530] overflow-hidden transition-colors duration-200 shadow-sm">
      
      {/* Sidebar Sessions History */}
      <div id="chats_history_col" className="w-[280px] sm:w-[320px] border-r border-gray-100 dark:border-[#1e2530] flex flex-col hidden md:flex flex-shrink-0 bg-gray-50/10 dark:bg-[#0b0f14]">
        <div className="p-4 border-b border-gray-100 dark:border-[#1e2530] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider uppercase text-gray-400">Conversations</span>
            <button
              id="chat_add_session_btn"
              onClick={handleCreateNewChat}
              className="p-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a222e] text-indigo-500 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              id="conversation_search"
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8.5 pr-3 py-2 bg-gray-50 dark:bg-[#151a24] text-gray-900 dark:text-white border border-transparent focus:ring-1 focus:ring-indigo-500 focus:outline-none rounded-xl"
            />
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredChats.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-6">No threads found.</p>
          ) : (
            filteredChats.map((c) => (
              <div
                id={`chat_session_tab_${c.chatId}`}
                key={c.chatId}
                onClick={() => setActiveChatId(c.chatId)}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all text-xs ${
                  activeChatId === c.chatId
                    ? "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 font-bold"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50/80 dark:hover:bg-[#131a23]"
                }`}
              >
                <div className="flex-1 truncate pr-2">
                  <p className="truncate font-semibold flex items-center gap-1">
                    {c.isPinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />}
                    {c.title || "New thread"}
                  </p>
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
                    {c.category ? categories[c.category]?.label : "Conversational"}
                  </p>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    id={`pin_chat_${c.chatId}`}
                    onClick={(e) => handleTogglePinChat(c, e)}
                    className="p-1 rounded text-gray-400 hover:text-amber-500 cursor-pointer"
                    title={c.isPinned ? "Unpin chat" : "Pin chat"}
                  >
                    <Pin className={`w-3 h-3 ${c.isPinned ? "fill-amber-500 text-amber-500" : ""}`} />
                  </button>
                  <button
                    id={`delete_chat_${c.chatId}`}
                    onClick={(e) => handleDeleteChat(c.chatId, e)}
                    className="p-1 rounded text-gray-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Pane (Middle Chat Feed + Voice Assistant Panel) */}
      <div className="flex-1 flex h-full overflow-hidden relative">
        {/* Main Chat Conversation Core */}
        <div className="flex-1 flex flex-col justify-between bg-gray-50/30 dark:bg-[#07090e] h-full relative">
        
        {/* Tool Category Panel Bar */}
        <div className="p-4 bg-white dark:bg-[#0f131a] border-b border-gray-100 dark:border-[#1e2530] flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 flex items-center justify-center">
              {React.createElement(categories[selectedCategory]?.icon || Sparkles, { className: "w-5 h-5" })}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                  {categories[selectedCategory]?.label}
                </span>
                {knowledgeContext && (
                  <span className="text-[9px] px-2 py-0.5 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-full font-bold uppercase tracking-wider">
                    AI Memory ON
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-450 line-clamp-1">{categories[selectedCategory]?.directive}</p>
            </div>
          </div>

          {/* Sub Toolbar details */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              id="assistant_modality_select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 dark:bg-[#141b25] text-gray-900 dark:text-white rounded-xl border border-transparent font-medium"
            >
              <option value="general">Conversational AI</option>
              <option value="coder">AI Code Generator</option>
              <option value="debugger">AI Debugger Assistant</option>
              <option value="content-writer">AI Content Writer</option>
              <option value="translator">AI Translator</option>
              <option value="summarizer">AI Summarizer</option>
              <option value="study-assistant">AI Study Assistant</option>
              <option value="resume-builder">AI Resume Builder</option>
              <option value="interview-prep">AI Interview Prep</option>
            </select>

            {selectedCategory === "translator" && (
              <input
                id="translator_lang_input"
                type="text"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-24 p-1.5 text-xs bg-gray-50 dark:bg-[#141b25] text-gray-900 dark:text-white border border-transparent rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400 font-semibold"
                placeholder="Target Language"
              />
            )}

            {playingAudio && (
              <button
                id="stop_narration_btn"
                onClick={() => {
                  playingAudio.pause();
                  setPlayingAudio(null);
                }}
                className="p-1 px-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:text-rose-600 rounded-xl text-xs flex items-center gap-1 border border-rose-100 dark:border-rose-950/40 cursor-pointer"
              >
                <VolumeX className="w-3.5 h-3.5" /> Stop Voice
              </button>
            )}

            <button
              id="toggle_voice_deck_btn"
              type="button"
              onClick={() => setShowVoiceDeck(!showVoiceDeck)}
              className={`p-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                showVoiceDeck
                  ? "bg-indigo-600 text-white border-indigo-655 shadow-sm"
                  : "bg-gray-50 hover:bg-gray-100 dark:bg-[#141b25] text-gray-750 dark:text-gray-300 border-transparent hover:border-gray-200 dark:hover:border-zinc-700"
              }`}
            >
              <Mic className={`w-3.5 h-3.5 ${showVoiceDeck ? "animate-pulse" : ""}`} />
              <span>Voice Deck</span>
              {continuousListening && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-[ping_1.5s_infinite]" />
              )}
            </button>
          </div>
        </div>

        {/* Messaging Box container scroll list layout */}
        <div id="messages_scroll_box" className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeChatId ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3 select-none">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 flex items-center justify-center animate-bounce">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-extrabold text-gray-950 dark:text-white">Start OmniMind Intelligence Engine</h4>
              <p className="text-xs text-gray-400 max-w-sm">
                Initialize clean cloud synchronization sessions and stream complex deep reasoning requests securely.
              </p>
              <button
                id="chat_empty_create"
                onClick={handleCreateNewChat}
                className="px-4.5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-md cursor-pointer"
              >
                Launch Conversation Thread
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-xs text-gray-400 italic select-none">
              Compose a message below to coordinate streaming computations.
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === "user";
              const isEditing = editingMessageId === m.messageId;

              return (
                <div
                  id={`msg_bubble_${m.messageId}`}
                  key={m.messageId}
                  className={`flex gap-3 max-w-3xl group ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold leading-none ${
                      isUser
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 dark:bg-[#1d2633] text-gray-600 dark:text-indigo-400"
                    }`}
                  >
                    {isUser ? "U" : "AI"}
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div
                      className={`p-4 rounded-2xl border ${
                        isUser
                          ? "bg-indigo-600 text-white border-indigo-650"
                          : "bg-white dark:bg-[#0f131a] text-gray-800 dark:text-gray-200 border-gray-100 dark:border-[#1e2530] shadow-sm"
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editInputText}
                            onChange={(e) => setEditInputText(e.target.value)}
                            className="w-full text-xs p-2 bg-transparent text-white dark:text-gray-100 focus:outline-none border border-black/10 dark:border-white/20 rounded-lg resize-none font-sans"
                            rows={3}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditInputText("")}
                              className="px-2.5 py-1 text-[10px] bg-white/10 dark:bg-zinc-800 text-gray-400 dark:text-gray-105 rounded-md font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEditedMessage(m.messageId, knowledgeContext)}
                              className="px-2.5 py-1 text-[10px] bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 bg-white text-indigo-600 rounded-md font-extrabold cursor-pointer hover:bg-white/80"
                            >
                              Retry Prompt
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="markdown-body font-sans text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap select-text selection:bg-indigo-500/30">
                          {isUser ? (
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          ) : (
                            <div className="markdown-body">
                              <Markdown
                                components={{
                                  code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || "");
                                    const cstring = String(children).replace(/\n$/, "");
                                    return !inline && match ? (
                                      <div className="my-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-950 text-gray-100 overflow-hidden shadow-sm shadow-black/40">
                                        <div className="flex bg-gray-900 px-4 py-1.5 justify-between items-center text-[9px] font-mono tracking-wider uppercase text-gray-400 border-b border-gray-800 select-none">
                                          <span>{match[1]}</span>
                                          <button
                                            onClick={() => navigator.clipboard.writeText(cstring)}
                                            className="hover:text-white flex items-center gap-1 cursor-pointer"
                                          >
                                            Copy Snippet
                                          </button>
                                        </div>
                                        <pre className="p-3.5 overflow-x-auto text-[11px] font-mono leading-normal">
                                          <code>{cstring}</code>
                                        </pre>
                                      </div>
                                    ) : (
                                      <code className="p-0.5 px-1.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-mono text-gray-705 dark:text-gray-300" {...props}>
                                        {children}
                                      </code>
                                    );
                                  }
                                }}
                              >
                                {m.content}
                              </Markdown>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Toolbar actions on hovered bubbles */}
                    {!isEditing && (
                      <div className="flex items-center gap-2 pl-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity select-none">
                        <button
                          onClick={() => handleCopyMessageText(m.content, m.messageId)}
                          className="p-1 rounded hover:bg-gray-150 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                          title="Copy text block"
                        >
                          {copiedMessageId === m.messageId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Clipboard className="w-3.5 h-3.5" />}
                        </button>

                        {isUser ? (
                          <button
                            onClick={() => handleInitiateEditMessage(m)}
                            className="p-1 rounded hover:bg-gray-150 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-650 dark:hover:text-gray-350 cursor-pointer"
                            title="Edit prompt"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleTalkMessage(m)}
                              className="p-1 rounded hover:bg-gray-150 dark:hover:bg-gray-800 text-gray-400 hover:text-indigo-500 cursor-pointer"
                              title="Narrate output"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                            {ttsLoadingId === m.messageId && <span className="text-[9px] text-gray-450 animate-pulse">Rendering Voice...</span>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Generative streaming update */}
          {generating && (
            <div className="flex items-center gap-2 text-xs text-indigo-500 font-bold bg-indigo-50/25 dark:bg-indigo-950/10 p-2.5 rounded-xl border border-indigo-500/20 w-fit select-none animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>OmniMind AI is streaming output...</span>
              <button
                onClick={handleStopGeneration}
                className="ml-3 p-1 px-2.5 bg-rose-500 hover:bg-rose-600 text-white text-[10px] rounded-lg font-extrabold flex items-center gap-1 cursor-pointer border border-transparent shadow transition-colors"
              >
                <Square className="w-2.5 h-2.5 fill-white" /> STOP
              </button>
            </div>
          )}

          {/* Anchor spacer */}
          <div ref={chatBottomRef} />
        </div>

        {/* Input panel container */}
        {activeChatId && (
          <div className="p-4 bg-white dark:bg-[#0f131a] border-t border-gray-100 dark:border-[#1e2530] space-y-3">
            <form
              onSubmit={(e) => handleSendMessage(e, knowledgeContext)}
              className="flex gap-2 items-center bg-gray-50 dark:bg-[#151a24] p-2 pr-3 rounded-xl border border-transparent focus-within:ring-2 focus-within:ring-indigo-500/40 transition-all select-text"
            >
              
              {/* STT voice recorder button */}
              <button
                id="mic_toggle_bt_stt"
                type="button"
                onClick={handleMicrophoneCaptureLocal}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  recording ? "bg-rose-500 text-white" : "text-gray-400 hover:text-indigo-500"
                }`}
                title="Dictate prompt speech"
              >
                {recording ? (
                  <div className="flex gap-1 items-center">
                    <MicOff className="w-4 h-4 animate-bounce" />
                    <span className="w-0.5 h-2.5 bg-white rounded animate-[pulse_0.3s_infinite_alternate]" />
                    <span className="w-0.5 h-3.5 bg-white rounded animate-[pulse_0.4s_infinite_alternate_0.1s]" />
                  </div>
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              <input
                id="chat_input_text"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={generating}
                autoComplete="off"
                className="flex-1 bg-transparent border-none text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
                placeholder={recording ? "Listening. Speak clearly now..." : `Request to ${categories[selectedCategory]?.label}...`}
              />

              <button
                id="send_message_button"
                type="submit"
                disabled={!inputText.trim() || generating}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-30 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Quick action options bar */}
            <div className="flex justify-between items-center text-[10px] text-gray-400 px-1 select-none">
              <div className="flex items-center gap-2">
                <span>Dictation:</span>
                <select
                  value={speechLanguage}
                  onChange={(e) => setSpeechLanguage(e.target.value)}
                  className="bg-transparent border-none text-[10px] text-indigo-500 font-bold focus:outline-none pb-0.5 cursor-pointer"
                >
                  {speechLanguages.map((l) => (
                    <option key={l.code} value={l.code} className="dark:bg-[#0f131a]">
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {messages.length > 0 && !generating && (
                <button
                  type="button"
                  onClick={() => handleRegenerateResponse(knowledgeContext)}
                  className="text-indigo-500 hover:text-indigo-600 font-bold uppercase tracking-wider cursor-pointer"
                >
                  Regenerate Reply
                </button>
              )}
            </div>
          </div>
        )}
        </div>

        {/* Collapsible Voice Control Board */}
        {showVoiceDeck && (
          <div
            id="voice_assistant_deck"
            className="w-80 border-l border-gray-100 dark:border-[#1e2530] bg-white dark:bg-[#0b0f14] flex flex-col h-full overflow-y-auto animate-fade-in text-xs select-none"
          >
            {/* Title / Close bar */}
            <div className="p-4 border-b border-gray-100 dark:border-[#1e2530] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-indigo-500 animate-pulse" />
                <span className="font-extrabold text-gray-950 dark:text-white uppercase tracking-wider text-[10px]">Voice Assistant Core</span>
              </div>
              <button
                onClick={() => setShowVoiceDeck(false)}
                className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-250 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Dynamic Status / Interactive Visualizer Wave */}
            <div className="p-4 bg-gray-50/50 dark:bg-[#131922] border-b border-gray-100 dark:border-[#171f2a] flex flex-col items-center justify-center py-6 space-y-3">
              {recording ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="flex items-end justify-center gap-1 h-8">
                    <span className="w-1 bg-rose-500 rounded animate-[pulse_0.3s_infinite_alternate]" style={{ height: "16px" }} />
                    <span className="w-1 bg-rose-500 rounded animate-[pulse_0.4s_infinite_alternate_0.1s]" style={{ height: "24px" }} />
                    <span className="w-1 bg-rose-500 rounded animate-[pulse_0.2s_infinite_alternate_0.2s]" style={{ height: "32px" }} />
                    <span className="w-1 bg-rose-500 rounded animate-[pulse_0.5s_infinite_alternate_0.05s]" style={{ height: "20px" }} />
                    <span className="w-1 bg-rose-500 rounded animate-[pulse_0.35s_infinite_alternate_0.15s]" style={{ height: "28px" }} />
                  </div>
                  <span className="text-[10px] font-bold text-rose-500 animate-pulse uppercase tracking-wider">Listening to command...</span>
                </div>
              ) : playingAudio ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="flex items-end justify-center gap-1 h-8">
                    <span className="w-1 bg-indigo-500 rounded animate-[pulse_0.4s_infinite_alternate]" style={{ height: "20px" }} />
                    <span className="w-1 bg-indigo-500 rounded animate-[pulse_0.2s_infinite_alternate_0.1s]" style={{ height: "12px" }} />
                    <span className="w-1 bg-indigo-500 rounded animate-[pulse_0.5s_infinite_alternate_0.2s]" style={{ height: "28px" }} />
                    <span className="w-1 bg-indigo-500 rounded animate-[pulse_0.3s_infinite_alternate_0.05s]" style={{ height: "18px" }} />
                    <span className="w-1 bg-indigo-500 rounded animate-[pulse_0.45s_infinite_alternate_0.15s]" style={{ height: "24px" }} />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Narrating Assistant voice...</span>
                </div>
              ) : ttsLoadingId ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <span className="text-[10px] font-semibold text-gray-450 animate-pulse">Rendering Voice...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2 py-2">
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-750 font-medium">
                    <Mic className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Assistant Standby</span>
                </div>
              )}

              {/* Quick Dictate Trigger button */}
              <button
                type="button"
                onClick={handleMicrophoneCaptureLocal}
                className={`w-full py-2 border rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  recording
                    ? "bg-rose-500 border-rose-600 text-white hover:bg-rose-600 shadow"
                    : "bg-indigo-600 border-indigo-700 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/10"
                }`}
              >
                {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{recording ? "Stop Capture" : "Trigger Speech Mic"}</span>
              </button>
            </div>

            {/* Recognized voice commands notifications */}
            {recognizedCommand && (
              <div className="mx-4 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl flex items-center gap-1.5 animate-bounce">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-semibold text-[10px]">Command recognized: <strong className="underline">{recognizedCommand}</strong></span>
              </div>
            )}

            {/* 1. Language Picker Section */}
            <div className="p-4 border-b border-gray-100 dark:border-[#1e2530] space-y-2">
              <span className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">Language Preference</span>
              <select
                value={speechLanguage}
                onChange={(e) => setSpeechLanguage(e.target.value)}
                className="w-full text-xs p-2 bg-gray-50 dark:bg-[#151a24] text-gray-900 dark:text-white border border-[#1e2530]/15 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
              >
                {speechLanguages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Audio Characters Selector */}
            <div className="p-4 border-b border-gray-100 dark:border-[#1e2530] space-y-2">
              <span className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">AI Voice Character</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: "Zephyr", desc: "Warm Ambient" },
                  { name: "Kore", desc: "Regal Sovereign" },
                  { name: "Puck", desc: "Cyber Playful" },
                  { name: "Charon", desc: "Deep Analytic" },
                  { name: "Fenrir", desc: "Bold Majestic" },
                ].map((character) => (
                  <button
                    key={character.name}
                    type="button"
                    onClick={() => setActiveVoice(character.name)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      activeVoice === character.name
                        ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-650 dark:text-indigo-400 font-bold"
                        : "bg-gray-50/50 dark:bg-[#141b25] border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-[#1a2330]"
                    }`}
                  >
                    <p className="font-extrabold text-[10px]">{character.name}</p>
                    <p className="text-[8px] text-gray-400 truncate">{character.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Audio Narration Controls (Speed + Voice Actions) */}
            <div className="p-4 border-b border-gray-100 dark:border-[#1e2530] space-y-3">
              <span className="text-[10px] font-bold text-gray-455 uppercase tracking-wider">Narration Playback Speed</span>
              <div className="flex gap-1">
                {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackSpeed(rate)}
                    className={`flex-1 py-1 rounded text-center transition-all cursor-pointer text-[9px] font-bold ${
                      playbackSpeed === rate
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-50 dark:bg-[#141b25] text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-[#1a2330]"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {playingAudio && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (playingAudio.paused) {
                        playingAudio.play();
                      } else {
                        playingAudio.pause();
                      }
                      // force re-render
                      setPlayingAudio(playingAudio);
                    }}
                    className="flex-1 py-1 px-3 bg-zinc-100 dark:bg-zinc-800 text-gray-750 dark:text-gray-300 text-[10px] font-bold rounded-lg cursor-pointer hover:bg-zinc-200 text-center border border-zinc-200 dark:border-zinc-700"
                  >
                    {playingAudio.paused ? "▶ Resume" : "⏸ Pause"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playingAudio.pause();
                      setPlayingAudio(null);
                    }}
                    className="flex-1 py-1 px-3 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold rounded-lg cursor-pointer text-center"
                  >
                    Stop Voice
                  </button>
                </div>
              )}
            </div>

            {/* 4. Continuous listening switch toggle */}
            <div className="p-4 border-b border-gray-100 dark:border-[#1e2530] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-[10px] text-gray-950 dark:text-white uppercase tracking-wider">Continuous Loop</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Automated spoken flow conversation</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={continuousListening}
                    onChange={(e) => setContinuousListening(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-gray-200 peer-focus:outline-none dark:bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            {/* 5. Voice Command trigger setting */}
            <div className="p-4 border-b border-gray-150 dark:border-[#1e2530]" style={{ borderBottomWidth: 0 }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-[10px] text-gray-950 dark:text-white uppercase tracking-wider">Voice Control Mode</p>
                  <p className="text-[9px] text-gray-400 mt-0.5 font-medium">Spoken command automations</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={voiceCommandMode}
                    onChange={(e) => setVoiceCommandMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-gray-200 peer-focus:outline-none dark:bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {voiceCommandMode && (
                <div className="mt-2.5 p-2.5 bg-gray-50 dark:bg-[#141b25] text-[9px] text-gray-400 rounded-xl space-y-1.5">
                  <p className="font-extrabold text-[10px] text-indigo-500">Supported Commands:</p>
                  <div className="flex items-start gap-1">
                    <span className="shrink-0">🎙️</span>
                    <span><strong>"new conversation" / "new chat"</strong>: Start a fresh session</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="shrink-0">🎙️</span>
                    <span><strong>"stop voice" / "stop narration"</strong>: Erase playing speaker</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="shrink-0">🎙️</span>
                    <span><strong>"save note" / "capture note"</strong>: Export the latest response to personal notebook</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
