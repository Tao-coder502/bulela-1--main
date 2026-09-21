import React, { useState, useRef, useEffect } from 'react';
import { Send, User as UserIcon, BookOpen, MessageSquare, AlertCircle, RefreshCw, Languages, Menu, X, Pencil, Check, LogIn, LogOut, ArrowRight, TrendingUp, Mic, Volume2, VolumeX, Camera, Image as ImageIcon, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import 'katex/dist/katex.min.css';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser, useClerk } from '@clerk/clerk-react';
import LandingPage from './components/LandingPage';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import MathCanvas from './components/MathCanvas';
import TeacherDashboard from './components/TeacherDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import JSChart from './components/JSChart';
import { latexToSpokenText, compressImageBase64 } from './lib/speechUtils';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  image?: string;
}

interface Topic {
  id: string;
  title: string;
  prompt: string;
}

type AccessLevel = 'FULL' | 'OFFLINE' | 'GUEST';

type BulelaUser = { id: string; firstName?: string | null; fullName?: string | null; };

interface BulelaProps {
  user: BulelaUser;
  signOut?: () => void;
  devMode?: boolean;
}

export default function App({ devMode = false }: { devMode?: boolean }) {
  const [isDevLoggedIn, setIsDevLoggedIn] = useState(false);

  if (devMode) {
    if (!isDevLoggedIn) {
      return (
        <div className="relative">
          <LandingPage devMode={true} onDevLogin={() => setIsDevLoggedIn(true)} />
          <div className="fixed bottom-4 right-4 z-[100]">
            <button 
              onClick={() => setIsDevLoggedIn(true)}
              className="bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-2xl hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              Enter App (Dev Mock)
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      );
    }
    const mockUser: BulelaUser = { id: 'dev_user_1', firstName: 'Dev', fullName: 'Development User' };
    return <BulelaMain user={mockUser} devMode={true} />;
  }
  return <ClerkApp />;
}

function ClerkApp() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 flex-col gap-4 text-green-700">
        <RefreshCw size={32} className="animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest">Preparing Bulela...</span>
      </div>
    );
  }

  if (!isSignedIn) {
    return <LandingPage devMode={false} />;
  }

  // Cast Clerk user to BulelaUser explicitly for type safety
  const bulelaUser: BulelaUser = {
    id: user.id || 'anonymous',
    firstName: user.firstName,
    fullName: user.fullName
  };

  return <BulelaMain user={bulelaUser} signOut={signOut} />;
}

