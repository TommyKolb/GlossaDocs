/**
 * Reusable loading spinner component
 */

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export function LoadingSpinner({ message = 'Loading...', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center h-screen ${className}`}>
      <div className="text-gray-500">{message}</div>
    </div>
  );
}
