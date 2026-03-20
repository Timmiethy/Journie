import { format } from 'date-fns';

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMMM d, yyyy — EEEE');
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'h:mm a');
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function todayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
