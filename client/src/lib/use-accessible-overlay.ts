import { RefObject, useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hidden) {
      return false;
    }

    return element.getAttribute('aria-hidden') !== 'true';
  });
}

interface UseAccessibleOverlayOptions {
  containerRef: RefObject<HTMLElement>;
  initialFocusRef?: RefObject<HTMLElement>;
  lockBodyScroll?: boolean;
  onClose: () => void;
}

export function useAccessibleOverlay(
  isOpen: boolean,
  {
    containerRef,
    initialFocusRef,
    lockBodyScroll = true,
    onClose,
  }: UseAccessibleOverlayOptions,
) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const container = containerRef.current;

    if (lockBodyScroll) {
      document.body.style.overflow = 'hidden';
    }

    const focusTarget = initialFocusRef?.current ?? getFocusableElements(container)[0] ?? container;
    window.requestAnimationFrame(() => {
      focusTarget?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements(containerRef.current);
      const fallbackTarget = containerRef.current;

      if (focusableElements.length === 0) {
        event.preventDefault();
        fallbackTarget?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (event.shiftKey) {
        if (!activeElement || activeElement === firstElement || activeElement === fallbackTarget) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (!activeElement || activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (lockBodyScroll) {
        document.body.style.overflow = previousOverflow;
      }
      previousActiveElement?.focus();
    };
  }, [containerRef, initialFocusRef, isOpen, lockBodyScroll, onClose]);
}
