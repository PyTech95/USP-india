import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Split a heading into its sentences, each keeping its full stop ("A. B." -> ["A.", "B."]); newlines
// also start a new line when asked. (No regex look-behind: older Safari / iPhones cannot read it and
// would show a blank page.)
export const sentences = (text, newlines = false) => String(text || "").replace(/\.\s+/g, ".\u0000").replace(newlines ? /\n+/g : /$^/g, "\u0000").split("\u0000").map((t) => t.trim()).filter(Boolean);
