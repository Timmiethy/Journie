import { motion } from 'framer-motion';
import ReactMarkdown, { type Components } from 'react-markdown';
import { fadeTransition, spring } from '../lib/motion';
import { useStore } from '../lib/store';
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
    return <QuillJournalLoader />;
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

function QuillJournalLoader() {
  const aura = useStore((state) => state.currentAura);
  const shouldReduceMotion = usePrefersReducedMotion();

  return (
    <div className="relative px-4 pb-[14vh] pt-5 sm:px-6 sm:pt-6">
      <div className="mx-auto max-w-[21rem] text-center">
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-film-500">
          generating
        </p>
        <p className="mt-2 font-sans text-lg font-medium leading-tight text-film-900 sm:text-xl">
          Your journal is taking shape.
        </p>
        <p className="mt-2 font-sans text-sm leading-6 text-film-700">
          We&apos;re shaping the draft around your moments and voice.
        </p>
        <div className="mt-6 overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015)_24%,rgba(5,5,5,0.08)_100%)] px-5 py-7 shadow-[0_22px_60px_rgba(0,0,0,0.24)]">
          <div
            className="mx-auto flex h-[11.5rem] max-w-[14rem] items-center justify-center rounded-[24px]"
            style={{
              background: `radial-gradient(circle at 50% 38%, ${aura}1c 0%, rgba(255,255,255,0.02) 46%, transparent 78%)`,
            }}
          >
            <motion.svg
              viewBox="0 0 140 140"
              className="w-[8.75rem]"
              role="img"
              aria-label="Journal writing animation"
              initial={shouldReduceMotion ? false : { opacity: 0.88, scale: 0.98, rotate: -4 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 0.96, scale: 1, rotate: 0 }
                  : {
                      opacity: [0.72, 1, 0.78],
                      scale: [0.97, 1.03, 0.99],
                      rotate: [-4, 1, 4, -4],
                      x: [0, 2, -2, 0],
                      y: [0, -2, 1, 0],
                    }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0.2 }
                  : {
                      duration: 3.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }
              }
            >
              <path
                d="M104 24C79 24 57 35 42 51C28 66 23 87 24 103C40 104 61 99 77 86C97 70 109 48 111 27C111 25 109 24 104 24Z"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
              <path
                d="M46 97L109 34"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeLinecap="round"
                strokeWidth="4"
              />
              <motion.path
                d="M104 24C79 24 57 35 42 51C28 66 23 87 24 103C40 104 61 99 77 86C97 70 109 48 111 27C111 25 109 24 104 24Z"
                fill="none"
                stroke={aura}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
                initial={shouldReduceMotion ? { opacity: 0.95, pathLength: 1 } : { opacity: 0.5, pathLength: 0.42 }}
                animate={
                  shouldReduceMotion
                    ? { opacity: 0.95, pathLength: 1 }
                    : {
                        opacity: [0.48, 1, 0.56],
                        pathLength: [0.42, 1, 0.52],
                      }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.2 }
                    : {
                        duration: 2.4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }
                }
              />
              <motion.path
                d="M46 97L109 34"
                fill="none"
                stroke={aura}
                strokeLinecap="round"
                strokeWidth="4"
                initial={shouldReduceMotion ? { opacity: 0.92, pathLength: 1 } : { opacity: 0.42, pathLength: 0.28 }}
                animate={
                  shouldReduceMotion
                    ? { opacity: 0.92, pathLength: 1 }
                    : {
                        opacity: [0.4, 0.92, 0.48],
                        pathLength: [0.28, 1, 0.36],
                      }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.2 }
                    : {
                        duration: 2.4,
                        delay: 0.15,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }
                }
              />
              <motion.path
                d="M58 79C68 69 77 57 87 43"
                fill="none"
                stroke={aura}
                strokeLinecap="round"
                strokeWidth="3"
                initial={shouldReduceMotion ? { opacity: 0.78, pathLength: 1 } : { opacity: 0.22, pathLength: 0.12 }}
                animate={
                  shouldReduceMotion
                    ? { opacity: 0.78, pathLength: 1 }
                    : {
                        opacity: [0.18, 0.62, 0.22],
                        pathLength: [0.12, 1, 0.24],
                      }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.2 }
                    : {
                        duration: 2.4,
                        delay: 0.28,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }
                }
              />
            </motion.svg>
          </div>

          <p className="mt-3 font-sans text-xs uppercase tracking-[0.22em] text-film-500">
            tuning voice and sequence
          </p>
        </div>
      </div>
      <BottomFade />
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
