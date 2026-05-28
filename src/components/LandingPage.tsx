import React from 'react';
import { 
  ChevronRight, 
  Globe, 
  Brain, 
  Zap, 
  Lock, 
  ArrowRight, 
  MessageCircle,
  Menu,
  X,
  Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function BulelaLandingPage({ 
  devMode = false, 
  onDevLogin 
}: { 
  devMode?: boolean; 
  onDevLogin?: () => void; 
}) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const LoginWrapper = ({ children }: { children: React.ReactNode }) => {
    if (devMode || !PUBLISHABLE_KEY) {
      return <div onClick={onDevLogin || (() => {})} className="contents cursor-pointer">{children}</div>;
    }
    return <SignInButton mode="modal">{children}</SignInButton>;
  };

  const SignupWrapper = ({ children }: { children: React.ReactNode }) => {
    if (devMode || !PUBLISHABLE_KEY) {
      return <div onClick={onDevLogin || (() => {})} className="contents cursor-pointer">{children}</div>;
    }
    return <SignUpButton mode="modal">{children}</SignUpButton>;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-green-100 selection:text-green-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl leading-none">B</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 font-display">Bulela</span>
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#problem" className="text-sm font-medium text-slate-600 hover:text-green-700 transition-colors">The Challenge</a>
              <a href="#ba-yama" className="text-sm font-medium text-slate-600 hover:text-green-700 transition-colors">Meet Ba Yama</a>
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-green-700 transition-colors">Platform</a>
              <LoginWrapper>
                <button className="text-sm font-bold text-slate-900 hover:text-green-700 transition-colors cursor-pointer">Log In</button>
              </LoginWrapper>
              <SignupWrapper>
                <button className="bg-green-700 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-green-800 transition-all shadow-md shadow-green-200 cursor-pointer">
                  Start Learning Free
                </button>
              </SignupWrapper>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600">
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden bg-white border-b border-slate-100 p-4 space-y-4"
            >
              <a href="#problem" onClick={() => setIsMenuOpen(false)} className="block text-base font-medium text-slate-600">The Challenge</a>
              <a href="#ba-yama" onClick={() => setIsMenuOpen(false)} className="block text-base font-medium text-slate-600">Meet Ba Yama</a>
              <a href="#features" onClick={() => setIsMenuOpen(false)} className="block text-base font-medium text-slate-600">Platform</a>
              <div className="pt-4 flex flex-col gap-3">
                <LoginWrapper>
                  <button className="w-full py-3 text-center font-bold text-slate-900 border border-slate-200 rounded-xl cursor-pointer">Log In</button>
                </LoginWrapper>
                <SignupWrapper>
                  <button className="w-full py-3 bg-green-700 text-white rounded-xl font-bold shadow-lg cursor-pointer">Start Learning Free</button>
                </SignupWrapper>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                <Zap size={14} className="fill-current" />
                Powered by Gemma 4
              </div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1] mb-6 font-display">
                Master Math in your <span className="text-green-700">Mother Tongue.</span>
              </h1>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-xl">
                Bulela: Junior Secondary Math tutoring from "Ba Yama," our specialized AI, fluent in English, Bemba, and Nyanja. Bridging the cognitive gap in African education.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <SignupWrapper>
                  <button className="px-8 py-4 bg-green-700 text-white rounded-2xl font-bold text-lg hover:bg-green-800 transition-all shadow-xl shadow-green-200 flex items-center justify-center gap-2 group cursor-pointer">
                    Start Learning Free
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </SignupWrapper>
                <a href="#ba-yama" className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                  See Ba Yama in Action
                </a>
              </div>
              <div className="mt-10 flex items-center gap-4 text-slate-400 text-sm font-medium">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-bold">
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <span>Trusted by 500+ Zambian students</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative lg:block"
            >
              <div className="relative bg-slate-100 rounded-[3rem] p-4 shadow-2xl border border-slate-200">
                <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 aspect-[4/3] flex flex-col relative overflow-hidden">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center text-white font-bold">B</div>
                      <div>
                        <div className="font-bold text-slate-900">Ba Yama</div>
                        <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Tutoring Active</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Live</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div className="bg-slate-50 rounded-2xl p-4 max-w-[80%] border border-slate-100">
                      <p className="text-sm font-medium text-slate-800">Can you explain Sets using an analogy from a Zambian market?</p>
                    </div>
                    <div className="bg-green-700/5 rounded-2xl p-4 max-w-[90%] ml-auto border border-green-100">
                      <div className="text-sm font-medium text-slate-800 leading-relaxed mb-3">
                        {`Of course, mwana! Think of a Set like a kantemba (market kiosk). All the soaps are one set, and all the cooking oil bottles are another set.`}
                        <div className="mt-2 font-mono text-xs space-y-1">
                          <div>𝐴 = {`{Soap, Oil, Salt}`}</div>
                          <div>𝐵 = {`{Oil, Rice, Flour}`}</div>
                          <div className="font-bold text-green-700">𝐴 ∩ 𝐵 = {`{Oil}`}</div>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-green-700 uppercase">Localized Interpretation</div>
                      <p className="text-xs italic text-slate-500 mt-1">"Set ni group ya vitu pamozi mu kantemba."</p>
                    </div>
                  </div>

                  {/* Abstract Math Orbs */}
                  <div className="absolute top-1/2 -right-12 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl animate-pulse"></div>
                  <div className="absolute -bottom-8 left-12 w-32 h-32 bg-green-400/20 rounded-full blur-2xl animate-pulse delay-700"></div>
                </div>
              </div>
              
              {/* Floating LaTeX Badge */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-6 -right-6 bg-white shadow-xl border border-slate-100 rounded-2xl p-4 z-20"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Concept Mastery</div>
                <div className="text-sm font-bold text-slate-900 underline decoration-green-500 underline-offset-4 pointer-events-none">
                  2𝑥 + 5 = 11 ⟹ 𝑥 = 3
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
        
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 -translate-y-1/2 w-1/2 h-1/2 bg-green-50 rounded-full blur-3xl opacity-50 -z-10"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 w-1/2 h-1/2 bg-blue-50 rounded-full blur-3xl opacity-50 -z-10"></div>
      </section>

      {/* Problem Section: The Language Tax */}
      <section id="problem" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-16 text-center mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-6 font-display">
              The "Language Tax" on STEM
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              Zambian students face a double cognitive burden: struggling with Junior Secondary concepts while navigating a foreign language (English). This barrier locks brilliant minds out of science and math.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-2 h-full bg-slate-200 group-hover:bg-slate-400 transition-colors"></div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                  <Menu size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Before Bulela</h3>
                  <p className="text-sm text-red-500 font-bold">Standard Learning Path</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-4 bg-slate-100 rounded-full w-full opacity-50"></div>
                <div className="h-4 bg-slate-100 rounded-full w-[80%] opacity-50"></div>
                <div className="h-4 bg-slate-100 rounded-full w-[90%] opacity-50 text-[10px] flex items-center px-4 font-bold text-slate-400">"What does 'integer' mean in Bemba?"</div>
                <p className="text-slate-500 text-sm leading-relaxed pt-4 italic">
                  "I spend more time translating the textbook than actually solving the math problems."
                </p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-green-100 shadow-lg shadow-green-500/5 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-2 h-full bg-green-700"></div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-700">
                  <Globe size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">With Ba Yama</h3>
                  <p className="text-sm text-green-600 font-bold">The Bulela Advantage</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-4 bg-green-50 rounded-full w-full"></div>
                <div className="h-4 bg-green-50 rounded-full w-[85%]"></div>
                <div className="h-4 bg-green-700 rounded-full w-[95%] text-[10px] flex items-center px-4 font-bold text-white uppercase tracking-widest">Concept Unlocked: Integers (Amanamba)</div>
                <p className="text-slate-700 text-sm leading-relaxed pt-4 font-medium">
                  "Understanding concepts naturally in English, Bemba, or Nyanja makes the math click instantly."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ba Yama Section */}
      <section id="ba-yama" className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-green-100 rounded-full blur-3xl opacity-60"></div>
              <div className="relative z-10 bg-slate-900 rounded-[3rem] p-2 shadow-2xl">
                <div className="bg-slate-800 rounded-[2.8rem] overflow-hidden">
                  {/* Phone Mockup Content */}
                  <div className="bg-slate-900 pt-12 pb-4 px-6 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center text-white scale-90">B</div>
                      <span className="font-bold text-white">Ba Yama AI</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                      <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                      <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                    </div>
                  </div>
                  <div className="h-[400px] overflow-y-auto p-6 space-y-4 bg-slate-900 scrollbar-hide">
                    <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700">
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Mwauka bwanji, Ba Taona! Integers are like managing your village harvest—if you owe someone baskets of maize, that's a negative number. This is "Kwaliwa" (Debt).
                      </p>
                    </div>
                    <div className="bg-green-700 p-4 rounded-2xl rounded-tr-none ml-auto max-w-[80%] shadow-lg">
                      <p className="text-xs text-white">Zikomo, Ba Yama! Can we try a Sets problem now?</p>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700">
                      <p className="text-xs text-slate-300 leading-relaxed mb-2">
                        Sure! Sets are like sorting items at your 'kantemba' (local shop).
                      </p>
                      <div className="bg-slate-950 p-2 rounded-lg text-[10px] text-green-400 font-mono text-center">
                        𝐴 ∪ 𝐵 = {`{𝑥 | 𝑥 ∈ 𝐴 or 𝑥 ∈ 𝐵}`}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-900">
                    <div className="bg-slate-800 rounded-full py-3 px-4 flex items-center justify-between">
                      <span className="text-xs text-slate-500">I heard you, Taona...</span>
                      <MessageCircle size={16} className="text-green-700" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
                <Globe size={14} className="fill-current" />
                AI for Good
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-8 leading-[1.1] font-display">
                AI with a Heart: <br />Meet Ba Yama.
              </h2>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-700 shrink-0">
                    <Languages size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Culturally Grounded</h3>
                    <p className="text-slate-600 leading-relaxed leading-snug">
                      Instead of generic examples, Ba Yama uses Zambian icons: nshima prices, football goals (ZESCO vs Dynamos), and village harvests to teach abstract math.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-700 shrink-0">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">English-Bemba-Nyanja Hybrid</h3>
                    <p className="text-slate-600 leading-relaxed leading-snug">
                      Toggle between languages mid-sentence. Keep the formal English math terms but use local nuances to build real intuition.
                    </p>
                  </div>
                </div>
                <SignupWrapper>
                  <button className="inline-flex items-center gap-2 text-green-700 font-bold hover:gap-3 transition-all group pt-4 cursor-pointer">
                    Chat with Ba Yama now
                    <ArrowRight size={20} />
                  </button>
                </SignupWrapper>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-4 font-display">Built for Africa's Future.</h2>
            <p className="text-slate-600 font-medium">Bulela is designed from the ground up for African student realities.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6 auto-rows-[250px]">
            {/* STEM Focus */}
            <div className="md:col-span-3 lg:col-span-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 flex flex-col justify-end group hover:border-green-300 transition-colors">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-700 mb-6 transition-transform group-hover:scale-110">
                <Brain size={24} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Sets to Algebra</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Specialized support for Junior Secondary subjects with perfect LaTeX typesetting, tailored for the Zambian Grade 8 & 9 (Form 1 & 2) curriculum.
              </p>
            </div>

            {/* Mother Tongue */}
            <div className="md:col-span-3 lg:col-span-6 bg-green-700 p-8 rounded-[2.5rem] flex flex-col justify-end text-white overflow-hidden relative">
              <div className="absolute top-8 right-8 text-green-500 opacity-20">
                <Globe size={180} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Bemba & Nyanja First</h3>
              <p className="text-green-100 text-sm leading-relaxed relative z-10">
                True natural language generation for key Zambian communities. We built a model that actually understands "Zamblish."
              </p>
            </div>

            {/* Accessibility */}
            <div className="md:col-span-3 lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-200 flex flex-col justify-end relative overflow-hidden group hover:border-green-300 transition-colors">
              <div className="absolute top-8 right-8 text-green-500/10 transition-transform group-hover:rotate-12">
                <Zap size={120} />
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-700 mb-6">
                <Zap size={24} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Low Bandwidth Optimized</h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
                Designed for accessibility in the Copperbelt and rural Zambia. Lightweight text-first interactions that work on weak 3G signals.
              </p>
            </div>

            {/* Privacy */}
            <div className="md:col-span-3 lg:col-span-4 bg-slate-900 p-8 rounded-[2.5rem] flex flex-col justify-end group">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-green-400 mb-6 group-hover:bg-slate-700 transition-colors">
                <Lock size={24} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Privacy Core</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Leveraging local Gemma 4 models via Ollama for maximum data privacy and local execution.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust/Impact Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
              Impact Goal
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4 font-display">A Solution for Global SDG 4</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Bulela is ensuring inclusive and equitable quality education by removing language barriers in the STEM pipeline.
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40 grayscale">
            {/* Mock Partner Logos */}
            <div className="text-xl font-black tracking-tighter text-slate-900">GOOGLE</div>
            <div className="text-xl font-black tracking-tighter text-slate-900">MTN ZAMBIA</div>
            <div className="text-xl font-black tracking-tighter text-slate-900">ZICTA</div>
            <div className="text-xl font-black tracking-tighter text-slate-900">UNESCO</div>
            <div className="text-xl font-black tracking-tighter text-slate-900">MINISTRY OF EDU</div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-green-700 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-600 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl lg:text-6xl font-bold text-white mb-8 font-display">
            The future of Zambia <br />is bi-lingual.
          </h2>
          <p className="text-green-100 text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
            Join the students breaking free from the Language Tax. Start mastering STEM with Ba Yama today.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <SignupWrapper>
              <button className="px-10 py-5 bg-white text-green-700 rounded-2xl font-bold text-xl hover:bg-slate-50 transition-all shadow-2xl cursor-pointer">
                Start Learning Free
              </button>
            </SignupWrapper>
            <LoginWrapper>
              <button className="px-10 py-5 bg-green-800 text-white rounded-2xl font-bold text-xl hover:bg-green-900 transition-all cursor-pointer">
                Sign into Account
              </button>
            </LoginWrapper>
          </div>
          <p className="mt-8 text-green-300 text-sm font-medium">Free forever for Grade 8 & 9 (Form 1 & 2) students - Bulela Core Initiative</p>
        </div>
      </section>

      {/* Minimalist Footer */}
      <footer className="py-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-700 rounded flex items-center justify-center text-white text-sm font-bold">B</div>
              <span className="font-bold text-slate-900">Bulela</span>
              <span className="text-slate-400 text-xs lowercase">/ copperbelt lab</span>
            </div>
            <div className="flex gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <a href="#" className="hover:text-green-700 transition-colors">Privacy</a>
              <a href="#" className="hover:text-green-700 transition-colors">Terms</a>
              <a href="#" className="hover:text-green-700 transition-colors">SDG Impact</a>
              <a href="mailto:hello@bulela.education" className="hover:text-green-700 transition-colors">Contact</a>
            </div>
            <div className="text-xs text-slate-400 font-medium">
              © 2026 Bulela EdTech. Built with Gemma 4 for Global Good.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
