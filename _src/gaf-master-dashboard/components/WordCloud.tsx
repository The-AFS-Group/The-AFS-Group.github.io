
import React, { useMemo } from 'react';
import { GAF_COLORS } from '../constants';
import { CallData } from '../types';

interface WordCloudProps {
  data: CallData[];
}

const STOP_WORDS = new Set([
  "the", "and", "a", "an", "to", "of", "in", "for", "is", "on", "that", "it", "with", "as", "are", "at", "be", "this", "have", "from", "or", "one", "had", "by", "word", "but", "not", "what", "all", "were", "we", "when", "your", "can", "said", "there", "use", "each", "which", "she", "do", "how", "their", "if", "will", "up", "other", "about", "out", "many", "then", "them", "these", "so", "some", "her", "would", "make", "like", "him", "into", "time", "has", "look", "two", "more", "write", "go", "see", "number", "no", "way", "could", "people", "my", "than", "first", "water", "been", "call", "who", "oil", "its", "now", "find", "gym", "fitness", "equipment", "home", "looking", "want", "need", "get", "set", "setup", "install", "interested", "customer", "agent", "know", "just", "think", "really", "because", "machine"
]);

export const WordCloud: React.FC<WordCloudProps> = ({ data }) => {
  const words = useMemo(() => {
    const counts: Record<string, number> = {};

    data.forEach(row => {
      // Combine relevant text fields for a "Voice of Customer" view
      const text = [
        row.job,
        ...(row.products || []),
        ...(row.competitor || []),
        row.barrier_primary, 
        row.motivation_primary
      ].filter(Boolean).join(" ");

      // Tokenize: find words with 3+ letters
      const tokens = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];

      tokens.forEach(token => {
        if (!STOP_WORDS.has(token)) {
          counts[token] = (counts[token] || 0) + 1;
        }
      });
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40) // Top 40 words
      .map(([text, value]) => ({ text, value }));
  }, [data]);

  const maxVal = words[0]?.value || 1;

  if (words.length === 0) return <div className="text-center text-sm text-gray-500 py-4">No enough data for word cloud</div>;

  return (
    <div className="flex flex-wrap justify-center content-center gap-x-4 gap-y-2 p-4 min-h-[200px]">
      {words.map((w) => {
        // Calculate size relative to max frequency
        const size = Math.max(0.8, Math.min(2.5, 0.8 + (w.value / maxVal) * 1.7));
        const opacity = Math.max(0.5, Math.min(1, 0.5 + (w.value / maxVal) * 0.5));
        
        return (
          <span
            key={w.text}
            style={{
              fontSize: `${size}rem`,
              opacity,
              color: w.value > maxVal * 0.7 ? GAF_COLORS.orange : GAF_COLORS.darkGrey,
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: w.value > maxVal * 0.5 ? 700 : 400,
              cursor: 'default'
            }}
            className="transition-colors hover:text-black"
            title={`${w.value} occurrences`}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
