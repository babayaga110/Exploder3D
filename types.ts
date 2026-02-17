export interface ViewerState {
  isLoading: boolean;
  explosionValue: number; // 0 to 5
  isAutoAnimating: boolean;
  hoveredPart: string | null;
}

export interface ViewerProps {
  modelUrl?: string; // Optional URL for GLB
}
