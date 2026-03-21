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
