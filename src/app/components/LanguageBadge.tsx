import { motion } from 'motion/react';
import { LanguageInfo } from '../utils/languages';
import { LANGUAGE_BADGE_ANIMATION } from '../hooks/useLanguageCycling';

interface LanguageBadgeProps {
  language: LanguageInfo;
}

const ANIMATION_CONFIG = {
  initial: { opacity: 0, scale: 0.9, y: -10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9, y: 10 },
  transition: { 
    duration: LANGUAGE_BADGE_ANIMATION.duration,
    ease: [0.4, 0, 0.2, 1] as const
  }
};

export function LanguageBadge({ language }: LanguageBadgeProps) {
  return (
    <motion.div
      key={language.value}
      {...ANIMATION_CONFIG}
      className="flex items-center gap-2.5 px-4 py-2.5 bg-white rounded-full shadow-sm border border-gray-200"
    >
      <span 
        className="text-2xl flex items-center justify-center" 
        style={{ lineHeight: 1 }}
      >
        {language.flag}
      </span>
      <span 
        className="text-sm font-medium text-gray-700 flex items-center" 
        style={{ lineHeight: 1 }}
      >
        {language.label}
      </span>
    </motion.div>
  );
}
