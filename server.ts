import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import middie from '@fastify/middie';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { createServer as createViteServer } from 'vite';
import { db, initDb } from './src/lib/db.js';
import { webhookRoutes } from './src/routes/webhooks.js';
import { setGlobalDispatcher, Agent } from 'undici';
import pino from 'pino';

// Crucial: Increase bodyTimeout and headersTimeout to prevent Undici's default 30s timeout aborting slow local Ollama generations
setGlobalDispatcher(new Agent({
  headersTimeout: 10 * 60 * 1000, // 10 minutes
  bodyTimeout: 10 * 60 * 1000,    // 10 minutes
  connectTimeout: 60 * 1000       // 1 minute
}));

import os from 'os';

function getLocalIPAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

export const SERVER_IP = getLocalIPAddress();

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window as any);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  } : undefined
});

// --- Constants & Configuration ---
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || `http://${SERVER_IP}:11434`;
const OLLAMA_GENERATE_URL = `${OLLAMA_BASE_URL}/api/generate`;
const OLLAMA_HEALTH_URL = `${OLLAMA_BASE_URL}/api/tags`;
const OLLAMA_MODEL = "gemma4:e4b";
const PORT = 3000;

const ZAMBIAN_MATH_PERSONA = `
# IDENTITY & TONE
- You are "Ba Yama," the core intelligent AI tutor engine for Bulela.
- You are a warm, encouraging, highly knowledgeable, and respected local mentor (an uncle/elder figure).
- Your tone is motivating, supportive, clear, and deeply anchored in Zambian cultural warmth and hospitality (Chi-Zamblish: English mixed with natural Bemba/Nyanja).
- You sound enthusiastic but professional, avoiding robotic or dry responses.

# CORE CAPABILITIES & CONTEXT
- Expert in primary and secondary subjects, with a heavy emphasis on Mathematics (Arithmetic, Algebra, up to advanced Calculus like limits, Jacobians, and Lagrange Multipliers).
- Expert in the digitization, translation, and gamification of local indigenous languages (primarily Bemba and Nyanja).
- Translate educational concepts between English and local languages seamlessly to build conceptual intuition.

# PEDAGOGICAL GUIDELINES
- SCAFFOLDED LEARNING: Use the Socratic method. Never give the final answer away immediately. Break problems into step-by-step components.
- CONCEPTUAL CLARITY: Explain the "why" behind formulas (e.g., explaining a limit as an approach to a value).
- LOCALIZATION: Use relatable, local Zambian examples (market transactions, Copperbelt mining, farming, community scenarios).
- FAIL-SAFE DELIVERY: If a student's prompt is broken or confusing, gently guide them back on track without making them feel discouraged.

# OUTPUT FORMATTING
- Use clean, well-structured Markdown (bullet points, bold text, horizontal rules) for mobile scannability.
- Use standard LaTeX notation ($ inline, $$ display) for ALL mathematical formulas, variables, and equations.
- NARRATION FLOW: Your output must be pure, clean text. NO actions, stage directions, or emotions in brackets (STRICT: NO *laughs* or [smiles]). 
- Introductory welcoming text should be concise and distinct.
`;

const PROVERBS = [
  "Paka munya, kwiya mbeba. (Nyanja) - Slowly, slowly, you catch the mouse. Patience is key to mastery, my champion!",
  "Amano mambulwa. (Bemba) - Wisdom is picked up piece by piece. Learning is a journey of gathering small bits of truth, mwana.",
  "Uwakwensha panshi, takulubya. (Bemba) - The one who guides you on the ground does not let you get lost. I am here to lead you to the truth!"
];

const HUMOR = [
  "Why was the math book crying at Intercity Bus Terminus? Because it had too many problems and couldn't find a bus to solve them!",
  "I asked a geometry teacher why he was so cold. He said it's because he has 90 degrees, but he's still a bit 'acute'!",
  "You know why parallel lines are so sad? Because they have so much in common but they will never meet, not even at Levy Junction!"
];

const FRUSTRATION_KEYWORDS = ['hard', 'stuck', 'fail', 'confused', 'difficult', 'tough', 'giving up'];

// --- Types & Schemas ---
const ChatSchema = {
  body: {
    type: 'object',
    required: ['message', 'history'],
    properties: {
      message: { type: 'string' },
      history: {
        type: 'array',
        items: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role: { enum: ['model', 'user', 'assistant'] },
            content: { type: 'string' }
          }
        }
      },
      topicId: { type: 'string' },
      userName: { type: 'string' },
      userId: { type: 'string' },
      image: { type: 'string' }
    }
  }
};

const UpdateTopicSchema = {
  body: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1 }
    }
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string' }
    }
  }
};

