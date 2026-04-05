"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

interface CommandInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export function CommandInput({ onSubmit, isLoading }: CommandInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput("");
  };

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); submit(); };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  return (
    <form onSubmit={handleSubmit}>
      <div
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-300 ${
          isLoading
            ? "border-[#00D9FF]/18 bg-[#00D9FF]/3"
            : "border-white/7 bg-white/1.5 focus-within:border-white/11 focus-within:bg-white/2.5"
        }`}
      >
        {/* Prompt symbol */}
        <div
          className="mt-0.75 shrink-0 font-mono text-[15px] leading-none transition-colors duration-300"
          style={{ color: isLoading ? "#00D9FF" : "rgba(255,255,255,0.22)" }}
        >
          {isLoading ? <Loader2 className="h-3.75 w-3.75 animate-spin" /> : "›"}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? "Executing…" : "State your intent…"}
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none bg-transparent font-mono text-[13px] leading-relaxed text-white/80 placeholder:text-white/18 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/7 bg-white/4 text-white/35 transition-all hover:border-white/14 hover:bg-white/8 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}