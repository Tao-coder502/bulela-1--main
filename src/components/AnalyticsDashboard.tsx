import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import { X, TrendingUp, Zap, Target, Clock, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TopicProgress {
  topic_id: string;
  score: number;
  mastery_level: number;
  attempts: number;
  average_response_time: number;
}

interface AnalyticsData {
  summary: {
    total_interactions: number;
    avg_response_time: number;
    success_rate: number;
  };
  topicProgress: TopicProgress[];
  history: Array<{
    type: string;
    response_time: number;
    success_flag: number;
    timestamp: string;
  }>;
}

export default function AnalyticsDashboard({ userId, onClose }: { userId?: string, onClose: () => void }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analytics${userId ? `?userId=${userId}` : ''}`)
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then(d => {
        setData(d);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Analytics fetch error:", err);
        // Fallback to empty data so the dashboard still renders with empty states
        setData({ 
          summary: { total_interactions: 0, avg_response_time: 0, success_rate: 0 },
          topicProgress: [],
          history: []
        });
        setIsLoading(false);
      });
  }, [userId]);

  if (isLoading) return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-[110] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-green-700 uppercase tracking-widest">Calculating Mastery...</p>
      </div>
    </div>
  );

  if (!data) return null;

  const COLORS = ['#15803d', '#3b82f6', '#f59e0b', '#ef4444'];

  const summary = data.summary || { total_interactions: 0, avg_response_time: 0, success_rate: 0 };
  const topicProgress = data.topicProgress || [];
  const history = data.history || [];

  const radarData = topicProgress.map(tp => ({
    subject: tp.topic_id.charAt(0).toUpperCase() + tp.topic_id.slice(1),
    A: tp.score,
    fullMark: 100,
  }));

  const masteryDistribution = [
    { name: 'Basic', value: topicProgress.filter(p => p.mastery_level === 1).length },
    { name: 'Intermediate', value: topicProgress.filter(p => p.mastery_level === 2).length },
    { name: 'Advanced', value: topicProgress.filter(p => p.mastery_level === 3).length },
  ];

  return (
    <div className="fixed inset-0 bg-slate-50 z-[110] flex flex-col overflow-y-auto pb-20 font-sans uppercase">
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-12 sticky top-0 z-10 font-sans uppercase">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center text-white shadow-lg">
            <TrendingUp size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Learning Analytics</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Student Performance Report</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-3 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-all"
        >
          <X size={20} />
        </button>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6 sm:p-12">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Success Rate', value: `${Math.round(summary.success_rate || 0)}%`, icon: Target, color: 'bg-green-500' },
            { label: 'Avg Speed', value: `${(summary.avg_response_time || 0).toFixed(1)}s`, icon: Zap, color: 'bg-blue-500' },
            { label: 'Interactions', value: summary.total_interactions, icon: Clock, color: 'bg-amber-500' },
            { label: 'Mastery Level', value: `${topicProgress.length > 0 ? Math.max(0, ...topicProgress.map(p => p.mastery_level)) : 0}/3`, icon: Award, color: 'bg-purple-500' },
          ].map((card, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-6"
            >
              <div className={`w-14 h-14 ${card.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                <card.icon size={28} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
                <p className="text-2xl font-black text-slate-900">{card.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {summary.total_interactions === 0 ? (
          <div className="bg-white p-20 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-6">
              <TrendingUp size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Performance Data Yet</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto normal-case leading-relaxed">
              Complete your first lesson or take a quiz to see your learning patterns and mastery insights here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
              {/* Concept Mastery Radar */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-8 border-l-4 border-green-700 pl-4">Concept Mastery (Grade 8/9 Context)</h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                      <Radar
                        name="Score"
                        dataKey="A"
                        stroke="#15803d"
                        fill="#15803d"
                        fillOpacity={0.4}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-center text-slate-400 italic mt-4 font-medium uppercase">Tracking performance across Zambian math standards</p>
              </div>

              {/* Response Time Analysis */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-8 border-l-4 border-blue-600 pl-4">Response Time Velocity</h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...history].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelFormatter={() => "Interaction"}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="response_time" 
                        stroke="#3b82f6" 
                        strokeWidth={4} 
                        dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                        activeDot={{ r: 8, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-center text-slate-400 italic mt-4 font-medium uppercase">Measurement of cognitive load and system latency</p>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-8 border-l-4 border-amber-500 pl-4">Topic Proficiency Matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-4">Topic</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mastery</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Best Score</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Attempts</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Latency</th>
                      <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {topicProgress.map((tp, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 font-bold text-slate-900 pl-4">{tp.topic_id.charAt(0).toUpperCase() + tp.topic_id.slice(1)}</td>
                        <td className="py-4">
                          <div className="flex gap-1">
                            {[1, 2, 3].map(level => (
                              <div 
                                key={level} 
                                className={`w-4 h-2 rounded-full ${level <= tp.mastery_level ? 'bg-green-600' : 'bg-slate-100'}`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="py-4 font-mono font-bold text-slate-600">{tp.score}%</td>
                        <td className="py-4 font-medium text-slate-400">{tp.attempts || 0}</td>
                        <td className="py-4 font-medium text-slate-400">{(tp.average_response_time || 0).toFixed(1)}s</td>
                        <td className="py-4 pr-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            tp.score >= 80 ? 'bg-green-100 text-green-700' : tp.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {tp.score >= 80 ? 'Mastered' : tp.score >= 50 ? 'Developing' : 'Review Needed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}