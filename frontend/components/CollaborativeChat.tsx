/**
 * Collaborative Chat Component
 * 
 * Real-time chat using Encore StreamInOut (bidirectional streaming).
 * 
 * Features:
 * - Send and receive messages in real-time
 * - Typing indicators (<100ms latency)
 * - User presence (online/away/offline)
 * - Message history on join
 * - Read receipts
 * - Auto-scroll to latest message
 * - Persistent WebSocket connection
 * 
 * Usage:
 * ```tsx
 * <CollaborativeChat
 *   roomId="property-123"
 *   onMessageSent={(msg) => console.log('Sent:', msg)}
 *   onMessageReceived={(msg) => console.log('Received:', msg)}
 * />
 * ```
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Send, Users, Circle } from 'lucide-react';
import { API_CONFIG } from '../src/config/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Chat message
 */
interface ChatMessage {
  id: string;
  userId: number;
  userName: string;
  text: string;
  timestamp: string;
  isMe?: boolean;
}

/**
 * User in room
 */
interface RoomUser {
  userId: number;
  userName: string;
  status: 'online' | 'away' | 'offline';
}

/**
 * Connection state
 */
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Component props
 */
export interface CollaborativeChatProps {
  /**
   * Room ID (e.g., "property-123", "org-456")
   */
  roomId: string;

  /**
   * Callback when message is sent
   */
  onMessageSent?: (message: ChatMessage) => void;

  /**
   * Callback when message is received
   */
  onMessageReceived?: (message: ChatMessage) => void;

  /**
   * Auto-scroll to latest message
   */
  autoScroll?: boolean;

  /**
   * Show online users list
   */
  showOnlineUsers?: boolean;
}

/**
 * Collaborative Chat Component
 */
