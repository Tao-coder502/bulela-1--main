import React, { useRef, useState, useEffect } from 'react';
import { Pencil, Trash2, Check, Brain, Eraser } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MathCanvasProps {
  onRecognize: (equation: string) => void;
  onClose: () => void;
}

export default function MathCanvas({ onRecognize, onClose }: MathCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#1e293b');
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to container size
    const resize = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.beginPath();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = isEraser ? 20 : lineWidth;
    ctx.strokeStyle = isEraser ? '#f8fafc' : color;
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleRecognize = () => {
    // In a real production app, we would send the image or strokes to a Math OCR service.
    // For this demonstration, we'll ask the student to type what they wrote
    // OR we can simulate a recognition of a common Grade 9 problem.
    const mockInput = prompt("Bulela AI is analyzing your handwriting... What equation did you write? (e.g. 2x + 5 = 11)");
    if (mockInput) {
      onRecognize(mockInput);
    }
  };

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed inset-x-0 bottom-0 top-0 sm:top-20 sm:bottom-8 sm:inset-x-8 bg-white z-[120] rounded-b-none sm:rounded-[2.5rem] shadow-2xl flex flex-col border border-slate-200 overflow-hidden"
    >
      <header className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-200">
            <Pencil size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Handwriting Scratchpad</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Multi-modal Input System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 mr-4">
             <button 
              onClick={() => setIsEraser(false)}
              className={`p-2 rounded-lg transition-all ${!isEraser ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
             >
                <Pencil size={16} />
             </button>
             <button 
              onClick={() => setIsEraser(true)}
              className={`p-2 rounded-lg transition-all ${isEraser ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
             >
                <Eraser size={16} />
             </button>
          </div>
          <button 
            onClick={clearCanvas}
            className="p-3 text-slate-400 hover:text-red-600 transition-colors"
            title="Clear Canvas"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={onClose}
            className="p-3 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Check size={24} />
          </button>
        </div>
      </header>

      <div className="flex-1 bg-slate-50 relative overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full touch-none"
        />
        
        <div className="absolute top-4 left-4 sm:top-8 sm:left-8 pointer-events-none opacity-20">
            <p className="text-4xl font-display font-black text-slate-300">BA YAMA MATH SCRATCHPAD</p>
            <p className="text-sm font-bold text-slate-400 mt-2">WRITE YOUR EQUATION HERE...</p>
        </div>
      </div>

      <footer className="p-6 bg-white border-t border-slate-100 flex justify-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRecognize}
          className="bg-green-700 text-white px-12 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-xl shadow-green-200 hover:bg-green-800 transition-all hover:gap-5"
        >
          <Brain size={20} />
          AI ANALYZE HANDWRITING
        </motion.button>
      </footer>
    </motion.div>
  );
}