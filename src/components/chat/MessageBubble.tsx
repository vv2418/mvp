import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface MessageBubbleProps {
  senderName: string;
  content: string;
  isMe: boolean;
  isAI: boolean;
  timestamp: string;
  index: number;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  avatarUrl?: string;
}

function renderContent(content: string) {
  const parts = content.split(/(@[\w\s]+?)(?=\s@|\s|$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="font-semibold text-accent">
          {part}
        </span>
      );
    }
    return part;
  });
}

const MessageBubble = ({
  senderName,
  content,
  isMe,
  isAI,
  timestamp,
  index,
  isFirstInGroup = true,
  isLastInGroup = true,
  avatarUrl,
}: MessageBubbleProps) => {
  const avatarSrc = avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${senderName}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.18), duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }}
      className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"} ${isFirstInGroup ? "mt-5" : "mt-0.5"}`}
    >
      {/* Avatar column — always reserve space so bubbles align */}
      {!isMe && (
        <div className="w-8 shrink-0 self-end pb-0.5">
          {isFirstInGroup ? (
            isAI ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/60 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
            ) : (
              <img
                src={avatarSrc}
                alt={senderName}
                className="h-8 w-8 rounded-full bg-secondary object-cover ring-1 ring-border/30"
              />
            )
          ) : null}
        </div>
      )}

      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[72%]`}>
        {/* Sender name — only on first bubble in group */}
        {!isMe && isFirstInGroup && (
          <span className={`mb-1.5 block text-[11px] font-semibold tracking-wide ${isAI ? "text-accent" : "text-muted-foreground"}`}>
            {isAI ? "Rekindled AI" : senderName}
          </span>
        )}

        {/* Bubble */}
        <div
          className={`px-4 py-2.5 text-[14px] leading-relaxed break-words ${
            isMe
              ? `bg-primary text-primary-foreground shadow-sm ${
                  isFirstInGroup && isLastInGroup
                    ? "rounded-2xl rounded-br-[6px]"
                    : isFirstInGroup
                    ? "rounded-2xl rounded-br-[6px] rounded-b-2xl"
                    : isLastInGroup
                    ? "rounded-2xl rounded-tr-[6px]"
                    : "rounded-2xl rounded-r-[6px]"
                }`
              : isAI
              ? `bg-gradient-to-br from-accent/[0.09] to-accent/[0.04] text-foreground border border-accent/20 shadow-sm ${
                  isFirstInGroup && isLastInGroup
                    ? "rounded-2xl rounded-bl-[6px]"
                    : isFirstInGroup
                    ? "rounded-2xl rounded-bl-[6px]"
                    : isLastInGroup
                    ? "rounded-2xl rounded-tl-[6px]"
                    : "rounded-2xl rounded-l-[6px]"
                }`
              : `bg-card text-foreground border border-border/60 shadow-[0_1px_4px_rgba(0,0,0,0.06)] ${
                  isFirstInGroup && isLastInGroup
                    ? "rounded-2xl rounded-bl-[6px]"
                    : isFirstInGroup
                    ? "rounded-2xl rounded-bl-[6px]"
                    : isLastInGroup
                    ? "rounded-2xl rounded-tl-[6px]"
                    : "rounded-2xl rounded-l-[6px]"
                }`
          }`}
        >
          {renderContent(content)}
        </div>

        {/* Timestamp — only on last bubble in group */}
        {isLastInGroup && (
          <span className="mt-1 block text-[10px] text-muted-foreground/70 tabular-nums">
            {timestamp}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default MessageBubble;
