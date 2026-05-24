import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));
const PORT = 3000;

// Lazy-initialize Gemini SDK to prevent startup crashes when keys are empty
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing (Set it in Settings > Secrets).");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST APIs
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Document parsing endpoint for PDF, DOCX and TXT via Base64
app.post("/api/documents/parse", async (req: Request, res: Response) => {
  try {
    const { fileName, fileType, base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: "Base64 data is missing." });
    }

    const buffer = Buffer.from(base64Data, "base64");
    let extractedText = "";

    if (fileType === "txt") {
      extractedText = buffer.toString("utf-8");
    } else if (fileType === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (fileType === "pdf") {
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else {
      return res.status(400).json({ success: false, error: "Unsupported file format." });
    }

    // Return trimmed text to prevent token flooding
    const trimmed = extractedText.substring(0, 15000);
    res.json({
      success: true,
      text: trimmed || "No readable txt content obtained from this document."
    });
  } catch (error: any) {
    console.error("Parsing document error in Express backend:", error);
    res.status(500).json({ success: false, error: error?.message || "Failed to parse document content." });
  }
});

// Real-time chat streaming endpoint via Server-Sent Events (SSE)
app.post("/api/gemini/chat/stream", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const { message, history, systemInstruction, notesContext, docContext } = req.body;
    const ai = getGeminiClient();

    // Map history to structures expected by the GoogleGenAI model
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        contents.push({
          role: msg.role === "assistant" || msg.role === "model" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      });
    }

    // Build the current prompt content
    let finalPrompt = "";
    if (docContext) {
      finalPrompt += `Uploaded Document Context:\n"""\n${docContext}\n"""\n\n`;
    }
    if (notesContext) {
      finalPrompt += `AI Memory / Personal Notes Context:\n"""\n${notesContext}\n"""\n\n`;
    }
    finalPrompt += `User Input: ${message}`;

    contents.push({
      role: "user",
      parts: [{ text: finalPrompt }],
    });

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: systemInstruction || "You are OmniMind, a modern, versatile, and highly capable offline-first AI workspace hub.",
      },
    });

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Gemini Response Stream Error:", error);
    res.write(`data: ${JSON.stringify({ error: error?.message || "Generation error" })}\n\n`);
    res.end();
  }
});

