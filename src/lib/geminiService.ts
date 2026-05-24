import { ChatMessage, NoteRecord } from "../types";

export interface SemanticSearchResult {
  noteId: string;
  relevanceScore: number;
  analysis: string;
}

export const geminiService = {
  /**
   * Streams chat completion from the Express proxy endpoint via SSE
   */
  async streamChat(params: {
    message: string;
    history: ChatMessage[];
    systemInstruction?: string;
    notesContext?: string;
    docContext?: string;
    onChunk: (text: string) => void;
    onDone: () => void;
    onError: (err: any) => void;
    signal?: AbortSignal;
  }) {
    const { message, history, systemInstruction, notesContext, docContext, onChunk, onDone, onError, signal } = params;

    try {
      const response = await fetch("/api/gemini/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          message,
          history: history.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          systemInstruction,
          notesContext,
          docContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to read streaming channel response body.");
      }

      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;

        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          // Keep the incomplete last line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            if (cleanLine.startsWith("data: ")) {
              const dataValue = cleanLine.slice(6).trim();
              if (dataValue === "[DONE]") {
                onDone();
                return;
              }

              try {
                const parsed = JSON.parse(dataValue);
                if (parsed.text) {
                  onChunk(parsed.text);
                } else if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                // Ignore incomplete line parse attempts, they fall back or are resolved on subsequent cycles
              }
            }
          }
        }
      }

      // If finished cleanly
      onDone();
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Chat streaming aborted by the user.");
      } else {
        onError(err);
      }
    }
  },

  /**
   * Requests Text-to-Speech generation from proxy server
   */
  async textToSpeech(text: string, voiceName: string): Promise<string> {
    const response = await fetch("/api/gemini/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceName }),
    });

    if (!response.ok) {
      throw new Error(`TTS server returned status ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.audio) {
      throw new Error(data.error || "Failed to generate TTS audio.");
    }

    return data.audio; // Base64 audio string
  },

  /**
   * Requests Speech-to-Text transcription from proxy server
   */
  async speechToText(audioBase64?: string): Promise<string> {
    const response = await fetch("/api/gemini/stt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64 }),
    });

    if (!response.ok) {
      throw new Error(`STT server returned status ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.transcript) {
      throw new Error(data.error || "STT response error.");
    }

    return data.transcript;
  },

  /**
   * Submits queries to find related concepts across note logs semantically
   */
  async semanticSearch(query: string, notes: NoteRecord[]): Promise<SemanticSearchResult[]> {
    const response = await fetch("/api/gemini/semantic-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, notes }),
    });

    if (!response.ok) {
      throw new Error(`Semantic search server returned status ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Semantic score lookup failure.");
    }

    return data.results || [];
  },
};