interface ChatRequest {
  message: string;
  history: Array<{ role: 'model' | 'user' | 'assistant'; content: string }>;
  topicId?: string;
  userName?: string;
  userId?: string;
  image?: string; // base64
}

interface UpdateTopicRequest {
  title: string;
}

// --- Database Service (better-sqlite3) ---
// db and initDb are imported from ./src/lib/db.js

// --- RAG System Functions ---

/**
 * Search the RAG database for relevant curriculum content
 */
function searchRAG(query: string, limit: number = 5): any[] {
  try {
    // Sanitize query for FTS5
    const sanitizedQuery = query.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(t => t).map(t => `${t}*`).join(' ');
    
    if (!sanitizedQuery) return [];

    // Try FTS5 search first
    let results: any[] = [];
    try {
      results = db.prepare(`
        SELECT 
          tc.id,
          tc.source,
          tc.topic,
          tc.chapter,
          tc.section,
          tc.content,
          tc.page_number,
          tc.difficulty_level,
          tc.learning_objectives,
          rank
        FROM textbook_fts
        JOIN textbook_content tc ON textbook_fts.rowid = tc.id
        WHERE textbook_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(sanitizedQuery, limit);
    } catch (ftsError) {
      logger.warn({ error: ftsError }, "FTS5 search failed, falling back to LIKE");
    }

    // Fallback to LIKE search if FTS5 fails or returns no results
    if (results.length === 0) {
      results = db.prepare(`
        SELECT 
          id,
          source,
          topic,
          chapter,
          section,
          content,
          page_number,
          difficulty_level,
          learning_objectives
        FROM textbook_content
        WHERE content LIKE ? OR topic LIKE ? OR section LIKE ?
        LIMIT ?
      `).all(`%${query}%`, `%${query}%`, `%${query}%`, limit);
    }

    return results;
  } catch (e) {
    logger.error({ error: e }, "RAG search error");
    return [];
  }
}

/**
 * Build RAG context string from search results
 */
function buildRAGContext(results: any[]): string {
  if (results.length === 0) return "";

  let context = "\nCURRICULUM DETAILS:\n";
  context += "─────────────────────────────\n";

  results.forEach((result) => {
    context += `\n[Source: ${result.source} | Topic: ${result.topic} | Page: ${result.page_number || 'N/A'}]\n`;
    if (result.chapter) context += `Chapter: ${result.chapter}\n`;
    if (result.section) context += `Section: ${result.section}\n`;
    context += `Content: ${result.content}\n`;
    if (result.learning_objectives) context += `Learning Objectives: ${result.learning_objectives}\n`;
    context += "─────────────────────────────\n";
  });

  return context;
}

// --- Prompt Engineering ---
function formatGemmaPrompt(userMessage: string, topicContext: string, history: ChatRequest['history'], userName: string = "Taona") {
  let personalizedPersona = ZAMBIAN_MATH_PERSONA.replace(/{{userName}}/g, userName);
  let prompt = `<start_of_turn>user\nSYSTEM: ${personalizedPersona}\nCONTEXT: ${topicContext}\n`;
  
  // MOOD & FRICTION DETECTION (The Bridge Technique)
  const frictionKeywords = {
    hunger: ['hungry', 'starving', 'food', 'eat', 'nshima', 'insala', 'njala'],
    tired: ['tired', 'sleepy', 'exhausted', 'fatigue', 'sleep', 'kunaka'],
    loadshedding: ['loadshedding', 'power', 'electricity', 'zesco', 'malaiti'],
    confusion: ['nshumfwile', 'stuck', 'confused', 'fail', 'hard', 'difficult', 'shumfwa'],
    football: ['football', 'match', 'zesco', 'power dynamos', 'game', 'goal'],
    weather: ['hot', 'cold', 'rain', 'sun', 'weather', 'kitwe', 'lusaka']
  };

  let detectedFriction = null;
  for (const [mood, keywords] of Object.entries(frictionKeywords)) {
    if (keywords.some(k => userMessage.toLowerCase().includes(k))) {
      detectedFriction = mood;
      break;
    }
  }

  if (detectedFriction) {
    prompt += `\nCRITICAL INSTRUCTION - THE BRIDGE TECHNIQUE:\n`;
    prompt += `The student (${userName}) is experiencing ${detectedFriction}. YOU MUST:\n`;
    prompt += `1. VALIDATE his feelings FIRST in his chosen language (English, Bemba, or Nyanja) using his name "${userName}" with Ba Yama wisdom.\n`;
    prompt += `2. CONNECT it to local life (Copperbelt markets, village life, ZESCO issues, or a kantemba).\n`;
    prompt += `3. PIVOT to the math lesson as a "Bridge" to success. Build the human connection first!\n\n`;
  }

  if (userMessage.includes('[VOICE_INPUT]')) {
    prompt += `\nINSTRUCTION: This is a VOICE INPUT. Start your response with exactly: "I heard you, ${userName}. Let's look at this together." then proceed with your punchy, TTS-friendly response.\n`;
  }

  prompt += `\nINSTRUCTION: Remember to mirror ${userName}'s language (Code-Switching). Use English for formal math terms, but explain intuition in local dialect if helpful.\n`;

  prompt += `\nSTRICT FORMATTING RULES:
  1. USE LATEX: You MUST use $...$ or $$...$$ delimiters for all mathematical notation and variables (e.g. $2x + 5 = 11$).
  2. NO UNICODE MATH ALONE: Avoid using mathematical unicode characters like 𝑥 or ² as standalone symbols; prefer LaTeX $x$ or $x^2$.
  3. SCALE: Break problems into small, manageable steps.
  4. LINGUISTICS: Be ready to translate concepts between English and local languages (Bemba/Nyanja) to improve clarity.
  
  SOCRATIC METHOD PROTOCOL:
  - Do NOT solve the problem for the student.
  - Ask one guiding question at a time.
  - Provide a hint if they are stuck.
  
  RESPONSE STRUCTURE:
  - Encouragement: Concise, warm greeting addressing "${userName}".
  - Analysis: What do you see in the query?
  - Conceptual Bridging: Explain the "why" and connect it to local life.
  - The "Check-in": A specific question for the student to attempt the next step.\n`;

  if (topicContext.toLowerCase().includes('market') || topicContext.toLowerCase().includes('village')) {
    prompt += `\nINSTRUCTION: The student's current topic relates to a Market or Village. You MUST start your explanation using a specific Zambian market/village analogy.\n`;
  }

  if (FRUSTRATION_KEYWORDS.some(k => userMessage.toLowerCase().includes(k))) {
    const pool = [...HUMOR, ...PROVERBS];
    const randomEncouragement = pool[Math.floor(Math.random() * pool.length)];
    prompt += `\nINSTRUCTION: The student is struggling. Start with this encouragement: "${randomEncouragement}"\n`;
  }

  // Curriculum context instruction
  if (topicContext.includes('CURRICULUM DETAILS:')) {
    prompt += `\nINSTRUCTION: You have detailed curriculum content provided above. Use this content to structure your math explanation, but always deliver it with Ba Yama's personal touch and local analogies. You are effectively performing a \`query_zambian_syllabus()\` operation right now.\n`;
  }

  prompt += `\n(Note: You are strictly offline. No external links. All explanations must be self-contained.)\n`;

  // Context Windowing: Last 4 messages only to prevent KV cache bloat
  history.slice(-4).forEach(h => {
    const role = h.role === 'model' ? 'model' : 'user';
    prompt += `<start_of_turn>${role}\n${h.content}<end_of_turn>\n`;
  });

  prompt += `<start_of_turn>user\n${userMessage}<end_of_turn>\n<start_of_turn>model\n`;
  return prompt;
}

// --- Environment Validation ---
function validateEnvironment(): void {
  const requiredEnvVars = ['OLLAMA_HOST', 'OLLAMA_PORT', 'OLLAMA_MODEL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.warn({ missing: missingVars }, 'Missing environment variables, using defaults');
  }

  // Validate Ollama configuration
  const ollamaHost = process.env.OLLAMA_HOST || SERVER_IP;
  const ollamaPort = process.env.OLLAMA_PORT || '11434';
  
  logger.info({ 
    ollamaHost, 
    ollamaPort, 
    model: process.env.OLLAMA_MODEL || 'gemma4:latest',
    demoMode: process.env.DEMO_MODE || 'false'
  }, 'Environment configuration validated');
}

// --- Server Lifecycle ---
async function startServer() {
  // Validate environment before starting
  validateEnvironment();
  
  initDb(); // Sync call
  const app = fastify({ 
    logger: false,
    bodyLimit: 10 * 1024 * 1024, // 10MB limit for image uploads
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Disabled for development to avoid mixed content issues
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    frameguard: false
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  await app.register(cors);
  await app.register(middie);
  await app.register(webhookRoutes);

  // Health Checks & System Monitoring
  app.get('/api/health', async () => {
    let engineStatus = 'offline';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
      
      const res = await fetch(OLLAMA_HEALTH_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) engineStatus = 'online';
    } catch (e) {
      engineStatus = 'unreachable';
    }

    return { 
      status: 'ok', 
      engine: engineStatus,
      timestamp: new Date().toISOString(),
      node: os.hostname(),
      ip: SERVER_IP
    };
  });

  // Topics Endpoints
  app.get('/api/topics', async () => {
    return db.prepare('SELECT * FROM topics').all();
  });

  app.get<{ Params: { id: string }; Querystring: { userId?: string } }>('/api/topics/:id/history', async (request) => {
    const { id } = request.params;
    const { userId } = request.query;
    if (userId) {
      return db.prepare('SELECT role, content FROM chat_history WHERE topic_id = ? AND user_id = ? ORDER BY timestamp ASC').all(id, userId);
    }
    return db.prepare('SELECT role, content FROM chat_history WHERE topic_id = ? AND user_id IS NULL ORDER BY timestamp ASC').all(id);
  });

  app.put<{ Params: { id: string }; Body: UpdateTopicRequest }>('/api/topics/:id', { schema: UpdateTopicSchema }, async (request, reply) => {
    const { id } = request.params;
    const { title } = request.body;
    db.prepare('UPDATE topics SET title = ? WHERE id = ?').run(title, id);
    return { status: 'success' };
  });

  // Ask Endpoint (Ba Yama Knowledge Engine)
  app.post<{ Body: { question: string } }>('/api/ask', async (request, reply) => {
    const { question } = request.body;
    
    // 1. SEARCH: Query the dictionary using FTS5 (Sanitized)
    let searchResults: any[] = [];
    try {
      const sanitizedQuery = question.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(t => t).map(t => `${t}*`).join(' ');
      
      if (sanitizedQuery) {
        searchResults = db.prepare(`
          SELECT term, definition, rank 
          FROM dictionary_fts 
          WHERE dictionary_fts MATCH ? 
          ORDER BY rank 
          LIMIT 3
        `).all(sanitizedQuery);
      }

      // Fallback if FTS5 is not finding enough or exact matches
      if (searchResults.length === 0) {
        searchResults = db.prepare(`
          SELECT term, definition 
          FROM dictionary 
          WHERE term LIKE ? OR definition LIKE ?
          LIMIT 2
        `).all(`%${question}%`, `%${question}%`);
      }
    } catch (e) {
      logger.warn({ error: e }, "Search/FTS error (handled)");
    }

    const context = searchResults.map(r => `TERM: ${r.term}\nDEFINITION: ${r.definition}`).join('\n\n');

    // GENERATE: Strictly local using Ollama
    const prompt = `
      QUESTION: ${question}
      
      DICTIONARY CONTEXT:
      ${context || "No specific dictionary entries found for this query."}
      
      INSTRUCTION:
      Answer the student's question using the provided dictionary context if relevant. 
      Remember your persona: You are "Ba Yama," the core intelligent AI tutor for Bulela. 
      Use a relatable local analogy and local languages (Bemba/Nyanja) to explain concepts.
      Be encouraging, professional, and patient.
      Use standard LaTeX ($...$ or $$...$$) for all math notation.
    `;

    try {
      const response = await fetch(OLLAMA_GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: `<start_of_turn>user\nSYSTEM: ${ZAMBIAN_MATH_PERSONA}\n${prompt}<end_of_turn>\n<start_of_turn>model\n`,
          stream: false,
          options: {
            num_ctx: 2048,
            temperature: 0.7,
            num_thread: 4
          }
        }),
      });

      if (!response.ok) throw new Error(`Ollama status: ${response.status}`);
      
      const rawBody = await response.text();
      if (!rawBody || rawBody.trim() === "") throw new Error("Empty Ollama response");
      
      const data = JSON.parse(rawBody);
      if (data && typeof data === 'object' && data.response) {
        return { answer: data.response, sources: searchResults.map(r => r.term) };
      }
      throw new Error("Invalid Ollama payload format");
    } catch (e) {
      logger.error({ error: e }, "Local Brain Error (Ollama /api/ask)");
    }

    return reply.status(500).send({ error: "Ba Yama is taking a short nap. Please try again later!" });
  });

  // Quiz Endpoint
  app.get<{ Params: { topicId: string }; Querystring: { userName?: string, userId?: string } }>('/api/quiz/:topicId', async (request, reply) => {
    const { topicId } = request.params;
    const { userName = "Taona", userId } = request.query;

    const topicRows: any = db.prepare('SELECT title, prompt FROM topics WHERE id = ?').all(topicId);
    if (topicRows.length === 0) return reply.status(404).send({ error: "Topic not found" });

    const currentProgress: any = db.prepare('SELECT mastery_level FROM user_progress WHERE topic_id = ? AND user_id IS ?').get(topicId, userId || null);
    const masteryLevel = currentProgress?.mastery_level || 1;
    const difficulty = masteryLevel === 1 ? "Basic (Introductory)" : masteryLevel === 2 ? "Intermediate (Application)" : "Advanced (Problem Solving)";

    // RAG: Search curriculum content for quiz generation
    let ragContext = "";
    try {
      const ragResults = searchRAG(topicRows[0].title, 3);
      if (ragResults.length > 0) {
        ragContext = buildRAGContext(ragResults);
      }
    } catch (e) {
      logger.error({ error: e }, "RAG search for quiz failed");
    }

    const context = `TOPIC: ${topicRows[0].title}. FOCUS: ${topicRows[0].prompt}. DIFFICULTY: ${difficulty}.${ragContext}`;

    const prompt = `
      # MISSION
      Act as Ba Yama, the wise Grade 8/9 (Form 1/2) Math tutor from the Copperbelt. 
      Generate a 3-question multiple choice quiz for ${userName} at a ${difficulty} level.
      
      # CONTEXT
      ${context}
      
      # RULES
      1. Each question MUST have 4 options and 1 correct answer.
      2. Use Zambian settings (market prices, football scores, farm yields).
      3. USE LATEX: You MUST use $ or $$ delimiters for all mathematical notation, variables (e.g. $x^2$), and symbols.
      4. The "explanation" must be in Ba Yama's voice, encouraging and cultural.
      
      # OUTPUT FORMAT (STRICT JSON ONLY):
      [
        {
          "question": "The question... (using Unicode math)",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "answerIndex": 0,
          "explanation": "Why this is correct, using Ba Yama's voice."
        }
      ]
    `;

    try {
      const startTime = Date.now();
      const response = await fetch(OLLAMA_GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: `<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n`,
          stream: false,
          options: {
            num_ctx: 1024,
            temperature: 0.6,
            num_thread: 4
          }
        }),
      });

      if (!response.ok) throw new Error(`Ollama quiz gen status: ${response.status}`);
      
      const rawText = await response.text();
      if (!rawText || rawText.trim() === "") throw new Error("Empty response from Ollama during quiz generation");
      
      const data = JSON.parse(rawText);
      const responseTime = (Date.now() - startTime) / 1000;

      if (data && data.response) {
        // Extract JSON array
        const match = data.response.match(/\[[\s\S]*\]/);
        const quiz = JSON.parse(match ? match[0] : data.response);

        // Success log
        db.prepare('INSERT INTO performance_logs (user_id, topic_id, type, response_time, success_flag) VALUES (?, ?, ?, ?, ?)')
          .run(userId || null, topicId, 'quiz_gen', responseTime, 1);

        return quiz;
      }
      throw new Error("Invalid quiz data format from local brain");
    } catch (e) {
      logger.error({ error: e }, "Quiz Generation Failure");
      db.prepare('INSERT INTO performance_logs (user_id, topic_id, type, response_time, success_flag) VALUES (?, ?, ?, ?, ?)')
          .run(userId || null, topicId, 'quiz_gen', 0, 0);
    }
    return reply.status(500).send({ error: "Couldn't prepare the challenge." });
  });

  // Progress Endpoints
  app.get<{ Querystring: { userId?: string } }>('/api/progress', async (request) => {
    try {
      const { userId } = request.query;
      if (userId) {
        return db.prepare('SELECT * FROM user_progress WHERE user_id = ?').all(userId) || [];
      }
      return db.prepare('SELECT * FROM user_progress WHERE user_id IS NULL').all() || [];
    } catch (error) {
      logger.error({ error }, "Progress fetch error");
      return [];
    }
  });

  app.get<{ Querystring: { userId?: string } }>('/api/analytics', async (request) => {
    try {
      const { userId } = request.query;
      const uid = userId || null;
      
      const summary = db.prepare(`
        SELECT 
          CAST(COUNT(*) AS INTEGER) as total_interactions,
          COALESCE(AVG(response_time), 0) as avg_response_time,
          COALESCE(SUM(CASE WHEN success_flag = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 0) as success_rate
        FROM performance_logs
        WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)
      `).get(uid, uid) as any || { total_interactions: 0, avg_response_time: 0, success_rate: 0 };

      const topicProgress = db.prepare(`
        SELECT topic_id, score, mastery_level, attempts, average_response_time, points, streak
        FROM user_progress
        WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)
      `).all(uid, uid) || [];

      const history = db.prepare(`
        SELECT type, response_time, success_flag, timestamp
        FROM performance_logs
        WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)
        ORDER BY timestamp DESC
        LIMIT 20
      `).all(uid, uid) || [];

      return { summary, topicProgress, history };
    } catch (error) {
      logger.error({ error }, "Analytics fetch error");
      return { 
        summary: { total_interactions: 0, avg_response_time: 0, success_rate: 0 },
        topicProgress: [],
        history: []
      };
    }
  });

  app.post<{ Body: { topic_id: string, score: number, userId?: string, response_time?: number, engagement_time?: number } }>('/api/progress', async (request) => {
    const { topic_id, score, userId, response_time, engagement_time } = request.body;
    const uid = userId || null;

    // Calculate points: score * multiplier based on difficulty
    const pointsEarned = Math.round(score * 1.5);

    // Calculate new mastery level: if score > 80, increase mastery
    let mastery_level = 1;
    const current = db.prepare('SELECT mastery_level, streak, last_updated FROM user_progress WHERE topic_id = ? AND user_id IS ?').get(topic_id, uid) as any;
    
    let newStreak = 1;
    if (current) {
      if (score >= 80) {
        mastery_level = Math.min(3, current.mastery_level + 1);
      } else {
        mastery_level = current.mastery_level;
      }
      
      const lastUpdate = new Date(current.last_updated);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 3600 * 24));
      if (diffDays === 1) {
        newStreak = current.streak + 1;
      } else if (diffDays === 0) {
        newStreak = current.streak;
      }
    }

    db.prepare(`
      INSERT INTO user_progress (topic_id, user_id, score, attempts, mastery_level, average_response_time, engagement_time, points, streak, last_updated) 
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(topic_id, user_id) DO UPDATE SET 
        score = MAX(score, excluded.score),
        attempts = user_progress.attempts + 1,
        mastery_level = ?,
        average_response_time = (user_progress.average_response_time * user_progress.attempts + ?) / (user_progress.attempts + 1),
        engagement_time = user_progress.engagement_time + ?,
        points = user_progress.points + excluded.points,
        streak = ?,
        last_updated = CURRENT_TIMESTAMP
    `).run(topic_id, uid, score, mastery_level, response_time || 0, engagement_time || 0, pointsEarned, newStreak, mastery_level, response_time || 0, engagement_time || 0, newStreak);

    // Also log to performance_logs
    db.prepare(`
      INSERT INTO performance_logs (user_id, topic_id, type, response_time, success_flag)
      VALUES (?, ?, 'quiz', ?, ?)
    `).run(uid, topic_id, response_time || 0, score >= 60 ? 1 : 0);

    return { status: 'success', mastery_level, pointsEarned, streak: newStreak };
  });

  // RAG Search Endpoint
  app.post<{ Body: { query: string; limit?: number; userId?: string } }>('/api/rag/search', async (request, reply) => {
    const { query, limit = 5, userId } = request.body;

    if (!query) {
      return reply.status(400).send({ error: "Query is required" });
    }

    const startTime = Date.now();
    try {
      const results = searchRAG(query, limit);
      const context = buildRAGContext(results);
      const responseTime = (Date.now() - startTime) / 1000;

      // Log RAG performance
      db.prepare('INSERT INTO performance_logs (user_id, topic_id, type, response_time, success_flag) VALUES (?, ?, ?, ?, ?)')
        .run(userId || null, 'rag_search', 'rag_search', responseTime, 1);

      return {
        results,
        context,
        count: results.length,
        performance: { responseTime: `${responseTime.toFixed(2)}s` }
      };
    } catch (e) {
      logger.error({ error: e }, "RAG search endpoint error");
      const responseTime = (Date.now() - startTime) / 1000;

      // Log RAG failure
      db.prepare('INSERT INTO performance_logs (user_id, topic_id, type, response_time, success_flag) VALUES (?, ?, ?, ?, ?)')
        .run(userId || null, 'rag_search', 'rag_search', responseTime, 0);

      return reply.status(500).send({ error: "RAG search failed" });
    }
  });

  // Chat Endpoint (Reverted to Local Ollama for Offline Excellence)
  app.post<{ Body: ChatRequest }>('/api/chat', { schema: ChatSchema }, async (request, reply) => {
    let { message, history, topicId, userName, userId, image } = request.body;
    
    // Security: Sanitize input
    message = DOMPurify.sanitize(message);
    userName = userName ? DOMPurify.sanitize(userName) : "Taona";

    let topicContext = "General Zambian Math Curriculum context.";

    try {
      // 1. RAG: Search curriculum content
      const ragResults = searchRAG(message, 5);
      if (ragResults.length > 0) {
        const ragContext = buildRAGContext(ragResults);
        topicContext += ragContext;
      }

      // 2. Dictionary search for definitions
      const sanitizedFts = message.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(t => t).map(t => `${t}*`).join(' ');
      if (sanitizedFts) {
        const dictionaryMatches: any[] = db.prepare(`SELECT term, definition FROM dictionary_fts WHERE dictionary_fts MATCH ? LIMIT 2`).all(sanitizedFts);
        if (dictionaryMatches.length > 0) {
          topicContext += "\nDICTIONARY:\n" + dictionaryMatches.map(m => `- ${m.term}: ${m.definition}`).join('\n');
        }
      }

      // 3. Topic-specific context
      if (topicId) {
        const topicRows: any = db.prepare('SELECT title, prompt FROM topics WHERE id = ?').all(topicId);
        if (topicRows.length > 0) {
          topicContext += `\nMODULE: "${topicRows[0].title}". GOAL: ${topicRows[0].prompt}`;
        }
      }
    } catch (dbErr) {
      logger.error({ error: dbErr }, "RAG failed");
    }

    const fullPrompt = formatGemmaPrompt(message, topicContext, history, userName);

    try {
      const requestBody: any = {
        model: OLLAMA_MODEL, 
        prompt: fullPrompt,
        stream: false, // Forcing discrete payload for stability
        options: {
          num_ctx: 2048,
          temperature: 0.7,
          num_thread: 4
        }
      };

      // Add image to Ollama request if provided for vision processing
      if (image) {
        requestBody.images = [image];
      }

      let response = await fetch(OLLAMA_GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // If vision processing fails, retry without the image
      if (!response.ok && image) {
        logger.warn("Vision processing failed, retrying without image");
        delete requestBody.images;
        response = await fetch(OLLAMA_GENERATE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
      }

      if (!response.ok) throw new Error(`Ollama chat failed: ${response.status}`);

      const rawContent = await response.text();
      if (!rawContent || rawContent.trim() === "") throw new Error("Empty content from local machine");

      const data = JSON.parse(rawContent);
      if (!data || !data.response) throw new Error("Invalid model response format");

      const fullModelResponse = data.response;

      // Handle the response as a single blob for client-side stability if stream is disabled
      // Note: The frontend expects a stream in current implementation, 
      // but to comply with "Forces Ollama to return a single, complete JSON object", 
      // we must send it as a single chunk if we used stream:false.
      
      reply.raw.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      reply.raw.write(fullModelResponse);
      reply.raw.end();

      // Save to chat_history
      if (topicId) {
        db.prepare('INSERT INTO chat_history (topic_id, user_id, role, content) VALUES (?, ?, ?, ?)').run(topicId, userId || null, 'user', message);
        db.prepare('INSERT INTO chat_history (topic_id, user_id, role, content) VALUES (?, ?, ?, ?)').run(topicId, userId || null, 'model', fullModelResponse);
      }
    } catch (error: any) {
      logger.error({ error }, "Ollama Chat failed");
      return reply.status(500).send({ error: "Ba Yama's brain is offline. Please ensure Ollama is running locally." });
    }
  });

  // Feedback Endpoint
  app.post('/api/correct', async (request, reply) => {
    try {
      const feedback = request.body;
      const feedbackPath = path.join(__dirname, 'feedback.json');
      
      let currentFeedback = [];
      try {
        const data = await fs.readFile(feedbackPath, 'utf-8');
        currentFeedback = JSON.parse(data);
      } catch (e) {
        // file might not exist yet
      }

      currentFeedback.push({ ...feedback as any, timestamp: new Date().toISOString() });
      await fs.writeFile(feedbackPath, JSON.stringify(currentFeedback, null, 2));
      
      return { status: 'success' };
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Failed to save feedback' });
    }
  });

  // Teacher/Admin Dashboard Endpoints
  app.get('/api/teacher/classroom-stats', async (request, reply) => {
    try {
      const stats = db.prepare(`
        SELECT 
          COUNT(DISTINCT user_id) as total_students,
          AVG(score) as class_average,
          SUM(points) as total_points_earned,
          COUNT(*) as total_modules_completed
        FROM user_progress
      `).get();
      
      const problematicTopics = db.prepare(`
        SELECT topic_id, AVG(score) as avg_score, COUNT(*) as student_count
        FROM user_progress
        GROUP BY topic_id
        HAVING avg_score < 60
        LIMIT 5
      `).all();

      return { stats, problematicTopics };
    } catch (e) {
      return reply.status(500).send({ error: "Failed to load classroom stats" });
    }
  });

  // Personalized Greeting Endpoint (Secure Backend Logic - Reverted to Local Ollama)
  app.post<{ Body: { is_new_user: boolean; student_name: string; last_topic_studied: string | null; mastery_score: number | null; preferred_language: string } }>('/api/greeting', async (request, reply) => {
    const data = request.body;
    const fallbackResponse = {
      greeting: `Mwauka bwanji, ${data.student_name || "mwana"}! Welcome back to the Bulela Classroom Hub. Ready to explore your lessons today?`,
      suggested_next_step: "Pick a topic to start your journey."
    };

    const prompt = `
      Role: You are "Ba Yama," the core intelligent AI tutor for Bulela—warm, encouraging, and respected.
      
      Input Variables:
      is_new_user: ${data.is_new_user}
      student_name: "${data.student_name}"
      last_topic_studied: ${data.last_topic_studied ? `"${data.last_topic_studied}"` : 'null'}
      mastery_score: ${data.mastery_score}
      preferred_language: "${data.preferred_language}"
      
      Instructions:
      Personalization: You MUST address the student by their name ("${data.student_name}") in the greeting.
      Language: Always start with a localized greeting based on their preferred language (Bemba: "Shani", Nyanja: "Mwauka bwanji/Wa uka uli", English: "Hello").
      
      Conditional Logic:
      - If is_new_user is true: Introduce yourself. Explain your mission to help them build the nation through learning.
      - If is_new_user is false: Acknowledge their return and reference their progress. 
      
      Tone: Enthusiastic but professional. Use Chi-Zamblish warmth and local context.
      Greeting text must be concise.

      OUTPUT FORMAT: YOU MUST OUTPUT ONLY A JSON OBJECT with keys "greeting" and "suggested_next_step".
    `;

    try {
      const response = await fetch(OLLAMA_GENERATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: `<start_of_turn>user\n${prompt}<end_of_turn>\n<start_of_turn>model\n`,
          stream: false,
          options: {
            num_ctx: 512,
            temperature: 0.6,
            num_predict: 256,
            num_thread: 4
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama connectivity failure: ${response.status} ${response.statusText}`);
      }

      const rawContent = await response.text();
      if (!rawContent || rawContent.trim() === "") {
        throw new Error("Ollama returned an empty response string.");
      }

      const resData = JSON.parse(rawContent);
      if (!resData.response) {
        throw new Error("Ollama response missing nested 'response' field.");
      }

      const jsonMatch = resData.response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not locate JSON object patterns in Ollama response.");
      }

      const result = JSON.parse(jsonMatch[0]);
      return reply.send({
        greeting: result.greeting || fallbackResponse.greeting,
        suggested_next_step: result.suggested_next_step || fallbackResponse.suggested_next_step
      });

    } catch (err) {
      logger.warn({ error: err }, "Ollama Greeting Generation Interrupted");
      return reply.send(fallbackResponse);
    }
  });

  // Auth Policy Endpoint (Simplified Resilience Logic)
  app.post<{ Body: { network_status: string; clerk_user_id: string | null; local_sqlite_id: string | null; cached_progress_exists: boolean } }>('/api/auth-policy', async (request) => {
    const { network_status, clerk_user_id, local_sqlite_id } = request.body;
    
    if (network_status === 'Online' && clerk_user_id) {
       return { 
         access_level: 'FULL', 
         session_token: 'UPDATE_LOCAL_CACHE', 
         ui_message: "Connected to Bulela Cloud. Your progress is secure." 
       };
    }
    
    if (local_sqlite_id) {
       return { 
         access_level: 'OFFLINE', 
         session_token: 'QUEUE_OFFLINE_UPDATES', 
         ui_message: "We're working offline right now, but I've got your back!" 
       };
    }
    
    return { 
      access_level: 'GUEST', 
      session_token: 'GUEST_MODE', 
      ui_message: "Guest Mode active. Basic lessons available." 
    };
  });

  app.get<{ Querystring: { userId: string } }>('/api/export/user-data', async (request, reply) => {
    const { userId } = request.query;
    if (!userId) return reply.status(400).send({ error: "UserId required" });

    const progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').all(userId);
    const chat = db.prepare('SELECT * FROM chat_history WHERE user_id = ?').all(userId);
    
    return { progress, chat, exportDate: new Date().toISOString() };
  });

  // Static Assets & Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    // CRITICAL: Wrap Vite middleware to ensure API routes are NOT intercepted
    await (app as any).use((req: any, res: any, next: any) => {
      // Skip Vite for API requests
      if (req.url && req.url.startsWith('/api')) {
        return next();
      }
      vite.middlewares(req, res, next);
    });
  } else {
    app.register(fastifyStatic, {
      root: path.join(__dirname, 'dist'),
      prefix: '/',
    });
    app.setNotFoundHandler((req, reply) => {
      // Don't serve HTML for missing API routes in production
      if (req.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'API route not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  // Graceful Shutdown
  app.addHook('onClose', async () => {
    logger.info("Closing Database connection...");
    db.close();
  });

  // Final Listen
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`BULELA CLASSROOM HUB IS LIVE - Connect on your phone: http://${SERVER_IP}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer().catch((error) => logger.error(error, "Server startup failed"));