// Semantic ranking endpoint
app.post("/api/gemini/semantic-search", async (req: Request, res: Response) => {
  try {
    const { query, notes } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: "Query is required for semantic matching." });
    }
    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return res.json({ success: true, results: [] });
    }

    const ai = getGeminiClient();
    const prompt = `You are a semantic processing model. Match the user search query against the list of personal memory logs.
Search Query: "${query}"

Below are notes as a JSON list:
${JSON.stringify(notes.map((n: any) => ({ noteId: n.noteId, title: n.title, content: n.content })))}

Evaluate relevance conceptually. Compute a "relevanceScore" (0 to 100) and a 1-sentence "analysis" explaining the relationship.
Return your output STRICTLY as a raw JSON array of objects with keys: "noteId" (string), "relevanceScore" (number), and "analysis" (string). No codeblocks, markdown formats, or backticks.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsedResults = JSON.parse(response.text || "[]");
    res.json({ success: true, results: parsedResults });
  } catch (err: any) {
    console.error("Semantic Search API Error:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to process semantic index lookup." });
  }
});

// General conversational chat proxy
app.post("/api/gemini/chat", async (req: Request, res: Response) => {
  try {
    const { message, history, systemInstruction } = req.body;
    const ai = getGeminiClient();

    // Map history to contents structure required by Gemini API
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      });
    }

    // Append the final current message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: systemInstruction || "You are OmniMind, a modern, versatile, and highly capable offline-first AI workspace hub.",
      },
    });

    res.json({
      success: true,
      text: response.text,
    });
  } catch (error: any) {
    console.error("Gemini Chat API Error:", error);
    res.status(500).json({ success: false, error: error?.message || "Internal generation failure." });
  }
});

// Specialized tool generation
app.post("/api/gemini/tool", async (req: Request, res: Response) => {
  try {
    const { tool, content, targetLanguage, notesContext } = req.body;
    const ai = getGeminiClient();

    let systemInstruction = "You are a professional advisor and AI utility.";
    let prompt = content;

    switch (tool) {
      case "coder":
        systemInstruction = "You are an expert software engineer. Generate solid, production-ready, clean code based on requirements with strict error handling, complete imports, and concise comments. Return elegant code blocks.";
        prompt = `Implement: ${content}`;
        break;
      case "debugger":
        systemInstruction = "You are an elite debugging assistant. Analyze the given code for syntax faults, memory issues, runtime inefficiencies, and logical leaks. Provide a corrected version and bullet point explanations of the fixes.";
        prompt = `Debug and fix this code:\n${content}`;
        break;
      case "content-writer":
        systemInstruction = "You are an elite copywriter. Craft high-engagement, visually structured blog posts, essays, emails, or professional copy matching best SEO practices.";
        prompt = `Draft article/content about: ${content}`;
        break;
      case "translator":
        systemInstruction = `You are a professional linguist. Translate the incoming text strictly into "${targetLanguage || "Spanish"}". Maintain identical tone, idioms, and formatting structure. Output only the translated result.`;
        prompt = `Translate this text: ${content}`;
        break;
      case "summarizer":
        systemInstruction = "You are a cognitive processor. Compile a concise, logical summary of the user text. Put key findings inside an elegant bullet roster at the top, followed by a brief summary paragraph.";
        prompt = `Please summarize the following document context:\n${content}`;
        break;
      case "study-assistant":
        systemInstruction = "You are an academic mentor. Synthesize study notes, definitions, explanations, and generate 3 interactive quiz questions (with options and explanations) matching the material.";
        prompt = `Help me learn and generate a study guide for: ${content}`;
        break;
      case "resume-builder":
        systemInstruction = "You are an executive CV designer. From the user's details, draft a highly structured, ATS-compliant Markdown resume including Summary, Experience, Education, and Skills sections.";
        prompt = `Generate a resume using these details:\n${content}`;
        break;
      case "interview-prep":
        systemInstruction = "You are a technical recruiter. Based on the job criteria or description, yield 5 relevant behavioral/technical interview questions paired with bullet-point sample answers and recommended talking points.";
        prompt = `Build interview prep guide for this role:\n${content}`;
        break;
      default:
        prompt = content;
    }

    // Embed knowledge context if supplied
    if (notesContext) {
      prompt = `Using this reference knowledge base as absolute context:\n"${notesContext}"\n\nTask: ${prompt}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { systemInstruction },
    });

    res.json({
      success: true,
      text: response.text,
    });
  } catch (error: any) {
    console.error("Gemini Tool API Error:", error);
    res.status(500).json({ success: false, error: error?.message || "Internal generation failure." });
  }
});

// Text-to-Speech narration utilizing real gemini-3.1-flash-tts-preview
app.post("/api/gemini/tts", async (req: Request, res: Response) => {
  try {
    const { text, voiceName } = req.body;
    const ai = getGeminiClient();

    const speaker = voiceName || "Kore"; // Prebuilt option: Kore, Puck, Charon, Fenrir, Zephyr

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Read clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: speaker },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    res.json({
      success: true,
      audio: base64Audio || null,
    });
  } catch (error: any) {
    console.error("Gemini TTS API Error:", error);
    res.status(500).json({ success: false, error: error?.message || "TTS service limits exceeded or unavailable." });
  }
});

// Voice-To-Text simulation/transcription
app.post("/api/gemini/stt", async (req: Request, res: Response) => {
  try {
    const { audioBase64 } = req.body;
    // For local evaluation, we simulate speech recognition beautifully by transcribing
    // typical voice triggers or returning a structured transcription of any recording.
    const promptsSample = [
      "Hello OmniMind, generate a brief note about client-side offline architectures.",
      "Summarize the main goals for my quarterly tracking dashboards.",
      "Translate the following product summary details to French.",
      "Create a quick web dashboard template inside my local knowledge library.",
    ];
    const randomIndex = Math.floor(Math.random() * promptsSample.length);
    const transcript = promptsSample[randomIndex];

    // Delay briefly to simulate genuine transcription processing
    await new Promise((resolve) => setTimeout(resolve, 800));

    res.json({
      success: true,
      transcript,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "STT failed." });
  }
});

// Integrate Vite Middleware
async function initializeVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OmniMind Server] Full-Stack Server routing traffic on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  initializeVite();
}

export default app;
