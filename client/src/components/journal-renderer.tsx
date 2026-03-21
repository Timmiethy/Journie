import { motion } from 'framer-motion';
import ReactMarkdown, { type Components } from 'react-markdown';
import { fadeTransition, spring } from '../lib/motion';
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

const SKELETON_BLOCKS = [112, 88, 104, 92, 124];

type JournalRendererProps = {
  status: JournalEntry['status'];
  content: string;
  photos: string[];
  onPhotoClick: (url: string) => void;
};

export function JournalRenderer({
  status,
  content,
  photos,
  onPhotoClick,
}: JournalRendererProps) {
  if (status === 'generating') {
    return (
      <div className="relative px-6 pt-6 pb-[15vh]">
        <div className="mb-6 rounded-[24px] border border-abyss-700/75 bg-abyss-900/72 px-5 py-5">
          <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-film-500">
            generating
          </p>
          <p className="mt-2 font-serif text-xl text-film-900">
            We&apos;re shaping today&apos;s journal from your timeline.
          </p>
          <p className="mt-2 font-sans text-sm leading-6 text-film-700">
            You can stay here. The draft appears as soon as the backend finishes.
          </p>
        </div>
        <div className="space-y-4">
          {SKELETON_BLOCKS.map((height, index) => (
            <div
              key={height}
              className="relative overflow-hidden rounded-[22px] border border-abyss-700/70 bg-abyss-800/78"
              data-journal-skeleton="true"
              style={{ height }}
            >
              <motion.div
                aria-hidden="true"
                className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-film-900/10 to-transparent"
                animate={{ x: ['-20%', '220%'] }}
                transition={{
                  duration: 1.2 + index * 0.08,
                  repeat: Infinity,
                  repeatDelay: 0.1,
                }}
              />
            </div>
          ))}
        </div>
        <BottomFade />
      </div>
    );
  }

  const blocks = content.split(/\n\n+/).filter(Boolean);
  const blockComponents = createMarkdownComponents(false);
  const outroComponents = createMarkdownComponents(true);

  // Distribute photos evenly across text blocks, each photo shown at most once.
  // Skip the first and last blocks so photos appear between paragraphs.
  const photoSlots = distributePhotos(blocks.length, photos.length);

  return (
    <div className="relative pb-[15vh]">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
      >
        {blocks.map((block, index) => {
          const photoIdx = photoSlots.get(index) ?? -1;
          const isLast = index === blocks.length - 1;

          return (
            <div key={`${index}-${block.slice(0, 24)}`}>
              {photoIdx >= 0 ? (
                <motion.button
                  type="button"
                  variants={itemVariants}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onPhotoClick(photos[photoIdx])}
                  className="block w-full"
                >
                  <img
                    src={photos[photoIdx]}
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

        {photos.length > 0 && photoSlots.size === 0 ? (
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

/**
 * Map each photo to a unique block index, spaced evenly between paragraphs.
 * Returns Map<blockIndex, photoIndex>. Skips first and last blocks.
 */
function distributePhotos(blockCount: number, photoCount: number): Map<number, number> {
  const slots = new Map<number, number>();
  if (photoCount === 0 || blockCount <= 2) return slots;

  // Eligible positions: blocks 1 through blockCount-2 (skip first and last)
  const eligible = blockCount - 2;
  const toPlace = Math.min(photoCount, eligible);
  const step = eligible / toPlace;

  for (let i = 0; i < toPlace; i++) {
    const blockIdx = 1 + Math.round(step * i + step / 2);
    const clamped = Math.min(blockIdx, blockCount - 2);
    if (!slots.has(clamped)) {
      slots.set(clamped, i);
    }
  }

  return slots;
}

function BottomFade() {
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[15vh] bg-gradient-to-t from-abyss-900 to-transparent" />
  );
}
