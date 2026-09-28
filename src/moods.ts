export const MOOD_GROUPS = [
  { name: "cozy", words: ["cozy", "warm", "comforting", "wholesome", "gentle"] },
  { name: "dark", words: ["dark", "bleak", "grim", "disturbing"] },
  { name: "funny", words: ["funny", "hilarious", "witty"] },
  { name: "tense", words: ["tense", "scary", "suspenseful", "creepy"] },
  { name: "sad", words: ["sad", "tragic", "heartbreaking", "melancholy"] },
  { name: "romantic", words: ["romantic"] },
  { name: "exciting", words: ["exciting", "thrilling", "adventurous"] },
] as const;

export const MOOD_WORDS = new Set<string>(MOOD_GROUPS.flatMap((group) => group.words));
