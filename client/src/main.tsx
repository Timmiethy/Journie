import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/500.css';
import '@fontsource/lora/400-italic.css';
import { LazyMotion, MotionConfig, domAnimation } from 'framer-motion';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <LazyMotion features={domAnimation}>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </LazyMotion>,
);
