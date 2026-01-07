"use client";

import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockFeedback } from "@/lib/mock-data";
import { Lightbulb, Bot, Send, User } from "lucide-react";

export default function FeedbackPanel() {
  // --- AI Chat Logic ---
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hi! I can help explain the feedback or history above." }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Add user message
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev, 
        { role: "ai", content: "I see. Would you like me to highlight that area on the image?" }
      ]);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };
  // -----------------------------

  return (
    <div className="flex-1 flex flex-col h-full bg-background" data-testid="feedback-panel">
      
      {/* Teacher Feedback Section */}
      <div className="flex-1 p-4 border-b border-border min-h-[200px]">
        <h3 className="font-semibold mb-4 flex items-center">
          <Lightbulb className="h-4 w-4 mr-2" />
          Teacher Feedback
        </h3>
        <ScrollArea className="h-32">
          <div className="space-y-3">
            {mockFeedback.map((feedback) => (
              <div 
                key={feedback.id}
                className={`p-3 rounded border-l-4 ${
                  feedback.type === "praise" 
                    ? "bg-green-50 dark:bg-green-900/20 border-green-500" 
                    : feedback.type === "suggestion"
                    ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500"
                    : "bg-red-50 dark:bg-red-900/20 border-red-500"
                }`}
                data-testid={`feedback-${feedback.id}`}
              >
                <p className={`text-sm font-medium ${
                  feedback.type === "praise" 
                    ? "text-green-800 dark:text-green-400" 
                    : feedback.type === "suggestion"
                    ? "text-yellow-800 dark:text-yellow-400"
                    : "text-red-800 dark:text-red-400"
                }`}>
                  {feedback.type === "praise" 
                    ? "Excellent!" 
                    : feedback.type === "suggestion" 
                    ? "Suggestion" 
                    : "Correction"}
                </p>
                <p className={`text-sm ${
                  feedback.type === "praise" 
                    ? "text-green-700 dark:text-green-300" 
                    : feedback.type === "suggestion"
                    ? "text-yellow-700 dark:text-yellow-300"
                    : "text-red-700 dark:text-red-300"
                }`}>
                  {feedback.message}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* AI Chat Space */}
      <div className="flex-1 flex flex-col p-4 bg-slate-50 dark:bg-slate-900/50 min-h-[250px]">
        <h3 className="font-semibold mb-2 flex items-center dark:text-slate-200">
          <Bot className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
          AI Assistant
        </h3>
        
        {/* Chat Area Container */}
        <ScrollArea className="flex-1 pr-3 mb-3 border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-950 p-2">
          <div className="space-y-3">
            {messages.map((msg, index) => (
              <div key={index} className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[90%] items-start ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  
                  {/* Avatar */}
                  <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center mt-1 ${
                    msg.role === "user" 
                      ? "bg-blue-100 dark:bg-blue-900 ml-2" 
                      : "bg-gray-100 dark:bg-slate-800 mr-2"
                  }`}>
                    {msg.role === "user" 
                      ? <User className="h-3 w-3 text-blue-600 dark:text-blue-300" /> 
                      : <Bot className="h-3 w-3 text-gray-600 dark:text-slate-400" />
                    }
                  </div>

                  {/* Message Bubble */}
                  <div className={`p-2 rounded-lg text-xs ${
                    msg.role === "user" 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about feedback..."
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

    </div>
  );
}