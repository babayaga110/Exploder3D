import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { SceneManager, ExplosionMode } from '../services/SceneManager';

interface Viewer3DProps {
  modelUrl: string | null;
  backgroundColor: string;
  explosionMode: ExplosionMode;
  pivotYPercent: number;
  onLoadingStart: () => void;
  onLoadComplete: () => void;
  onHover: (partName: string | null) => void;
  onExplosionUpdate: (val: number) => void;
}

export interface ViewerHandle {
  setExplosion: (val: number) => void;
  setExplosionMode: (mode: ExplosionMode) => void;
  setPivotOffsetY: (percent: number) => void;
  setModelScale: (val: number) => void;
  setAutoAnimate: (active: boolean) => void;
  resetPartPositions: () => void;
}

export const Viewer3D = forwardRef<ViewerHandle, Viewer3DProps>(({ 
  modelUrl, 
  backgroundColor, 
  explosionMode,
  pivotYPercent,
  onLoadingStart, 
  onLoadComplete, 
  onHover, 
  onExplosionUpdate 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<SceneManager | null>(null);

  useImperativeHandle(ref, () => ({
    setExplosion: (val: number) => {
      managerRef.current?.setExplosionFactor(val);
    },
    setExplosionMode: (mode: ExplosionMode) => {
      managerRef.current?.setExplosionMode(mode);
    },
    setPivotOffsetY: (percent: number) => {
      managerRef.current?.setPivotOffsetY(percent);
    },
    setModelScale: (val: number) => {
      managerRef.current?.setModelScale(val);
    },
    setAutoAnimate: (active: boolean) => {
      managerRef.current?.setAutoAnimate(active);
    },
    resetPartPositions: () => {
      managerRef.current?.resetPartPositions();
    }
  }));

  // Initial Setup
  useEffect(() => {
    if (!containerRef.current) return;

    const manager = new SceneManager(containerRef.current, {
      onLoad: onLoadComplete,
      onHover: onHover,
      onExplosionUpdate: onExplosionUpdate
    });
    
    managerRef.current = manager;

    manager.setBackgroundColor(backgroundColor);
    manager.setExplosionMode(explosionMode);
    manager.setPivotOffsetY(pivotYPercent);
    
    onLoadingStart();
    manager.loadModel(modelUrl);

    return () => {
      manager.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (managerRef.current) {
      onLoadingStart();
      managerRef.current.loadModel(modelUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setBackgroundColor(backgroundColor);
    }
  }, [backgroundColor]);
  
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setExplosionMode(explosionMode);
    }
  }, [explosionMode]);

  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setPivotOffsetY(pivotYPercent);
    }
  }, [pivotYPercent]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black cursor-crosshair" />
  );
});

Viewer3D.displayName = 'Viewer3D';