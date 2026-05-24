import { useState, useEffect, useRef } from "react";
import { ChatSession, ChatMessage, UserProfile } from "../types";
import { db, isFirebaseConfigured, localStore, handleFirestoreError, OperationType } from "./firebase";
import { geminiService } from "./geminiService";
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";

export interface UseChatParams {
  user: UserProfile;
  initialCategory?: string;
}

export function useChat({ user, initialCategory = "general" }: UseChatParams) {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  
  // Streaming state controls
  const [generating, setGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Audio & speech
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState("en-US");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [activeVoice, setActiveVoice] = useState<string>(user.ttsVoice || "Zephyr");
  const [continuousListening, setContinuousListening] = useState<boolean>(false);
  const [voiceCommandMode, setVoiceCommandMode] = useState<boolean>(true);
  const [recognizedCommand, setRecognizedCommand] = useState<string | null>(null);

  // Sync refs to avoid stale capture in async callbacks
  const continuousListeningRef = useRef(continuousListening);
  useEffect(() => {
    continuousListeningRef.current = continuousListening;
  }, [continuousListening]);

  const activeVoiceRef = useRef(activeVoice);
  useEffect(() => {
    activeVoiceRef.current = activeVoice;
  }, [activeVoice]);

  const playbackSpeedRef = useRef(playbackSpeed);
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const voiceCommandModeRef = useRef(voiceCommandMode);
  useEffect(() => {
    voiceCommandModeRef.current = voiceCommandMode;
  }, [voiceCommandMode]);

  const playingAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    playingAudioRef.current = playingAudio;
  }, [playingAudio]);

  // Edits & clones
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInputText, setEditInputText] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // 1. Sync list of Chat Sessions from Firestore (Real-Time Sub) or Fallback to Offline
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !user?.userId) {
      setChats(localStore.getChats());
      return;
    }

    try {
      const chatsCol = collection(db, "chats");
      const q = query(chatsCol, where("userId", "==", user.userId));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: ChatSession[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as ChatSession);
          });

          // Order by Pinned first, then by updatedAt descending
          list.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });

          setChats(list);
          localStorage.setItem("omnimind_chats", JSON.stringify(list));
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, "chats");
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Error subscribing to Firestore chats:", err);
      setChats(localStore.getChats());
    }
  }, [user?.userId]);

  // 2. Sync Chat Messages for Selected Active Chat in Real-Time or Fallback to Offline
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    // Set correct active category matching parent chat session
    const activeSession = chats.find((c) => c.chatId === activeChatId);
    if (activeSession) {
      setSelectedCategory(activeSession.category || "general");
    }

    if (!isFirebaseConfigured || !db) {
      setMessages(localStore.getMessages(activeChatId));
      return;
    }

    try {
      const msgsCol = collection(db, "chats", activeChatId, "messages");
      const q = query(msgsCol, orderBy("createdAt", "asc"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: ChatMessage[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as ChatMessage);
          });
          setMessages(list);

          // Update underlying local messages copy nicely
          const globalMsgs = localStore.getAllMessages().filter((m) => m.chatId !== activeChatId);
          localStorage.setItem("omnimind_messages", JSON.stringify([...globalMsgs, ...list]));
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, `chats/${activeChatId}/messages`);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Error subscribing to Firestore messages:", err);
      setMessages(localStore.getMessages(activeChatId));
    }
  }, [activeChatId, chats]);

  // Clean Audio on unmount
  useEffect(() => {
    return () => {
      if (playingAudio) {
        playingAudio.pause();
      }
    };
  }, [playingAudio]);

  /**
   * Toggles session chat pinning
   */
  const handleTogglePinChat = async (chat: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated: ChatSession = {
      ...chat,
      isPinned: !chat.isPinned,
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, "chats", updated.chatId), updated);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `chats/${updated.chatId}`);
      }
    } else {
      localStore.saveChat(updated);
    }
  };

  /**
   * Category descriptions directive block resolver
   */
  const systemDirectives: Record<string, string> = {
    general: "You are OmniMind, a modern, versatile, and highly capable offline-first AI workspace hub.",
    coder: "You are an expert software engineer. Generate solid, production-ready, clean code based on requirements with strict error handling, complete imports, and concise comments. Return elegant code blocks.",
    debugger: "You are an elite debugging assistant. Analyze the given code for syntax faults, memory issues, runtime inefficiencies, and logical leaks. Provide a corrected version and bullet point explanations of the fixes.",
    "content-writer": "You are an elite copywriter. Craft high-engagement, visually structured blog posts, essays, emails, or professional copy matching best SEO practices.",
    translator: "You are a professional linguist. Translate the incoming text strictly into target language. Maintain identical tone, idioms, and formatting structure. Output only the translated result.",
    summarizer: "You are a cognitive processor. Compile a concise, logical summary of the user text. Put key findings inside an elegant bullet roster at the top, followed by a brief summary paragraph.",
    "study-assistant": "You are an academic mentor. Synthesize study notes, definitions, explanations, and generate 3 interactive quiz questions (with options and explanations) matching the material.",
    "resume-builder": "You are an executive CV designer. From the user's details, draft a highly structured, ATS-compliant Markdown resume including Summary, Experience, Education, and Skills sections.",
    "interview-prep": "You are a technical recruiter. Based on the job criteria or description, yield 5 relevant behavioral/technical interview questions paired with bullet-point sample answers and recommended talking points.",
  };

  /**
   * Helper to execute streaming replies securely
   */
  const handleStreamAIResponse = async (
    userMessageText: string,
    historyContext: ChatMessage[],
    knowledgeContext: string = ""
  ) => {
    setGenerating(true);

    const assistantMsgId = "msg-stream-" + Math.random().toString(36).substring(3, 9);
    const newAssistantMsg: ChatMessage = {
      messageId: assistantMsgId,
      chatId: activeChatId,
      userId: user.userId,
      role: "model",
      content: "...",
      type: selectedCategory,
      createdAt: new Date().toISOString(),
    };

    // Optimistically update frontend messages array, guarding against duplicates
    setMessages((prev) => {
      if (prev.some((msg) => msg.messageId === assistantMsgId)) return prev;
      return [...prev, newAssistantMsg];
    });

    const activeDoc = JSON.parse(localStorage.getItem("omnimind_active_doc") || "null");
    const activeDocContent = activeDoc ? activeDoc.content : "";

    abortControllerRef.current = new AbortController();

    let accumulatedText = "";

    await geminiService.streamChat({
      message: userMessageText,
      history: historyContext,
      systemInstruction: systemDirectives[selectedCategory] || systemDirectives.general,
      notesContext: knowledgeContext,
      docContext: activeDocContent,
      signal: abortControllerRef.current.signal,
      onChunk: (text) => {
        accumulatedText += text;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === assistantMsgId ? { ...msg, content: accumulatedText } : msg
          )
        );
      },
      onDone: async () => {
        setGenerating(false);
        abortControllerRef.current = null;

        const finalizedMessage: ChatMessage = {
          ...newAssistantMsg,
          content: accumulatedText || "No content generated.",
          createdAt: new Date().toISOString(),
        };

        if (isFirebaseConfigured && db) {
          try {
            await setDoc(doc(db, "chats", activeChatId, "messages", assistantMsgId), finalizedMessage);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `chats/${activeChatId}/messages/${assistantMsgId}`);
          }
        } else {
          localStore.saveMessage(finalizedMessage);
        }

        // Trigger continuous speech narration if enabled
        if (continuousListeningRef.current) {
          setTimeout(() => {
            handleTalkMessage(finalizedMessage);
          }, 350);
        }
      },
      onError: (err) => {
        console.error("Gemini stream error callback:", err);
        setGenerating(false);
        abortControllerRef.current = null;

        const errorMsgText = "Oops! Generation failed. Please verify your Gemini API key inside system settings.";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === assistantMsgId ? { ...msg, content: errorMsgText } : msg
          )
        );
      },
    });
  };

  /**
   * Action trigger to spawn a pristine conversation session thread
   */
  const handleCreateNewChat = async () => {
    const newChatId = "chat-" + Math.random().toString(36).substring(3, 9);
    const newChat: ChatSession = {
      chatId: newChatId,
      userId: user.userId,
      title: "New conversation",
      category: selectedCategory as any,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, "chats", newChatId), newChat);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `chats/${newChatId}`);
      }
    } else {
      localStore.saveChat(newChat);
    }

    setActiveChatId(newChatId);
    return newChatId;
  };

  /**
   * Hard Delete conversation thread completely
   */
  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, "chats", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `chats/${id}`);
      }
    } else {
      localStore.deleteChat(id);
    }

    if (activeChatId === id) {
      setActiveChatId("");
    }
  };

  /**
   * Stops the ongoing generation stream securely
   */
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setGenerating(false);
  };

  /**
   * Standardized message sending flow
   */
  const handleSendMessage = async (e: React.FormEvent, knowledgeContext: string = "") => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatId || generating) return;

    const rawPromptText = inputText;
    setInputText("");

    const finalPrompt = selectedCategory === "translator"
      ? `Translate the following text exactly into ${targetLanguage}:\n\n${rawPromptText}`
      : rawPromptText;

    const userMsg: ChatMessage = {
      messageId: "msg-" + Math.random().toString(36).substring(3, 9),
      chatId: activeChatId,
      userId: user.userId,
      role: "user",
      content: finalPrompt,
      type: "text",
      createdAt: new Date().toISOString(),
    };

    const currentHistory = [...messages];

    // Save user message to DB/Memory
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, "chats", activeChatId, "messages", userMsg.messageId), userMsg);
        
        // Auto-update parent session title & timestamp
        const activeItem = chats.find((c) => c.chatId === activeChatId);
        if (activeItem) {
          const updatedChat: ChatSession = {
            ...activeItem,
            updatedAt: new Date().toISOString(),
          };
          if (activeItem.title === "New conversation") {
            updatedChat.title = rawPromptText.slice(0, 36) + (rawPromptText.length > 36 ? "..." : "");
          }
          await setDoc(doc(db, "chats", activeChatId), updatedChat);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `chats/${activeChatId}/messages/${userMsg.messageId}`);
      }
    } else {
      localStore.saveMessage(userMsg);
    }

    setMessages((prev) => {
      if (prev.some((m) => m.messageId === userMsg.messageId)) return prev;
      return [...prev, userMsg];
    });

    // Query Gemini
    await handleStreamAIResponse(finalPrompt, currentHistory, knowledgeContext);
  };

  /**
   * Regenerates the last AI Response
   */
  const handleRegenerateResponse = async (knowledgeContext: string = "") => {
    if (messages.length === 0 || generating) return;

    const userMsgs = messages.filter((m) => m.role === "user");
    if (userMsgs.length === 0) return;

    const lastUserMsg = userMsgs[userMsgs.length - 1];

    // Identify index of latest human question
    const targetIdx = messages.findIndex((m) => m.messageId === lastUserMsg.messageId);
    const croppedMessages = messages.slice(0, targetIdx + 1);

    // Save back clean crop
    if (isFirebaseConfigured && db) {
      try {
        // Soft delete/overwrite old replies by querying subcollection
        // For simple robust client rendering, we filter state and will write newly compiled response.
      } catch (err) {
        console.error("Soft cropping errors:", err);
      }
    } else {
      const allGlobal = localStore.getAllMessages().filter(
        (m) => m.chatId !== activeChatId || croppedMessages.some((cm) => cm.messageId === m.messageId)
      );
      localStorage.setItem("omnimind_messages", JSON.stringify(allGlobal));
    }

    setMessages(croppedMessages);

    // Trigger Stream Overwrite
    await handleStreamAIResponse(lastUserMsg.content, croppedMessages.slice(0, -1), knowledgeContext);
  };

  /**
   * Copy message contents to user clipboard clipboard
   */
  const handleCopyMessageText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 1500);
  };

  /**
   * Initiates edit message mode
   */
  const handleInitiateEditMessage = (msg: ChatMessage) => {
    setEditingMessageId(msg.messageId);
    setEditInputText(msg.content);
  };

  /**
   * Overwrite edited message content, prune subsequent messages, and stream new reply
   */
  const handleSaveEditedMessage = async (msgId: string, knowledgeContext: string = "") => {
    if (!editInputText.trim() || generating) return;

    const targetIdx = messages.findIndex((m) => m.messageId === msgId);
    if (targetIdx === -1) return;

    const updatedUserMsg: ChatMessage = {
      ...messages[targetIdx],
      content: editInputText,
      createdAt: new Date().toISOString(),
    };

    const croppedMessages = [...messages.slice(0, targetIdx), updatedUserMsg];

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, "chats", activeChatId, "messages", msgId), updatedUserMsg);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `chats/${activeChatId}/messages/${msgId}`);
      }
    } else {
      const remainingLogs = localStore.getAllMessages().filter(
        (m) => m.chatId !== activeChatId || croppedMessages.some((cm) => cm.messageId === m.messageId)
      );
      localStorage.setItem("omnimind_messages", JSON.stringify(remainingLogs));

      const all = localStore.getAllMessages();
      const updatedAll = all.map((m) => (m.messageId === msgId ? updatedUserMsg : m));
      localStorage.setItem("omnimind_messages", JSON.stringify(updatedAll));
    }

    setMessages(croppedMessages);
    setEditingMessageId(null);

    // Call SSE streaming rewrite
    await handleStreamAIResponse(updatedUserMsg.content, croppedMessages.slice(0, -1), knowledgeContext);
  };

  /**
   * Narrates model audio reply via prebuilt speaker voices
   */
  const processTranscriptAndCommands = async (transcript: string) => {
    if (!transcript.trim()) return;

    const query = transcript.trim().toLowerCase();

    if (voiceCommandModeRef.current) {
      if (query.includes("new conversation") || query.includes("create chat") || query.includes("new chat")) {
        setRecognizedCommand("New Conversation");
        setTimeout(() => setRecognizedCommand(null), 3050);
        await handleCreateNewChat();
        return;
      }
      if (query.includes("stop narration") || query.includes("stop voice") || query.includes("pause voice")) {
        setRecognizedCommand("Stop Narration");
        setTimeout(() => setRecognizedCommand(null), 3050);
        if (playingAudioRef.current) {
          playingAudioRef.current.pause();
          setPlayingAudio(null);
        }
        return;
      }
      if (query.includes("save note") || query.includes("capture note")) {
        setRecognizedCommand("Save Note");
        setTimeout(() => setRecognizedCommand(null), 3050);
        if (messages.length > 0) {
          const lastModelMsg = [...messages].reverse().find(m => m.role === "model");
          if (lastModelMsg) {
            const newNote = {
              noteId: "note-" + Math.random().toString(36).substring(3, 9),
              userId: user.userId,
              title: `Handfree Voice Note (${new Date().toLocaleDateString()})`,
              content: lastModelMsg.content,
              folder: "Voice Captures",
              isSynced: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            localStore.saveNote(newNote);
          }
        }
        return;
      }
    }

    if (continuousListeningRef.current) {
      setInputText(transcript);
      setTimeout(() => {
        sendDirectContinuousMessage(transcript);
      }, 100);
    } else {
      setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    }
  };

  const sendDirectContinuousMessage = async (rawPromptText: string, knowledgeContext: string = "") => {
    if (!rawPromptText.trim() || !activeChatId || generating) return;

    const finalPrompt = selectedCategory === "translator"
      ? `Translate the following text exactly into ${targetLanguage}:\n\n${rawPromptText}`
      : rawPromptText;

    const userMsg: ChatMessage = {
      messageId: "msg-" + Math.random().toString(36).substring(3, 9),
      chatId: activeChatId,
      userId: user.userId,
      role: "user",
      content: finalPrompt,
      type: "text",
      createdAt: new Date().toISOString(),
    };

    const currentHistory = [...messages];

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, "chats", activeChatId, "messages", userMsg.messageId), userMsg);
        const activeItem = chats.find((c) => c.chatId === activeChatId);
        if (activeItem) {
          const updatedChat: ChatSession = {
            ...activeItem,
            updatedAt: new Date().toISOString(),
          };
          if (activeItem.title === "New conversation") {
            updatedChat.title = rawPromptText.slice(0, 36) + (rawPromptText.length > 36 ? "..." : "");
          }
          await setDoc(doc(db, "chats", activeChatId), updatedChat);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `chats/${activeChatId}/messages/${userMsg.messageId}`);
      }
    } else {
      localStore.saveMessage(userMsg);
    }

    setMessages((prev) => {
      if (prev.some((m) => m.messageId === userMsg.messageId)) return prev;
      return [...prev, userMsg];
    });
    await handleStreamAIResponse(finalPrompt, currentHistory, knowledgeContext);
  };

  function handleTalkMessage(msg: ChatMessage) {
    if (playingAudioRef.current) {
      playingAudioRef.current.pause();
      setPlayingAudio(null);
      return;
    }

    if (ttsLoadingId === msg.messageId) {
      setTtsLoadingId(null);
      return;
    }

    setTtsLoadingId(msg.messageId);

    geminiService.textToSpeech(msg.content.substring(0, 320), activeVoiceRef.current)
      .then((base64Audio) => {
        const audioSrc = `data:audio/wav;base64,${base64Audio}`;
        const audio = new Audio(audioSrc);
        audio.playbackRate = playbackSpeedRef.current;
        audio.play();
        setPlayingAudio(audio);
        
        audio.onended = () => {
          setPlayingAudio(null);
          if (continuousListeningRef.current) {
            setTimeout(() => {
              handleMicrophoneCaptureLocal();
            }, 650);
          }
        };
      })
      .catch((err) => {
        console.error("Text-To-Speech narration failure:", err);
      })
      .finally(() => {
        setTtsLoadingId(null);
      });
  }

  function handleMicrophoneCaptureLocal() {
    if (playingAudioRef.current) {
      playingAudioRef.current.pause();
      setPlayingAudio(null);
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = speechLanguage;

      recognition.onstart = () => {
        setRecording(true);
      };

      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          processTranscriptAndCommands(transcript);
        }
      };

      recognition.onerror = (e: any) => {
        console.error("Transcribing voice input error:", e);
      };

      recognition.onend = () => {
        setRecording(false);
      };

      recognition.start();
    } else {
      setRecording(true);
      setTimeout(async () => {
        try {
          const transcript = await geminiService.speechToText();
          if (transcript) {
            processTranscriptAndCommands(transcript);
          }
        } catch (e) {
          console.error("Speech transduction fallback fails:", e);
        } finally {
          setRecording(false);
        }
      }, 1800);
    }
  }

  // Deduplicate messages by messageId to prevent duplicate key errors in React
  const uniqueMessages = Array.from(
    new Map(messages.map((m) => [m.messageId, m])).values()
  );

  return {
    chats,
    activeChatId,
    setActiveChatId,
    messages: uniqueMessages,
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
    sendDirectContinuousMessage,
  };
}
