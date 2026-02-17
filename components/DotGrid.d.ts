import { CSSProperties } from 'react';

interface DotGridProps {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  speedTrigger?: number;
  bounceDuration?: number;
  bounceAmount?: number;
  tailLength?: number;
  pointerEvents?: boolean;
  className?: string;
  style?: CSSProperties;
}

declare const DotGrid: React.FC<DotGridProps>;
export default DotGrid;
