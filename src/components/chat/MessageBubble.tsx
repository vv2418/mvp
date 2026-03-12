import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface MessageBubbleProps {
  senderName: string;
  content: string;
  isMe: boolean;
  isAI: boolean;
  timestamp: string;
  index: number;
}

/** Render message content with @mentions highlighted */
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

const MessageBubble = ({ senderName, content, isMe, isAI, timestamp, index }: MessageBubbleProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3 }}
      className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}
    >
      {!isMe && (
        <div className="flex-shrink-0 pt-5">
          {isAI ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
          ) : (
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${senderName}`}
              alt={senderName}
              className="h-8 w-8 rounded-full bg-secondary"
            />
          )}
        </div>
      )}
      <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
        {!isMe && (
          <span className={`mb-1 block text-[11px] font-medium ${isAI ? "text-accent" : "text-muted-foreground"}`}>
            {senderName}
          </span>
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isMe
              ? "bg-foreground text-primary-foreground rounded-br-md"
              : isAI
              ? "bg-accent/8 text-foreground border border-accent/15 rounded-bl-md"
              : "bg-card border border-border text-foreground rounded-bl-md"
          }`}
        >
          {renderContent(content)}
        </div>
        <span className="mt-1.5 block text-[10px] text-muted-foreground">{timestamp}</span>
      </div>
    </motion.div>
  );
};

export default MessageBubble;
