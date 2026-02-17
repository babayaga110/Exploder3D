import React, { useState, useRef, useEffect } from 'react';
import { Viewer3D, ViewerHandle } from './components/Viewer3D';
import { ControlPanel } from './components/ControlPanel';
import { Loader2, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import { ExplosionMode } from './services/SceneManager';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [explosionFactor, setExplosionFactor] = useState(0);
  const [scale, setScale] = useState(1);
  const [pivotYPercent, setPivotYPercent] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState('#111111');
  const [explosionMode, setExplosionMode] = useState<ExplosionMode>('radial');
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('cube');
  const [isMenuMinimized, setIsMenuMinimized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // This ref allows us to call methods on the Three.js manager from React
  const viewerRef = useRef<ViewerHandle | null>(null);

  const handleExplosionChange = (value: number) => {
    if (isPlaying) {
       setIsPlaying(false);
       viewerRef.current?.setAutoAnimate(false);
    }
    setExplosionFactor(value);
    viewerRef.current?.setExplosion(value);
  };

  const handleScaleChange = (value: number) => {
    setScale(value);
    viewerRef.current?.setModelScale(value);
  };

  const handleExplosionModeChange = (mode: ExplosionMode) => {
    setExplosionMode(mode);
    viewerRef.current?.setExplosionMode(mode);
  };

  const handlePivotYChange = (percent: number) => {
    setPivotYPercent(percent);
    viewerRef.current?.setPivotOffsetY(percent);
  };

  const handleAutoAnimate = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    viewerRef.current?.setAutoAnimate(newState);
  };

  const handleResetPositions = () => {
    viewerRef.current?.resetPartPositions();
  };

  const handleModelChange = (model: string) => {
    if (model === currentModel) return;
    
    // Revoke previous object URL if it exists to avoid memory leaks
    if (currentModel.startsWith('blob:')) {
      URL.revokeObjectURL(currentModel);
    }

    setCurrentModel(model);
    // Loading state will be handled by callbacks from Viewer3D
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentModel.startsWith('blob:')) {
        URL.revokeObjectURL(currentModel);
      }
    };
  }, [currentModel]);

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans" style={{ backgroundColor }}>
      {/* 3D Viewport */}
      <div className="absolute inset-0 z-0">
        <Viewer3D 
          ref={viewerRef}
          modelUrl={currentModel}
          backgroundColor={backgroundColor}
          explosionMode={explosionMode}
          pivotYPercent={pivotYPercent}
          onLoadingStart={() => setLoading(true)}
          onLoadComplete={() => setLoading(false)}
          onHover={(name) => setHoveredPart(name)}
          onExplosionUpdate={(val) => setExplosionFactor(val)} 
        />
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-500">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
          <p className="text-cyan-100 text-lg font-light tracking-wider">Loading Model...</p>
        </div>
      )}

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        {/* Header */}
        <header className="pointer-events-auto transition-opacity duration-300" style={{ opacity: isMenuMinimized ? 0.6 : 1 }}>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
            Exploder<span className="text-white font-light">3D</span>
          </h1>
          <p className={`text-gray-400 text-sm mt-1 max-w-md transition-all duration-300 ${isMenuMinimized ? 'h-0 opacity-0 overflow-hidden mt-0' : 'h-auto opacity-100'}`}>
            Interactive exploded view visualization. 
            Uses Mesh analysis to determine explosion vectors dynamically.
          </p>
        </header>

        {/* Info Label (Hover) */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
           {hoveredPart && (
             <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-white text-sm shadow-xl animate-fade-in-up">
               {hoveredPart}
             </div>
           )}
        </div>

        {/* Footer Controls */}
        <div className={`pointer-events-auto w-full max-w-2xl mx-auto transition-transform duration-500 ease-in-out ${isMenuMinimized ? 'translate-y-[calc(100%-52px)]' : 'translate-y-0'}`}>
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Toggle Bar */}
            <button 
              onClick={() => setIsMenuMinimized(!isMenuMinimized)}
              className="flex items-center justify-between w-full px-6 py-3 bg-white/5 hover:bg-white/10 transition-colors border-b border-white/5 cursor-pointer group"
            >
              <div className="flex items-center gap-2 text-cyan-400 group-hover:text-cyan-300 transition-colors">
                <Sliders className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Controls</span>
              </div>
              <div className="text-white/50 group-hover:text-white transition-colors">
                {isMenuMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {/* Control Panel Content */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isMenuMinimized ? 'max-h-0 opacity-0' : 'max-h-[800px] opacity-100'}`}>
              <div className="p-6 pt-4">
                <ControlPanel 
                  value={explosionFactor} 
                  isPlaying={isPlaying}
                  scale={scale}
                  pivotYPercent={pivotYPercent}
                  backgroundColor={backgroundColor}
                  currentModel={currentModel}
                  explosionMode={explosionMode}
                  onModelChange={handleModelChange}
                  onBackgroundColorChange={setBackgroundColor}
                  onExplosionModeChange={handleExplosionModeChange}
                  onPivotYChange={handlePivotYChange}
                  onChange={handleExplosionChange}
                  onScaleChange={handleScaleChange}
                  onToggleAnimate={handleAutoAnimate}
                  onResetPositions={handleResetPositions}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;