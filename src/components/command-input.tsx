"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";

interface CommandInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export function CommandInput({ onSubmit, isLoading }: CommandInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      onSubmit(input.trim());
      setInput("");
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  return (
    <form onSubmit={handleSubmit}>
      <div
        className={`group relative rounded-2xl border transition-all duration-300 ${
          isLoading
            ? "border-indigo-500/30 shadow-xl shadow-indigo-500/10"
            : "border-white/8 hover:border-white/14 focus-within:border-indigo-500/40 focus-within:shadow-xl focus-within:shadow-indigo-500/10"
        }`}
      >
        {/* Top gradient line */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-linear-to-r from-transparent via-indigo-500/30 to-transparent" />

        <div className="flex items-start gap-3 p-4">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all ${
              isLoading ? "bg-indigo-500/20" : "bg-indigo-500/10 group-focus-within:bg-indigo-500/20"
            }`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            ) : (
              <Sparkles className="h-4 w-4 text-indigo-400" />
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AgentNet anything… e.g. List my open GitHub issues and post a summary to Slack #general"
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none bg-transparent pt-1 text-sm leading-relaxed text-gray-100 placeholder:text-gray-600 focus:outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="border-t border-white/4 px-4 py-2 text-[11px] text-gray-700">
          <kbd className="rounded bg-white/7 px-1.5 py-0.5 text-gray-500">Enter</kbd>{" "}
          to send ·{" "}
          <kbd className="rounded bg-white/7 px-1.5 py-0.5 text-gray-500">Shift+Enter</kbd>{" "}
          for new line
        </div>
      </div>
    </form>
  );
}
