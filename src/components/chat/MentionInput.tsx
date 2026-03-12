import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MentionOption {
  id: string;
  name: string;
  isAI?: boolean;
}

interface MentionInputProps {
  options: MentionOption[];
  onSend: (text: string) => void;
  disabled?: boolean;
}

const MentionInput = ({ options, onSend, disabled }: MentionInputProps) => {
  const [value, setValue] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [filter, setFilter] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Find @ trigger position
  const getAtInfo = (text: string, cursorPos: number) => {
    const before = text.slice(0, cursorPos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return null;
    // Only trigger if @ is at start or preceded by whitespace
    if (atIdx > 0 && before[atIdx - 1] !== " " && before[atIdx - 1] !== "\n") return null;
    const query = before.slice(atIdx + 1);
    // Don't trigger if there's a space in the query (completed mention)
    if (query.includes(" ") && query.length > 20) return null;
    return { atIdx, query };
  };

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(filter.toLowerCase())
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setValue(text);
    const cursor = e.target.selectionStart || 0;
    const info = getAtInfo(text, cursor);
    if (info) {
      setFilter(info.query);
      setShowMenu(true);
      setSelectedIdx(0);
    } else {
      setShowMenu(false);
    }
  };

  const insertMention = (option: MentionOption) => {
    const cursor = inputRef.current?.selectionStart || value.length;
    const info = getAtInfo(value, cursor);
    if (!info) return;
    const before = value.slice(0, info.atIdx);
    const after = value.slice(cursor);
    const newVal = `${before}@${option.name} ${after}`;
    setValue(newVal);
    setShowMenu(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMenu && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filtered[selectedIdx]);
        return;
      }
      if (e.key === "Escape") {
        setShowMenu(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
    setShowMenu(false);
  };

  return (
    <div className="relative w-full">
      {/* Mention dropdown */}
      <AnimatePresence>
        {showMenu && filtered.length > 0 && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-card shadow-lg z-50"
          >
            {filtered.map((opt, i) => (
              <button
                key={opt.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(opt);
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  i === selectedIdx ? "bg-accent/10 text-accent" : "text-foreground hover:bg-secondary"
                }`}
              >
                {opt.isAI ? (
                  <span className="text-base">✨</span>
                ) : (
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${opt.name}`}
                    alt=""
                    className="h-6 w-6 rounded-full bg-secondary"
                  />
                )}
                <span className="font-medium">{opt.name}</span>
                {opt.isAI && (
                  <span className="ml-auto text-[10px] text-accent font-semibold uppercase">AI</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-3">
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... Use @ to mention"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 min-h-[48px] max-h-[120px]"
          style={{ height: "48px" }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "48px";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default MentionInput;
