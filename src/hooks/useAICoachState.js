import { useState, useRef, useEffect } from "react";

const INITIAL_COACH_MESSAGE = "Hi! I'm your GTD Coach. I can see your task list and help you stay organized.\n\nAdd tasks to your **Inbox**, then hit **Process Inbox with AI** to sort them — or just ask me anything.";

function useAICoachState() {
  const [messages, setMessages] = useState([{ role: 'assistant', text: INITIAL_COACH_MESSAGE }]);
  const [chatHistory, setChatHistory] = useState([]);
  const [coachMode, setCoachMode] = useState('chat');
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [moveMenu, setMoveMenu] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const [provider, setProvider] = useState(() => localStorage.getItem('gtd_provider') || 'claude');
  const [localModel, setLocalModel] = useState(() => localStorage.getItem('gtd_local_model') || 'llama3.3:70b');
  const [availableModels, setAvailableModels] = useState([]);

  useEffect(() => { localStorage.setItem('gtd_provider', provider); }, [provider]);
  useEffect(() => { localStorage.setItem('gtd_local_model', localModel); }, [localModel]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return {
    messages, setMessages,
    chatHistory, setChatHistory,
    coachMode, setCoachMode,
    chatInput, setChatInput,
    loading, setLoading,
    moveMenu, setMoveMenu,
    pendingAction, setPendingAction,
    chatEndRef, chatInputRef,
    provider, setProvider,
    localModel, setLocalModel,
    availableModels, setAvailableModels,
  };
}


export { useAICoachState };
