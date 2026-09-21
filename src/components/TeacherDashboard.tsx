import React, { useState, useEffect } from 'react';
import { Users, BarChart3, Award, AlertTriangle, ArrowLeft, Download } from 'lucide-react';
import { motion } from 'motion/react';

interface TeacherStats {
  stats: {
    total_students: number;
    class_average: number;
    total_points_earned: number;
    total_modules_completed: number;
  };
  problematicTopics: {
    topic_id: string;
    avg_score: number;
    student_count: number;
  }[];
}

export default function TeacherDashboard({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<TeacherStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teacher/classroom-stats')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ y: 20, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        className="bg-white rounded-[2.5rem] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/20"
      >
        <header className="p-6 sm:p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose}
              className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Classroom Command Hub</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Teacher Dashboard / Grades 8-9</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20">
            <Download size={18} />
            Export Monthly Report
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white space-y-10">
          {isLoading ? (
            <div className="h-full flex items-center justify-center flex-col gap-4">
              <div className="w-12 h-12 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Aggregating Student Data...</p>
            </div>
          ) : data && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Active Students", value: data.stats.total_students || 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Class Average", value: `${Math.round(data.stats.class_average || 0)}%`, icon: BarChart3, color: "text-green-600", bg: "bg-green-50" },
                  { label: "Total Points", value: (data.stats.total_points_earned || 0).toLocaleString(), icon: Award, color: "text-amber-600", bg: "bg-amber-50" },
                  { label: "Modules Finished", value: data.stats.total_modules_completed || 0, icon: Check, color: "text-purple-600", bg: "bg-purple-50" }
                ].map((stat, i) => (
                  <div key={i} className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 group hover:border-slate-200 transition-all">
                    <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform`}>
                      <stat.icon size={22} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                    <p className="text-3xl font-black text-slate-900">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Problematic Topics */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-red-500" size={24} />
                  <h2 className="text-xl font-black tracking-tight">Intervention Required</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {data.problematicTopics.length > 0 ? data.problematicTopics.map((topic, i) => (
                    <div key={i} className="p-6 rounded-3xl bg-red-50/50 border border-red-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">{topic.topic_id}</p>
                        <p className="text-xs text-slate-500">{topic.student_count} students struggling</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-red-600">{Math.round(topic.avg_score)}%</p>
                        <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest">Avg Score</p>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full p-12 rounded-[2.5rem] bg-slate-50 border border-dashed border-slate-200 text-center">
                      <p className="text-slate-400 font-medium italic">No problematic topics found. Your class is excelling, Ba Teacher!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Classroom Engagement */}
              <div className="bg-slate-900 rounded-[2.5rem] p-8 sm:p-12 text-white overflow-hidden relative">
                <div className="relative z-10">
                  <h3 className="text-2xl font-black tracking-tight mb-4">Gemma 4 Good Impact</h3>
                  <p className="text-slate-400 max-w-xl text-sm leading-relaxed mb-8">
                    Bulela is bridging the digital divide in Zambia by providing world-class AI tutoring that works entirely offline during loadshedding. Your classroom is now powered by the edge.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">CO2 Saved (No Server)</p>
                      <p className="text-xl font-bold">12.4kg</p>
                    </div>
                    <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Data Costs Saved</p>
                      <p className="text-xl font-bold">K450.00</p>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

const Check = ({ size, className }: { size?: number, className?: string }) => (
    <svg 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
);
