import { format, isToday, isYesterday } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export function formatTime(iso: string): string {
  return format(new Date(iso), 'h:mm a');
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      const maxDimension = 1920;
      let { width, height } = image;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context unavailable'));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error('Compression failed'));
            return;
          }

          resolve(
            new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
            }),
          );
        },
        'image/jpeg',
        0.8,
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    image.src = url;
  });
}