export function CollaborativeChat({
  roomId,
  onMessageSent,
  onMessageReceived,
  autoScroll = true,
  showOnlineUsers = true,
}: CollaborativeChatProps) {
  const { user } = useAuth();

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<RoomUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserId = useRef<number>((user as any)?.userId || 0);
  const currentUserName = useRef<string>((user as any)?.displayName || 'Unknown User');

  /**
   * Scroll to latest message
   */
  const scrollToBottom = (): void => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  /**
   * Connect to chat stream
   */
  const connect = (): void => {
    if (wsRef.current) return; // Already connected

    setConnectionState('connecting');

    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('[CollaborativeChat][no-token]');
      setConnectionState('error');
      return;
    }

    const wsUrl = API_CONFIG.BASE_URL.replace(/^http/, 'ws') + '/v2/collaboration/chat/stream';

    console.log('[CollaborativeChat][connecting]', { roomId });

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[CollaborativeChat][connected]', { roomId });
        setConnectionState('connected');

        // Send handshake
        ws.send(
          JSON.stringify({
            roomId,
            userId: currentUserId.current,
          })
        );
      };

      ws.onmessage = (event) => {
        handleMessage(event.data);
      };

      ws.onerror = (error) => {
        console.error('[CollaborativeChat][error]', { error, roomId });
        setConnectionState('error');
      };

      ws.onclose = (event) => {
        console.log('[CollaborativeChat][closed]', {
          code: event.code,
          reason: event.reason,
          roomId,
        });
        setConnectionState('disconnected');
        wsRef.current = null;

        // Attempt reconnection after 3s
        setTimeout(() => {
          if (connectionState !== 'connected') {
            connect();
          }
        }, 3000);
      };
    } catch (err) {
      console.error('[CollaborativeChat][connect-error]', { error: err, roomId });
      setConnectionState('error');
    }
  };

  /**
   * Handle incoming message
   */
  const handleMessage = (data: string): void => {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'history': {
          // Message history on join
          const historyMessages: ChatMessage[] = message.messages.map((m: any) => ({
            ...m,
            isMe: m.userId === currentUserId.current,
          }));
          setMessages(historyMessages);
          scrollToBottom();

          console.log('[CollaborativeChat][history-loaded]', {
            count: historyMessages.length,
            roomId,
          });
          break;
        }

        case 'chat': {
          // New message
          const chatMessage: ChatMessage = {
            id: message.id,
            userId: message.userId,
            userName: message.userName,
            text: message.text,
            timestamp: message.timestamp,
            isMe: message.userId === currentUserId.current,
          };

          setMessages((prev) => [...prev, chatMessage]);
          scrollToBottom();

          // Callback
          if (chatMessage.isMe && onMessageSent) {
            onMessageSent(chatMessage);
          } else if (!chatMessage.isMe && onMessageReceived) {
            onMessageReceived(chatMessage);
          }

          console.log('[CollaborativeChat][message-received]', {
            messageId: chatMessage.id,
            from: chatMessage.userName,
            roomId,
          });
          break;
        }

        case 'typing': {
          // Typing indicator
          if (message.userId !== currentUserId.current) {
            setTypingUsers((prev) => new Set(prev).add(message.userId));

            // Clear typing indicator after 3s
            setTimeout(() => {
              setTypingUsers((prev) => {
                const next = new Set(prev);
                next.delete(message.userId);
                return next;
              });
            }, 3000);
          }
          break;
        }

        case 'presence': {
          // User presence update
          setOnlineUsers((prev) => {
            const existing = prev.find((u) => u.userId === message.userId);
            if (existing) {
              return prev.map((u) =>
                u.userId === message.userId ? { ...u, status: message.status } : u
              );
            } else {
              return [
                ...prev,
                {
                  userId: message.userId,
                  userName: message.userName,
                  status: message.status,
                },
              ];
            }
          });

          console.log('[CollaborativeChat][presence-updated]', {
            userId: message.userId,
            status: message.status,
            roomId,
          });
          break;
        }

        case 'ack': {
          // Read receipt
          console.log('[CollaborativeChat][message-read]', {
            messageId: message.messageId,
            userId: message.userId,
          });
          break;
        }

        case 'error': {
          console.error('[CollaborativeChat][server-error]', {
            message: message.message,
            code: message.code,
            roomId,
          });
          break;
        }

        default:
          console.warn('[CollaborativeChat][unknown-message-type]', {
            type: message.type,
            roomId,
          });
      }
    } catch (err) {
      console.error('[CollaborativeChat][parse-error]', {
        error: err,
        data: data.slice(0, 200),
      });
    }
  };

  /**
   * Send message
   */
  const sendMessage = (): void => {
    if (!wsRef.current || !inputText.trim() || connectionState !== 'connected') {
      return;
    }

    try {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat',
          text: inputText.trim(),
          roomId,
        })
      );

      setInputText('');
      setIsTyping(false);

      console.log('[CollaborativeChat][message-sent]', { text: inputText.trim(), roomId });
    } catch (err) {
      console.error('[CollaborativeChat][send-error]', { error: err, roomId });
    }
  };

  /**
   * Send typing indicator
   */
  const sendTypingIndicator = (): void => {
    if (!wsRef.current || connectionState !== 'connected') return;

    // Debounce typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!isTyping) {
      setIsTyping(true);
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'typing',
            roomId,
          })
        );
      } catch (err) {
        console.error('[CollaborativeChat][typing-error]', { error: err });
      }
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  /**
   * Handle input change
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setInputText(e.target.value);
    sendTypingIndicator();
  };

  /**
   * Handle Enter key
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /**
   * Format timestamp
   */
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Get user initials
   */
  const getUserInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  /**
   * Connect on mount
   */
  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [roomId]);

  /**
   * Auto-scroll on new messages
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <Card className="border-l-4 border-l-purple-500 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Circle
              className={`h-3 w-3 ${
                connectionState === 'connected'
                  ? 'text-green-500 fill-green-500'
                  : connectionState === 'connecting'
                  ? 'text-yellow-500 fill-yellow-500'
                  : 'text-red-500 fill-red-500'
              }`}
            />
            Room Chat
          </CardTitle>
          {showOnlineUsers && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {onlineUsers.filter((u) => u.status === 'online').length} online
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${message.isMe ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                    {getUserInitials(message.userName)}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex-1 ${message.isMe ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-700">{message.userName}</span>
                    <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
                  </div>
                  <div
                    className={`inline-block px-3 py-2 rounded-lg text-sm ${
                      message.isMe
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-900 rounded-bl-none'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicators */}
            {typingUsers.size > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="flex gap-1">
                  <span className="animate-bounce">●</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>
                    ●
                  </span>
                  <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>
                    ●
                  </span>
                </div>
                <span>{typingUsers.size} user(s) typing...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <Input
              value={inputText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={connectionState !== 'connected'}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputText.trim() || connectionState !== 'connected'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {connectionState === 'connecting' && (
            <p className="text-xs text-gray-500 mt-2">Connecting...</p>
          )}
          {connectionState === 'error' && (
            <p className="text-xs text-red-600 mt-2">Connection error. Retrying...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default CollaborativeChat;

