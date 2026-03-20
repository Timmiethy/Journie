interface LoadingSpinnerProps {
  label?: string;
}

export default function LoadingSpinner({ label }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-cream-200 border-t-accent-400 rounded-full animate-spin" />
      {label && (
        <p className="font-sans text-[13px] text-ink-500">{label}</p>
      )}
    </div>
  );
}
