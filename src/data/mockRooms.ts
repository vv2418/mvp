export interface RoomMember {
  id: string;
  name: string;
  avatar: string;
  interests: string[];
}

export interface Room {
  id: string;
  eventTitle: string;
  eventDate: string;
  members: RoomMember[];
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
}

export const MOCK_ROOMS: Room[] = [
  {
    id: "r1",
    eventTitle: "Indie Music Night",
    eventDate: "Mar 15",
    members: [
      { id: "u1", name: "Alex", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex", interests: ["Music", "Art"] },
      { id: "u2", name: "Jordan", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan", interests: ["Music", "Photography"] },
      { id: "u3", name: "Sam", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sam", interests: ["Music", "Food"] },
    ],
    lastMessage: "🤖 AI: Hey everyone! What's your favorite genre?",
    lastMessageTime: "2m ago",
    unread: 3,
  },
  {
    id: "r2",
    eventTitle: "Startup Pitch Night",
    eventDate: "Mar 18",
    members: [
      { id: "u4", name: "Taylor", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor", interests: ["Tech", "Startups"] },
      { id: "u5", name: "Morgan", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Morgan", interests: ["Networking", "Tech"] },
    ],
    lastMessage: "Taylor: Really excited for this one!",
    lastMessageTime: "15m ago",
    unread: 0,
  },
];

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  isAI?: boolean;
}

export const MOCK_CHAT: ChatMessage[] = [
  {
    id: "m1",
    senderId: "ai",
    senderName: "Rekindled AI",
    senderAvatar: "",
    content: "Welcome to the Indie Music Night room! 🎵 I'm here to help break the ice. Let's start — what's a song that's been on repeat for you lately?",
    timestamp: "5:30 PM",
    isAI: true,
  },
  {
    id: "m2",
    senderId: "u1",
    senderName: "Alex",
    senderAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    content: "I've been obsessed with Tame Impala's new single 🎶",
    timestamp: "5:31 PM",
  },
  {
    id: "m3",
    senderId: "u2",
    senderName: "Jordan",
    senderAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
    content: "Ooh great taste! I've been vibing to some Japanese city pop lately",
    timestamp: "5:32 PM",
  },
  {
    id: "m4",
    senderId: "ai",
    senderName: "Rekindled AI",
    senderAvatar: "",
    content: "Love it! Looks like we have some eclectic music fans here 🔥 Has anyone been to The Basement before?",
    timestamp: "5:33 PM",
    isAI: true,
  },
];