function BulelaMain({ user, signOut, devMode }: BulelaProps) {
  const userName = user?.firstName || 'Taona';

  // --- STATE ---
  const [topics, setTopics] = useState<Topic[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [greetingInitiated, setGreetingInitiated] = useState(false);
  
  // Set initial personalized greeting
  useEffect(() => {
    if (greetingInitiated) return;
    
    // Set a placeholder while loading
    setMessages([{ role: 'model', content: "Mwauka bwanji! Ba Yama is gathering his thoughts..." }]);

    const initGreeting = async () => {
      let isNewUser = true;
      let lastTopic = null;
      let score = null;

      try {
        const url = user?.id ? `/api/progress?userId=${user.id}` : '/api/progress';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            isNewUser = false;
            const latest = data[data.length - 1];
            // If topics aren't loaded yet, we'll just use the ID or a generic placeholder
            lastTopic = (topics && topics.length > 0) 
              ? (topics.find(t => t.id === latest.topic_id)?.title || latest.topic_id)
              : "your previous session";
            score = latest.score;
          }
        }
      } catch (err) {
        console.error("Failed to fetch progress for greeting", err);
      }

      try {
        const res = await fetch('/api/greeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            is_new_user: isNewUser,
            student_name: userName,
            last_topic_studied: lastTopic,
            mastery_score: score,
            preferred_language: 'English' 
          })
        });
        
        if (res.ok) {
          const response = await res.json();
          setMessages([
            { 
              role: 'model', 
              content: `${response.greeting}\n\n**Next Step:** ${response.suggested_next_step}` 
            }
          ]);
        } else {
          throw new Error("Greeting failed");
        }
      } catch (err) {
        console.error("Failed to fetch personalized greeting", err);
        // Intelligent fallback that doesn't depend on Ollama
        let fallbackGreeting = "";
        let nextStep = "";
        
        if (isNewUser) {
          fallbackGreeting = `Mwauka bwanji, ${userName}! I am Ba Yama, your personal math tutor from the Copperbelt. I'm here to help you master Grade 8 & 9 mathematics and build our nation through education. Let's start your journey to excellence!`;
          nextStep = "Choose a math topic from the list above to begin learning.";
        } else {
          if (score && score >= 75) {
            fallbackGreeting = `Welcome back, ${userName}! You've been doing amazing work. I can see you scored ${score}% on your last topic. Keep pushing for excellence!`;
            nextStep = lastTopic ? `Continue with ${lastTopic} or try a new challenge.` : "Pick your next topic to keep learning.";
          } else {
            fallbackGreeting = `Mwauka bwanji, ${userName}! Welcome back. Math is a journey, and we'll get through it together. Every mistake is a stepping stone to success.`;
            nextStep = lastTopic ? `Let's revisit ${lastTopic} and strengthen your understanding.` : "Choose a topic to practice and improve.";
          }
        }
        
        setMessages([
          { 
            role: 'model', 
            content: `${fallbackGreeting}\n\n**Next Step:** ${nextStep}` 
          }
        ]);
      }
      setGreetingInitiated(true);
    };

    initGreeting();
  }, [userName, topics, greetingInitiated, user?.id]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictionaryQuery, setDictionaryQuery] = useState('');
  const [dictionaryResult, setDictionaryResult] = useState<{answer: string, sources: string[]} | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const [isChallengeOpen, setIsChallengeOpen] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<any[] | null>(null);
  const [quizStep, setQuizStep] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isTeacherDashboardOpen, setIsTeacherDashboardOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentlySpeakingIndex, setCurrentlySpeakingIndex] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isOffline, setIsOffline] = useState(false); // UI fallback trigger
  const [isNetworkOffline, setIsNetworkOffline] = useState(!navigator.onLine); // PWA Offline level
  const [engineStatus, setEngineStatus] = useState<'online' | 'offline' | 'unreachable'>('online');

  const [accessLevel, setAccessLevel] = useState<AccessLevel>('FULL');
  const [authHandshakeMessage, setAuthHandshakeMessage] = useState('');

  // --- RESILIENCE AUTH MANAGER ---
  useEffect(() => {
    const handleAuthResilience = async () => {
      try {
        const localId = localStorage.getItem('bulela_local_id');
        
        const res = await fetch('/api/auth-policy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            network_status: isNetworkOffline ? 'Offline' : 'Online',
            clerk_user_id: user?.id || null,
            local_sqlite_id: localId,
            cached_progress_exists: Object.keys(progress).length > 0
          })
        });

        if (res.ok) {
          const policy = await res.json();
          setAccessLevel(policy.access_level);
          setAuthHandshakeMessage(policy.ui_message);

          // Scenario 1 Logic: Sync Clerk ID with Local Cache
          if (policy.access_level === 'FULL' && user?.id) {
            localStorage.setItem('bulela_local_id', user.id);
          }
        }
      } catch (err) {
        console.error("Auth resilience check failed", err);
      }
    };

    handleAuthResilience();
  }, [isNetworkOffline, user?.id, progress]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const compressedBase64 = await compressImageBase64(rawBase64, 1024, 1024, 0.8);
        handleSendMessage(undefined, `[IMAGE_UPLOADED] Mwaice, I've just shared a photo of my notebook with you. Can you check my calculation?`, compressedBase64);
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCameraUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const compressedBase64 = await compressImageBase64(rawBase64, 1024, 1024, 0.8);
        handleSendMessage(undefined, `[CAMERA_PHOTO] Mwaice, I took a photo of my math problem. Please help me solve it step-by-step!`, compressedBase64);
      };
      reader.readAsDataURL(file);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // --- EFFECTS ---
  useEffect(() => {
    handleFetchTopics();
    handleFetchProgress();

    const handleOnline = () => setIsNetworkOffline(false);
    const handleOffline = () => setIsNetworkOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- HEALTH MONITOR ---
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/api/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          setEngineStatus(data.engine);
        } else {
          setEngineStatus('offline');
        }
      } catch (err) {
        setEngineStatus('unreachable');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDictionarySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dictionaryQuery.trim() || isSearching) return;

    setIsSearching(true);
    setDictionaryResult(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: dictionaryQuery }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setDictionaryResult(data);
    } catch (err) {
      console.error(err);
      alert("Iyee! I couldn't find that in my notes right now.");
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // --- API HANDLERS ---
  
  const handleFetchTopics = async () => {
    try {
      const res = await fetch('/api/topics');
      if (!res.ok) throw new Error("Offline");
      const data = await res.json();
      setTopics(data);
      setIsOffline(false);
    } catch (err) {
      console.error("Failed to fetch topics", err);
      setIsOffline(true);
    }
  };

  const handleFetchProgress = async () => {
    try {
      const url = user?.id ? `/api/progress?userId=${user.id}` : '/api/progress';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, number> = {};
        data.forEach((p: any) => map[p.topic_id] = p.score);
        setProgress(map);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartChallenge = async () => {
    if (!activeTopicId) {
      alert("Amani! Pick a topic first before the challenge!");
      return;
    }
    setIsQuizLoading(true);
    setIsChallengeOpen(true);
    setQuizStep(0);
    setQuizScore(0);
    setCurrentQuiz(null);

    try {
      const url = `/api/quiz/${activeTopicId}?userName=${encodeURIComponent(userName)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Quiz check failed");
      const data = await res.json();
      setCurrentQuiz(data);
    } catch (err) {
      console.error(err);
      alert("Iyee! Ba Yama is still writing the questions. Try again soon.");
      setIsChallengeOpen(false);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleQuizAnswer = async (index: number) => {
    if (!currentQuiz) return;
    const isCorrect = index === currentQuiz[quizStep].answerIndex;
    const newScore = isCorrect ? quizScore + 1 : quizScore;
    
    if (quizStep < currentQuiz.length - 1) {
      setQuizScore(newScore);
      setQuizStep(prev => prev + 1);
    } else {
      // Finalize Quiz
      const finalScore = Math.round((newScore / currentQuiz.length) * 100);
      setQuizScore(newScore);
      setQuizStep(prev => prev + 1); // Go to results step

      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            topic_id: activeTopicId, 
            score: finalScore,
            userId: user?.id,
            response_time: 0, 
            engagement_time: 120 
          }),
        });
        handleFetchProgress();
      } catch (err) {
        console.error("Failed to save progress", err);
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customMessage?: string, imageData?: string) => {
    e?.preventDefault();
    let userMessage = customMessage || input.trim();
    if (!userMessage || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', content: userMessage, image: imageData }]);
    setIsLoading(true);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage, 
          history: messages,
          topicId: activeTopicId,
          userName: userName,
          userId: user?.id,
          image: imageData
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Communication error' }));
        throw new Error(errorData.error || 'Server error');
      }

      setMessages(prev => [...prev, { role: 'model', content: "" }]);
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream not supported");

      const decoder = new TextDecoder();
      let accumulatedResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedResponse += chunk;

        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { 
            role: 'model', 
            content: accumulatedResponse 
          };
          return newMessages;
        });
      }

      setIsOffline(false);
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: err.message.includes('Local Brain') 
          ? "Local Brain not found. Please ensure Ollama is running." 
          : "Sorry, I had a bit of a wobble there. Can you try again?" 
      }]);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameTopic = async (id: string) => {
    if (!editValue.trim()) return;
    const originalTopics = [...topics];
    setTopics(prev => prev.map(t => t.id === id ? { ...t, title: editValue } : t));
    setEditingTopicId(null);

    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editValue }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch (err) {
      console.error("Failed to save topic", err);
      setTopics(originalTopics);
      alert("I couldn't save that change right now.");
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackInput.trim()) return;
    try {
      const res = await fetch('/api/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          feedback: feedbackInput, 
          lastMessage: messages[messages.length - 1].content,
          topicId: activeTopicId 
        }),
      });
      if (!res.ok) throw new Error("Feedback failure");
      setFeedbackInput('');
      setShowFeedbackModal(false);
      alert("Zikomo! Your feedback helps Bulela learn.");
    } catch (err) {
      console.error(err);
    }
  };

  const speak = (text: string, msgIndex?: number) => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (isSpeaking && currentlySpeakingIndex === msgIndex) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setCurrentlySpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanSpokenText = latexToSpokenText(text);
    if (!cleanSpokenText) return;

    const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
    utterance.onstart = () => {
      setIsSpeaking(true);
      if (msgIndex !== undefined) setCurrentlySpeakingIndex(msgIndex);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentlySpeakingIndex(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentlySpeakingIndex(null);
    };
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari for voice input.");
      return;
    }
    
    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    
    // Try Zambian English first, fallback to US English if not supported
    recognition.lang = 'en-ZM';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsListening(false);
    };
    
    recognition.onerror = (event: any) => {
      setIsListening(false);
      
      // Handle locale-specific and connectivity issues in an offline-first friendly way
      const errorStr = String(event.error || '').toLowerCase();
      
      if (errorStr === 'not-allowed') {
        alert("Ba Yama needs microphone permission, mwana! Please allow mic access in your browser settings to speak your question.");
      } else if (errorStr === 'no-speech') {
        alert("Iyee! I didn't hear anything. Please speak clearly into your mic and try again!");
      } else if (errorStr === 'audio-capture') {
        alert("No microphone found, mwebane! Please double-check your device mic connection.");
      } else if (errorStr === 'network') {
        alert("Mwebane, voice input (Web Speech) requires active internet for speech processing. Since Bulela is designed to save data and run offline, if you are offline now, please type your math question or snap a photo of your notebook instead!");
      } else if (errorStr === 'language-not-supported' || errorStr === 'not-supported') {
        // Silently fallback to en-US/en-GB if en-ZM is not supported by standard Chrome
        console.warn("Zambian English locale not supported natively, retrying with en-US...");
        try {
          const fallbackRecognition = new SpeechRecognition();
          fallbackRecognition.lang = 'en-US';
          fallbackRecognition.continuous = false;
          fallbackRecognition.interimResults = false;
          
          fallbackRecognition.onresult = (fallbackEvent: any) => {
            const transcript = fallbackEvent.results[0][0].transcript;
            setInput(prev => prev ? `${prev} ${transcript}` : transcript);
            setIsListening(false);
          };
          
          fallbackRecognition.onerror = (fbEvent: any) => {
            setIsListening(false);
            const fbError = String(fbEvent.error || '').toLowerCase();
            if (fbError === 'network') {
              alert("Mwebane, voice input requires an internet connection to transcribe. Since Bulela is built for offline networks, please type your question or snap a photo!");
            }
          };
          fallbackRecognition.onend = () => setIsListening(false);
          
          fallbackRecognition.start();
        } catch (retryErr) {
          console.error("Fallback speech recognition failed:", retryErr);
          setIsListening(false);
        }
      } else {
        // For other unrecognized errors, attempt en-US fallback as a safety measure
        console.warn(`Speech recognition event error: ${event.error}, falling back to en-US...`);
        try {
          const fallbackRecognition = new SpeechRecognition();
          fallbackRecognition.lang = 'en-US';
          fallbackRecognition.continuous = false;
          fallbackRecognition.interimResults = false;
          
          fallbackRecognition.onresult = (fallbackEvent: any) => {
            const transcript = fallbackEvent.results[0][0].transcript;
            setInput(prev => prev ? `${prev} ${transcript}` : transcript);
            setIsListening(false);
          };
          
          fallbackRecognition.onerror = () => setIsListening(false);
          fallbackRecognition.onend = () => setIsListening(false);
          
          fallbackRecognition.start();
        } catch (retryErr) {
          console.error("Catch-all fallback speech recognition failed:", retryErr);
          setIsListening(false);
        }
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };
  
  const onSelectTopic = async (topic: Topic) => {
    if (editingTopicId) return; 
    setActiveTopicId(topic.id);
    setIsSidebarOpen(false);
    
    setIsLoading(true);
    try {
      const url = user?.id 
        ? `/api/topics/${topic.id}/history?userId=${user.id}` 
        : `/api/topics/${topic.id}/history`;
      const res = await fetch(url);
      if (res.ok) {
        const history = await res.json();
        if (history.length > 0) {
          setMessages(history);
        } else {
          setMessages([{ 
            role: 'model', 
            content: `Great choice! We're now diving into ${topic.title}. Ready to solve some problems?` 
          }]);
        }
      }
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden relative selection:bg-green-100 selection:text-green-900">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center shadow-lg shadow-green-200/50">
                <span className="text-white font-bold text-xl leading-none">B</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight font-display">Bulela</h1>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Copperbelt Lab / EdTech</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 px-3 py-2 uppercase tracking-wider mb-2">Tutor Tools</div>
          
          <motion.div 
            whileHover={accessLevel !== 'GUEST' ? { scale: 1.02 } : {}}
            whileTap={accessLevel !== 'GUEST' ? { scale: 0.98 } : {}}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl shadow-sm border cursor-pointer mb-2 transition-all ${
              accessLevel === 'GUEST' ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-100 grayscale text-slate-400' : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
            }`}
            onClick={() => { 
              if (accessLevel === 'GUEST') return;
              setIsAnalyticsOpen(true); 
              setIsSidebarOpen(false); 
            }}
          >
            <TrendingUp size={16} className={accessLevel === 'GUEST' ? 'text-slate-300' : 'text-blue-600'} />
            Performance Insights {accessLevel === 'GUEST' && "🔒"}
          </motion.div>

          <motion.div 
            whileHover={accessLevel !== 'GUEST' ? { scale: 1.02 } : {}}
            whileTap={accessLevel !== 'GUEST' ? { scale: 0.98 } : {}}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-bold rounded-xl shadow-sm border cursor-pointer mb-2 transition-all ${
              accessLevel === 'GUEST' ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-100 grayscale text-slate-400' : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
            }`}
            onClick={() => { 
              if (accessLevel === 'GUEST') return;
              setIsTeacherDashboardOpen(true); 
              setIsSidebarOpen(false); 
            }}
          >
            <Users size={16} className={accessLevel === 'GUEST' ? 'text-slate-300' : 'text-purple-600'} />
            Teacher Dashboard {accessLevel === 'GUEST' && "🔒"}
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-green-700 bg-green-50 rounded-xl cursor-pointer hover:bg-green-100 transition-all border border-green-200 mb-2"
            onClick={() => { setIsDictionaryOpen(true); setIsSidebarOpen(false); }}
          >
            <BookOpen size={16} />
            Ask Ba Yama (RAG)
          </motion.div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-amber-700 bg-amber-50 rounded-xl cursor-pointer hover:bg-amber-100 transition-all border border-amber-200 mb-6"
            onClick={() => { handleStartChallenge(); setIsSidebarOpen(false); }}
          >
            <RefreshCw size={16} />
            Ba Yama Challenge
          </motion.div>

          <div className="text-[10px] font-bold text-slate-400 px-3 py-2 uppercase tracking-wider mb-2 border-t border-slate-50 pt-4">Curriculum / Zambian Standards</div>
          {(accessLevel === 'GUEST' ? topics.slice(0, 2) : (topics || [])).map(topic => (
            <motion.div
              layout
              key={topic.id}
              className={`group flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all cursor-pointer mb-1 ${
                activeTopicId === topic.id 
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => onSelectTopic(topic)}
            >
              <div className="flex-1 flex items-center justify-between min-w-0">
                {editingTopicId === topic.id ? (
                  <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                    <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRenameTopic(topic.id)} className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-sm text-slate-900" />
                    <Check size={14} className="text-green-600" onClick={() => handleRenameTopic(topic.id)} />
                  </div>
                ) : (
                  <>
                    <span className="truncate">{topic.title}</span>
                    <div className="flex items-center gap-2">
                      {progress[topic.id] !== undefined && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTopicId === topic.id ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}`}>{progress[topic.id]}%</span>}
                      <Pencil size={14} className={`transition-opacity cursor-pointer shrink-0 ${activeTopicId === topic.id ? 'opacity-40 hover:opacity-100' : 'opacity-0 group-hover:opacity-40 hover:opacity-100'}`} onClick={(e) => { e.stopPropagation(); setEditingTopicId(topic.id); setEditValue(topic.title); }} />
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-4 bg-white/50 backdrop-blur-md">
          <div className="bg-slate-900 rounded-2xl p-4 shadow-xl border border-slate-800">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={12} className="text-green-400" />
                <span className="text-[10px] font-bold uppercase text-slate-200 tracking-wider">Scholastic Points</span>
              </div>
              <span className="text-xs font-black text-green-400">
                {Object.values(progress).reduce((a, b) => a + (Math.round(b * 1.5)), 0)} pts
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${isNetworkOffline ? 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.5)]' : 'bg-green-400 shadow-[0_0_4px_rgba(34,197,94,0.5)] animate-pulse'}`}></div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                {isNetworkOffline ? 'Local Processing Active' : 'Gemma Core Live'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight font-medium">
              {isNetworkOffline 
                ? 'Running entirely on-device. Zero data usage mode.' 
                : 'High-fidelity AI tutor for Grades 8-9 math aligned with CBC.'}
            </p>
          </div>

          <SignedIn>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <UserButton afterSignOutUrl="/" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{user?.fullName}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Bulela Student</span>
                </div>
              </div>
            </div>
          </SignedIn>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-white">
        <header className="h-20 border-b border-slate-100 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 shrink-0 z-30 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} aria-label="Open sidebar menu" aria-expanded={isSidebarOpen} className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 rounded">
              <Menu size={24} />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded leading-none">Mathematics</span>
                <span className="text-slate-300">/</span>
                <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest bg-green-50 px-1.5 py-0.5 rounded leading-none">Grades 8-9 / Zambian CBC</span>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded leading-none flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-blue-600 animate-pulse" />
                  Classroom Hub
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 font-display">Tutoring with Ba Yama</h2>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden md:flex items-center gap-2" role="status" aria-live="polite">
              <div className={`w-2.5 h-2.5 rounded-full ${
                isNetworkOffline ? 'bg-slate-400' :
                engineStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                'bg-amber-500 animate-pulse'
              }`} aria-hidden="true"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {isNetworkOffline ? 'Offline' : engineStatus === 'online' ? 'Brain Connected' : 'Brain Syncing'}
              </span>
            </div>
            <button onClick={() => setShowFeedbackModal(true)} aria-label="Open feedback modal to improve localization" className="text-[10px] sm:text-xs font-bold text-slate-500 hover:text-green-700 transition-colors uppercase tracking-widest flex items-center gap-1.5 group focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-2 py-1">
              <Languages size={14} className="transition-transform group-hover:rotate-12" aria-hidden="true" />
              <span className="hidden sm:inline">Improve Localization</span>
            </button>
            <div className="h-6 w-px bg-slate-100 hidden sm:block" aria-hidden="true"></div>
            <div className="flex items-center gap-2 text-green-700">
              <Check size={14} className="hidden sm:block" aria-hidden="true" />
              <span className="px-2.5 py-1 bg-green-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md shadow-green-200">Session active</span>
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col gap-8 scroll-smooth">
          <div className="max-w-4xl mx-auto w-full space-y-8 pb-32">
            {accessLevel !== 'FULL' && authHandshakeMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className={`p-4 rounded-2xl border flex items-center gap-4 shadow-sm transition-all ${
                  accessLevel === 'OFFLINE' 
                  ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-amber-100/50' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 shadow-slate-100/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  accessLevel === 'OFFLINE' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  <AlertCircle size={20} />
                </div>
                <div>
                   <h3 className="text-sm font-bold tracking-tight mb-0.5">
                     {accessLevel === 'OFFLINE' ? 'Offline Classroom Secured' : 'Bulela Guest Mode'}
                   </h3>
                   <p className="text-xs font-medium opacity-70">
                     {authHandshakeMessage}
                   </p>
                </div>
              </motion.div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((m, i) => {
                const isEncouragement = m.role === 'model' && m.content.length > 200;
                const isCurrentlySpeakingThis = isSpeaking && currentlySpeakingIndex === i;

                return (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`flex gap-3 sm:gap-4 max-w-[95%] sm:max-w-2xl ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-2xl shrink-0 flex items-center justify-center font-bold shadow-lg transition-all group-hover:scale-110 ${m.role === 'user' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-900 text-white shadow-slate-200'}`}>
                        {m.role === 'user' ? <UserIcon size={18} /> : <div className="text-sm font-black">B</div>}
                      </div>
                      <div className={`rounded-3xl p-4 sm:p-6 shadow-sm border transition-all ${m.role === 'user' ? 'bg-blue-600 text-white border-blue-500 rounded-tr-none' : isEncouragement ? 'bg-green-50 border-green-100 text-slate-800 rounded-tl-none shadow-green-100/50' : 'bg-white border-slate-100 text-slate-800 rounded-tl-none shadow-slate-100/20'}`}>
                        {m.image && (
                          <div className="mb-3 rounded-2xl overflow-hidden border border-slate-200 shadow-sm max-w-xs bg-slate-50">
                            <img src={m.image} alt="Math problem context" className="w-full h-auto object-cover max-h-48" />
                          </div>
                        )}
                        {isEncouragement && <div className="text-[10px] font-black text-green-700 uppercase mb-3 flex items-center gap-1.5 tracking-widest border-b border-green-200/50 pb-2"><BookOpen size={12} /> Cultural Insight / Analogy</div>}
                        <div className={`markdown-body text-sm sm:text-[15px] leading-relaxed ${m.role === 'user' ? 'prose-invert font-medium' : ''}`}>
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex, rehypeSanitize]}
                            components={{
                              code(props) {
                                const { className, children, ...rest } = props;
                                const match = /language-([\w-]+)/.exec(className || '');
                                if (match) {
                                  if (match[1] === 'svg') {
                                    return (
                                      <div 
                                        className="my-4 flex justify-center bg-slate-50 p-4 rounded-2xl border border-slate-100 overflow-x-auto shadow-inner"
                                        dangerouslySetInnerHTML={{ __html: String(children) }}
                                      />
                                    );
                                  }
                                  if (match[1] === 'javascript-chart' || match[1] === 'chart') {
                                    return (
                                      <JSChart code={String(children)} />
                                    );
                                  }
                                }
                                return <code className={className} {...rest}>{children}</code>;
                              }
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                        {m.role === 'model' && (
                          <div className="flex items-center justify-between border-t border-slate-100 mt-3 pt-2.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ba Yama Step Explanation</span>
                            <button
                              type="button"
                              onClick={() => speak(m.content, i)}
                              className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${
                                isCurrentlySpeakingThis
                                  ? 'bg-green-700 text-white shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 bg-slate-50 border border-slate-200/60'
                              }`}
                              title="Listen to Ba Yama"
                            >
                              {isCurrentlySpeakingThis ? (
                                <>
                                  <Volume2 size={14} className="animate-bounce" />
                                  <span>Stop</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 size={14} />
                                  <span>Listen</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
                  <RefreshCw size={16} className="animate-spin" />
                </div>
                <div className="bg-white border border-slate-100 rounded-3xl p-4 sm:p-6 shadow-sm text-slate-400 italic text-sm font-medium">Ba Yama is deriving the solution...</div>
              </motion.div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-4 sm:p-8 bg-gradient-to-t from-white via-white to-transparent pointer-events-none z-20">
          <div className="max-w-4xl mx-auto w-full pointer-events-auto">
            {isListening && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center justify-between text-xs font-bold shadow-md">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-ping" />
                  <span>Listening to your math question... Speak clearly into your microphone!</span>
                </div>
                <button type="button" onClick={() => setIsListening(false)} className="text-red-500 hover:text-red-800 p-1">
                  <X size={16} />
                </button>
              </motion.div>
            )}
            <form onSubmit={handleSendMessage} className="relative flex items-end gap-3 sm:gap-4">
              <div className="relative flex-1 group">
                <textarea rows={1} value={input} onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`; }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} disabled={isLoading} placeholder="Type your math problem or upload a notebook photo..." className="w-full bg-white border-2 border-slate-200 rounded-[2rem] px-6 py-4 pr-40 text-sm sm:text-base focus:outline-none focus:ring-8 focus:ring-green-500/5 transition-all placeholder:text-slate-400 min-w-0 shadow-2xl resize-none max-h-40 overflow-y-auto" />
                <div className="absolute right-3 bottom-3 flex items-center gap-1 sm:gap-1.5">
                  <button type="button" onClick={() => cameraInputRef.current?.click()} aria-label="Snap Camera Photo" className="p-2 sm:p-2.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-green-500" title="Snap Camera Photo"><Camera size={18} /></button>
                  <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleCameraUpload} aria-label="Camera image upload input" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Upload Notebook Photo" className="p-2 sm:p-2.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-green-500" title="Upload Notebook File"><ImageIcon size={18} /></button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} aria-label="Image upload input" />
                  <button type="button" onClick={startListening} aria-label="Voice Input" aria-pressed={isListening} className={`p-2 sm:p-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-green-500 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} title="Speak Problem"><Mic size={18} /></button>
                  <button type="submit" disabled={!input.trim() || isLoading} aria-label="Send message" className="bg-green-700 text-white p-2 sm:p-2.5 rounded-full hover:bg-green-800 transition-all disabled:opacity-30 shadow-lg shadow-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"><Send size={18} /></button>
                </div>
              </div>
            </form>
            <div className="mt-4 flex justify-between items-center px-4">
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em]">Grade 8 & 9 Math / Zambian National Curriculum</p>
              <div className="flex gap-4">
                <button onClick={() => setIsCanvasOpen(true)} aria-label="Open math canvas for handwriting" className="text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 text-slate-400 hover:text-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-2 py-1"><Pencil size={12} /> Scholarly Script</button>
                <button onClick={() => speak(messages[messages.length - 1]?.content || "")} aria-label={isSpeaking ? "Stop narration" : "Read answer aloud"} aria-pressed={isSpeaking} className={`text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-2 py-1 ${isSpeaking ? 'text-green-600' : 'text-slate-400 hover:text-slate-500'}`}>{isSpeaking ? <Volume2 size={12} className="animate-bounce" /> : <VolumeX size={12} />} {isSpeaking ? 'Stop Narrator' : 'Vocalize Latest'}</button>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isAnalyticsOpen && (
            <ErrorBoundary>
              <AnalyticsDashboard userId={user?.id} onClose={() => setIsAnalyticsOpen(false)} />
            </ErrorBoundary>
          )}
          {isCanvasOpen && (
            <ErrorBoundary>
              <MathCanvas 
                onClose={() => setIsCanvasOpen(false)} 
                onRecognize={(eq) => { setIsCanvasOpen(false); handleSendMessage(undefined, eq); }}
                onRecognizeImage={(base64Img) => { 
                  setIsCanvasOpen(false); 
                  handleSendMessage(undefined, `[HANDWRITTEN_CANVAS] Mwaice, I've drawn a handwritten math problem on my scratchpad. Please analyze the equation in this drawing!`, base64Img); 
                }} 
              />
            </ErrorBoundary>
          )}
          {isTeacherDashboardOpen && (
            <ErrorBoundary>
              <TeacherDashboard onClose={() => setIsTeacherDashboardOpen(false)} />
            </ErrorBoundary>
          )}
        </AnimatePresence>
      </main>

      {showFeedbackModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Languages size={24} className="text-green-700" /> Improve Localization</h2>
            <textarea value={feedbackInput} onChange={(e) => setFeedbackInput(e.target.value)} placeholder="Tell us what we can improve..." className="w-full h-32 bg-slate-50 border rounded-2xl p-4 text-sm mb-6 outline-none shadow-inner" />
            <div className="flex gap-3"><button onClick={() => setShowFeedbackModal(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancel</button><button onClick={handleSubmitFeedback} className="flex-1 py-3 bg-green-700 text-white font-bold rounded-xl">Send feedback</button></div>
          </motion.div>
        </div>
      )}
      {isDictionaryOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between mb-4"><h2 className="text-xl font-bold flex items-center gap-2"><BookOpen className="text-green-700" /> Ask Ba Yama</h2><button onClick={() => setIsDictionaryOpen(false)}><X size={20} /></button></div>
            <form onSubmit={handleDictionarySearch} className="flex gap-2 mb-6"><input autoFocus value={dictionaryQuery} onChange={(e) => setDictionaryQuery(e.target.value)} placeholder="Ex: Intersection?" className="flex-1 bg-slate-50 border rounded-2xl px-4 py-3" /><button type="submit" className="bg-green-700 text-white font-bold px-6 py-3 rounded-2xl">Ask</button></form>
            <div className="max-h-[50vh] overflow-y-auto">
              {dictionaryResult ? (
                <div className="bg-green-50 p-6 rounded-2xl">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeSanitize]}
                    components={{
                      code(props) {
                        const { className, children, ...rest } = props;
                        const match = /language-([\w-]+)/.exec(className || '');
                        if (match) {
                          if (match[1] === 'svg') {
                            return (
                              <div 
                                className="my-4 flex justify-center bg-white p-4 rounded-2xl border border-slate-100 overflow-x-auto shadow-inner"
                                dangerouslySetInnerHTML={{ __html: String(children) }}
                              />
                            );
                          }
                          if (match[1] === 'javascript-chart' || match[1] === 'chart') {
                            return (
                              <JSChart code={String(children)} />
                            );
                          }
                        }
                        return <code className={className} {...rest}>{children}</code>;
                      }
                    }}
                  >
                    {dictionaryResult.answer}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-center text-slate-400 italic">"Ask me anything, mwana!"</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
      {isChallengeOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between mb-6"><h2 className="text-xl font-bold flex items-center gap-2"><RefreshCw className="text-amber-600" /> Ba Yama's Challenge</h2><button onClick={() => setIsChallengeOpen(false)}><X size={20} /></button></div>
            {isQuizLoading ? <div className="text-center py-12 animate-pulse">Setting up the match...</div> : currentQuiz && quizStep < currentQuiz.length ? <div className="space-y-6"><h3>{currentQuiz[quizStep].question}</h3><div className="grid gap-3">{currentQuiz[quizStep].options.map((opt: string, i: number) => <button key={i} onClick={() => handleQuizAnswer(i)} className="text-left p-4 rounded-2xl border hover:bg-amber-50">{opt}</button>)}</div></div> : <div className="text-center py-8"><h3>Quiz Complete!</h3><button onClick={() => setIsChallengeOpen(false)} className="bg-green-700 text-white font-bold w-full py-4 rounded-2xl mt-8">Back to Lessons</button></div>}
          </motion.div>
        </div>
      )}
    </div>
  );
}
