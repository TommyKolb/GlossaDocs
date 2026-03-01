/**
 * Decorative Greek text element
 */

interface GreekDecorationProps {
  text: string;
  className?: string;
  position?: string;
}

export function GreekDecoration({ text, className = '', position = '' }: GreekDecorationProps) {
  return (
    <div 
      className={`font-serif select-none ${position} ${className}`}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}
