import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { fadeTransition, spring } from '../lib/motion';
import { usePrefersReducedMotion } from '../lib/use-prefers-reduced-motion';
import type { JournalEntry } from '../types';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 18,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring,
  },
};

const GENERATING_MESSAGES = [
  'Processing film...',
  'Connecting moments...',
  'Writing the script...',
];

type JournalRendererProps = {
  status: JournalEntry['status'];
  content: string;
  photos: string[];
  onPhotoClick: (url: string) => void;
  dailyAchievement?: string | null;
  bestPhotoUrl?: string | null;
  entryType?: 'daily' | 'weekly';
};

export function JournalRenderer({
  status,
  content,
  photos,
  onPhotoClick,
  dailyAchievement,
  bestPhotoUrl,
  entryType = 'daily',
}: JournalRendererProps) {
  if (status === 'generating') {
    return <CursorJournalLoader />;
  }

  // Strip <Insights> blocks (backend-only, hidden from user)
  const cleanedContent = content
    .replace(/<Insights>[\s\S]*?<\/Insights>/g, '')
    .replace(/<daily_achievement>[\s\S]*?<\/daily_achievement>/g, '')
    .replace(/<best_photo>[\s\S]*?<\/best_photo>/g, '')
    .trim();

  const blocks = cleanedContent.split(/\n\n+/).filter(Boolean);
  const blockComponents = createMarkdownComponents(false);
  const outroComponents = createMarkdownComponents(true);

  return (
    <div className="relative pb-[15vh]">
      {/* Best Photo Hero */}
      {bestPhotoUrl ? (
        <motion.button
          type="button"
          aria-label="Open highlighted journal photo"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          whileTap={{ scale: 0.97 }}
          onClick={() => onPhotoClick(bestPhotoUrl)}
          className="block w-full mb-4"
        >
          <img
            src={bestPhotoUrl}
            alt=""
            className="w-full aspect-[16/9] object-cover rounded-b-2xl"
          />
        </motion.button>
      ) : null}

      {/* Daily Achievement Banner */}
      {dailyAchievement ? (
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="mx-6 mb-6 px-4 py-3 rounded-2xl bg-white/5 border border-white/8 text-center"
        >
          <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-film-500 mb-1">
            {entryType === 'weekly' ? 'weekly highlight' : 'greatest achievement today'}
          </p>
          <p className="font-serif text-base text-film-900 font-medium">
            {dailyAchievement}
          </p>
        </motion.div>
      ) : null}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
      >
        {blocks.map((block, index) => {
          const photoIndex = blocks.length > 0
            ? Math.floor((index / blocks.length) * photos.length)
            : 0;
          const showPhoto = index > 0 && index % 2 === 0 && photos[photoIndex];
          const isLast = index === blocks.length - 1;

          return (
            <div key={`${index}-${block.slice(0, 24)}`}>
              {showPhoto ? (
                <motion.button
                  type="button"
                  aria-label={`Open journal photo ${photoIndex + 1}`}
                  variants={itemVariants}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onPhotoClick(photos[photoIndex])}
                  className="block w-full"
                >
                  <img
                    src={photos[photoIndex]}
                    alt=""
                    className="w-full aspect-[21/9] object-cover my-6 cursor-pointer"
                  />
                </motion.button>
              ) : null}

              <div
                className={
                  isLast
                    ? 'border-t border-abyss-700 mt-4 px-6 max-w-[85%] mx-auto'
                    : 'px-6'
                }
              >
                <ReactMarkdown components={isLast ? outroComponents : blockComponents}>
                  {block}
                </ReactMarkdown>
              </div>
            </div>
          );
        })}

        {photos.length > 0 && blocks.length <= 2 ? (
          <motion.button
            type="button"
            aria-label="Open journal photo 1"
            variants={itemVariants}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPhotoClick(photos[0])}
            className="block w-full"
          >
            <img
              src={photos[0]}
              alt=""
              className="w-full aspect-[21/9] object-cover my-6 cursor-pointer"
            />
          </motion.button>
        ) : null}
      </motion.div>

      <BottomFade />
    </div>
  );
}

function CursorJournalLoader() {
  const shouldReduceMotion = usePrefersReducedMotion();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setMessageIndex(GENERATING_MESSAGES.length - 1);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % GENERATING_MESSAGES.length);
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [shouldReduceMotion]);

  return (
    <div className="flex min-h-[calc(100svh-10rem)] flex-col items-center justify-center px-6 pb-[18vh] pt-[6vh] text-center">
      <motion.div
        data-testid="journal-generating-cursor"
        aria-hidden="true"
        className="h-8 w-[2px] bg-film-900"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                opacity: [1, 1, 0.06, 0.06, 1, 1],
              }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: 1.05,
                times: [0, 0.38, 0.4, 0.72, 0.74, 1],
                repeat: Infinity,
                ease: 'linear',
              }
        }
      />

      <div
        className="mt-6 min-h-[2rem]"
        aria-live={shouldReduceMotion ? 'off' : 'polite'}
      >
        {shouldReduceMotion ? (
          <p
            data-testid="journal-generating-message"
            className="font-serif text-lg italic text-film-700"
          >
            {GENERATING_MESSAGES[GENERATING_MESSAGES.length - 1]}
          </p>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={messageIndex}
              data-testid="journal-generating-message"
              className="font-serif text-lg italic text-film-700"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            >
              {GENERATING_MESSAGES[messageIndex]}
            </motion.p>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function createMarkdownComponents(isOutro: boolean): Components {
  return {
    p: ({ children }) => (
      <motion.p
        variants={itemVariants}
        className={
          isOutro
            ? 'font-serif text-base italic text-film-700 text-center py-8'
            : 'font-serif text-lg leading-[1.85] text-film-900 mb-6 text-justify'
        }
      >
        {children}
      </motion.p>
    ),
    h1: ({ children }) => (
      <motion.h1
        variants={itemVariants}
        className="font-serif text-3xl leading-tight text-film-900 mb-6"
      >
        {children}
      </motion.h1>
    ),
    h2: ({ children }) => (
      <motion.h2
        variants={itemVariants}
        className="font-serif text-2xl leading-tight text-film-900 mb-5"
      >
        {children}
      </motion.h2>
    ),
    li: ({ children }) => (
      <motion.li
        variants={itemVariants}
        className="font-serif text-lg leading-[1.85] text-film-900"
      >
        {children}
      </motion.li>
    ),
    ul: ({ children }) => (
      <motion.ul
        variants={itemVariants}
        transition={fadeTransition}
        className="list-disc pl-6 mb-6 space-y-2"
      >
        {children}
      </motion.ul>
    ),
    ol: ({ children }) => (
      <motion.ol
        variants={itemVariants}
        transition={fadeTransition}
        className="list-decimal pl-6 mb-6 space-y-2"
      >
        {children}
      </motion.ol>
    ),
    strong: ({ children }) => <strong className="font-medium text-film-900">{children}</strong>,
    em: ({ children }) => <em className="italic text-film-700">{children}</em>,
  };
}

function BottomFade() {
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[15vh] bg-gradient-to-t from-abyss-900 to-transparent" />
  );
}
