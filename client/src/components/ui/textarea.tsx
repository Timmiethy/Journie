import { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export default function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block font-sans text-[12px] font-medium text-ink-500 mb-1">
          {label}
        </label>
      )}
      <textarea
        className={`w-full bg-cream-100 border border-cream-200 rounded-button px-3 py-[10px] font-sans text-[14px] text-ink-900 placeholder:text-ink-500 focus:outline-none focus:border-accent-400 resize-none ${className}`}
        rows={3}
        {...props}
      />
    </div>
  );
}
