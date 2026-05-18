import { createContext, useContext, type ReactNode } from 'react';

interface ChatActionsValue {
  // Вызывается из кода-блока в Bubble. Шлёт «разбери эту команду/конфиг…».
  onExplainCode: (code: string) => void;
}

const ChatActionsContext = createContext<ChatActionsValue | null>(null);

export function ChatActionsProvider({
  value,
  children,
}: {
  value: ChatActionsValue;
  children: ReactNode;
}) {
  return <ChatActionsContext.Provider value={value}>{children}</ChatActionsContext.Provider>;
}

export function useChatActions(): ChatActionsValue | null {
  return useContext(ChatActionsContext);
}
