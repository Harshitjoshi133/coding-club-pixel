declare module 'confetti-js' {
    interface ConfettiSettings {
      target?: string | HTMLCanvasElement;  // Updated to accept both types
      max?: number;
      size?: number;
      animate?: boolean;
      respawn?: boolean;
      props?: Array<{ type: string }>;
      colors?: string[];
      clock?: number;
      interval?: number;
      rotate?: boolean;
      start_from_edge?: boolean;
      width?: number;
      height?: number;
    }
  
    interface ConfettiInstance {
      render: () => void;
      clear: () => void;
    }
  
    interface ConfettiGlobal {
      (settings?: ConfettiSettings): ConfettiInstance;
    }
  
    const confetti: ConfettiGlobal;
    export default confetti;
  }