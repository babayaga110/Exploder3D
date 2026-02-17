import React, { useState, useRef } from 'react';
import { Play, Pause, Layers, Maximize, Box, Disc, Link, Upload, ZoomIn, Palette, Expand, ChevronsUp, RefreshCcw, MoveVertical, MoveHorizontal, MoveDiagonal, ArrowRightLeft, ArrowUpFromLine } from 'lucide-react';
import { ExplosionMode } from '../services/SceneManager';

interface ControlPanelProps {
  value: number;
  isPlaying: boolean;
  scale: number;
  pivotYPercent: number;
  backgroundColor: string;
  currentModel: string;
  explosionMode: ExplosionMode;
  onModelChange: (model: string) => void;
  onBackgroundColorChange: (color: string) => void;
  onExplosionModeChange: (mode: ExplosionMode) => void;
  onPivotYChange: (val: number) => void;
  onChange: (val: number) => void;
  onScaleChange: (val: number) => void;
  onToggleAnimate: () => void;
  onResetPositions: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  value,
  isPlaying, 
  scale,
  pivotYPercent,
  backgroundColor,
  currentModel,
  explosionMode,
  onModelChange,
  onBackgroundColorChange,
  onExplosionModeChange,
  onPivotYChange,
  onChange,
  onScaleChange,
  onToggleAnimate,
  onResetPositions
}) => {
  const explosionPercent = (value / 5) * 100;
  const scalePercent = ((scale - 0.2) / (3.0 - 0.2)) * 100;
  // Pivot usually -2 to 2 relative to model height? Mapped to 0-100 on slider
  const pivotPercent = ((pivotYPercent + 2) / 4) * 100; 

  const [customUrl, setCustomUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      onModelChange(customUrl.trim());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onModelChange(url);
      setShowUrlInput(false);
      e.target.value = '';
    }
  };
  
  const presetColors = [
    { name: 'Dark', value: '#111111' },
    { name: 'Slate', value: '#1e293b' },
    { name: 'Violet', value: '#2e1065' },
    { name: 'Light', value: '#e5e5e5' },
  ];
  
  // Define modes for the UI
  const modes: { id: ExplosionMode, label: string, icon: React.ReactNode }[] = [
    { id: 'radial', label: 'Radial', icon: <Expand className="w-4 h-4" /> },
    { id: 'horizontal', label: 'Plane', icon: <MoveHorizontal className="w-4 h-4" /> },
    { id: 'vertical', label: 'Height', icon: <MoveVertical className="w-4 h-4" /> },
    { id: 'lateral', label: 'Width', icon: <ArrowRightLeft className="w-4 h-4" /> },
    { id: 'depth', label: 'Depth', icon: <MoveDiagonal className="w-4 h-4" /> },
  ];
  
  return (
    <div className="flex flex-col gap-6">
      
      {/* Model Selection */}
      <div className="flex flex-wrap gap-2 pb-4 border-b border-white/10">
        <button
          onClick={() => { onModelChange('cube'); setShowUrlInput(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            currentModel === 'cube' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          <Box className="w-4 h-4" /> Cube
        </button>
        <button
          onClick={() => { onModelChange('sphere'); setShowUrlInput(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            currentModel === 'sphere' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          <Disc className="w-4 h-4" /> Sphere
        </button>
        <button
          onClick={() => setShowUrlInput(!showUrlInput)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            showUrlInput || (currentModel.startsWith('http') && !currentModel.includes('blob:')) ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          <Link className="w-4 h-4" /> URL
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            currentModel.startsWith('blob:') ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
          }`}
        >
          <Upload className="w-4 h-4" /> Upload
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept=".glb,.gltf" 
          className="hidden" 
        />
      </div>

      {/* URL Input Form */}
      {showUrlInput && (
        <form onSubmit={handleUrlSubmit} className="flex gap-2 animate-fade-in-up">
           <input 
             type="text" 
             placeholder="https://.../model.glb"
             value={customUrl}
             onChange={(e) => setCustomUrl(e.target.value)}
             className="flex-1 bg-black/50 border border-white/20 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
           />
           <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-xs font-bold uppercase">
             Load
           </button>
        </form>
      )}

      {/* Mode & Background Group */}
      <div className="flex flex-col gap-4">
        {/* Explosion Mode Selection */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-medium text-cyan-300 uppercase tracking-widest">
            <span className="flex items-center gap-1"><Expand className="w-3 h-3" /> Explosion Direction</span>
          </div>
          <div className="flex flex-wrap gap-1 p-1 bg-black/40 rounded-lg border border-white/10">
            {modes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => onExplosionModeChange(mode.id)}
                title={mode.label}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md text-[10px] font-medium transition-all ${
                  explosionMode === mode.id 
                    ? 'bg-cyan-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {mode.icon}
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background Selection */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-medium text-cyan-300 uppercase tracking-widest">
            <span className="flex items-center gap-1"><Palette className="w-3 h-3" /> Background</span>
          </div>
          <div className="flex gap-2 items-center">
            {presetColors.map((c) => (
              <button
                key={c.value}
                onClick={() => onBackgroundColorChange(c.value)}
                className={`w-8 h-8 rounded-full border-2 transition-all shadow-md ${
                  backgroundColor === c.value ? 'border-cyan-400 scale-110' : 'border-white/20 hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
            <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-white/20 hover:border-cyan-400 transition-all cursor-pointer">
              <input 
                type="color" 
                value={backgroundColor}
                onChange={(e) => onBackgroundColorChange(e.target.value)}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 cursor-pointer border-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scale & Pivot Group */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scale */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-medium text-cyan-300 uppercase tracking-widest">
            <span className="flex items-center gap-1"><ZoomIn className="w-3 h-3" /> Size</span>
            <span className="text-white/70 font-mono">{scale.toFixed(2)}x</span>
          </div>
          <div className="relative w-full h-6 flex items-center group">
              <div className="absolute w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-600 transition-all duration-75 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, scalePercent))}%` }}
                />
              </div>
              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={scale}
                onChange={(e) => onScaleChange(parseFloat(e.target.value))}
                className="absolute w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div 
                className="absolute w-4 h-4 bg-white rounded-full shadow-lg border border-cyan-600 pointer-events-none transition-all duration-75 ease-out"
                style={{ left: `calc(${Math.max(0, Math.min(100, scalePercent))}% - 8px)` }}
              />
          </div>
        </div>

        {/* Pivot Offset Y */}
        <div className="flex flex-col gap-2">
           <div className="flex justify-between items-center text-xs font-medium text-cyan-300 uppercase tracking-widest">
             <span className="flex items-center gap-1"><ChevronsUp className="w-3 h-3" /> Pivot Center</span>
             <span className="text-white/70 font-mono">{pivotYPercent.toFixed(1)}</span>
           </div>
           <div className="relative w-full h-6 flex items-center group">
               <div className="absolute w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-600 transition-all duration-75 ease-out"
                    style={{ width: `${Math.max(0, Math.min(100, pivotPercent))}%` }}
                  />
               </div>
               {/* Center marker */}
               <div className="absolute w-0.5 h-3 bg-white/50 left-1/2 top-1.5 pointer-events-none" />
               
               <input
                 type="range"
                 min="-2"
                 max="2"
                 step="0.1"
                 value={pivotYPercent}
                 onChange={(e) => onPivotYChange(parseFloat(e.target.value))}
                 className="absolute w-full h-full opacity-0 cursor-pointer z-10"
               />
               <div 
                 className="absolute w-4 h-4 bg-white rounded-full shadow-lg border border-purple-600 pointer-events-none transition-all duration-75 ease-out"
                 style={{ left: `calc(${Math.max(0, Math.min(100, pivotPercent))}% - 8px)` }}
               />
           </div>
        </div>
      </div>

      {/* Explosion Controls */}
      <div className="flex flex-col md:flex-row items-center gap-6 pt-2 border-t border-white/10">
        <button 
          onClick={onToggleAnimate}
          className="flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] active:scale-95 flex-shrink-0"
          title={isPlaying ? "Pause Animation" : "Play Animation"}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
        </button>

        <div className="flex-1 w-full flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-medium text-cyan-300 uppercase tracking-widest">
            <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> Assembly</span>
            <span className="flex items-center gap-1"><Maximize className="w-3 h-3" /> Exploded</span>
          </div>
          
          <div className="relative w-full h-6 flex items-center group">
            <div className="absolute w-full h-2 bg-gray-700 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-75 ease-out"
                 style={{ width: `${explosionPercent}%` }}
               />
            </div>
            
            <input
              type="range"
              min="0"
              max="5"
              step="0.01"
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className="absolute w-full h-full opacity-0 cursor-pointer z-10"
            />
            
            <div 
              className="absolute w-6 h-6 bg-white rounded-full shadow-lg border-2 border-cyan-500 pointer-events-none transition-all duration-75 ease-out flex items-center justify-center"
              style={{ left: `calc(${explosionPercent}% - 12px)` }}
            >
              <div className="w-2 h-2 bg-cyan-500 rounded-full" />
            </div>
          </div>
        </div>

        <button 
          onClick={onResetPositions}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all flex-shrink-0"
          title="Reset Positions"
        >
          <RefreshCcw className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] uppercase">Reset</span>
        </button>
        
        <div className="text-right min-w-[60px]">
          <div className="text-2xl font-mono text-white font-bold">{value.toFixed(1)}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Factor</div>
        </div>
      </div>
    </div>
  );
};