import { CSSProperties, ReactNode } from 'react';

interface ElectricBorderProps {
  children: ReactNode;
  color?: string;
  speed?: number;
  chaos?: number;
  thickness?: number;
  className?: string;
  style?: CSSProperties;
}

declare const ElectricBorder: React.FC<ElectricBorderProps>;
export default ElectricBorder;
