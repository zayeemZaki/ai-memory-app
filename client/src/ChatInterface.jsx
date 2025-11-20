import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_KEY = import.meta.env.VITE_API_SECRET || "default-dev-secret";

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'x-api-key': API_KEY
    }
});

// Generate unique session ID
const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

function ChatInterface({ onGraphUpdate, sessionId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const [streamingMessage, setStreamingMessage] = useState(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingMessage]);

    const typewriterEffect = (text, callback) => {
        let index = 0;
        const tempMessage = {
            id: Date.now(),
            type: 'assistant',
            content: '',
            isStreaming: true
        };

        setStreamingMessage(tempMessage);

        const interval = setInterval(() => {
            if (index < text.length) {
                tempMessage.content += text[index];
                setStreamingMessage({ ...tempMessage });
                index++;
            } else {
                clearInterval(interval);
                setStreamingMessage(null);
                callback(tempMessage);
            }
        }, 20);
    };

    const [actionType, setActionType] = useState('ask_question'); // Default to ask

    const handleSend = async (overrideActionType = null) => {
        if (!input.trim() || isLoading) return;

        const selectedAction = overrideActionType || actionType;

        const userMessage = {
            id: Date.now(),
            type: 'user',
            content: input
        };

        // Optimistically update UI
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            // Prepare history for backend (all messages except the new one)
            const history = messages.map(msg => ({
                role: msg.type === 'user' ? 'user' : 'model',
                content: msg.content
            }));

            const response = await api.post('/chat', {
                message: input,
                action_type: selectedAction,
                history: history,
                session_id: sessionId
            });

            const { action, response: aiResponse, details } = response.data;

            // ... rest of the typewriter effect logic stays the same ...
            typewriterEffect(aiResponse, (completedMessage) => {
                setMessages(prev => [...prev, {
                    ...completedMessage,
                    isStreaming: false,
                    action,
                    details
                }]);

                if (action === 'add_fact' && onGraphUpdate) {
                    onGraphUpdate();
                }
            });

        } catch (error) {
            // ... error handling stays the same ...
            const errorMessage = {
                id: Date.now(),
                type: 'assistant',
                content: `Error: ${error.response?.data?.detail || error.message}`,
                isError: true
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.messagesContainer}>
                {messages.length === 0 && !streamingMessage && (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>💬</div>
                        <h3 style={styles.emptyTitle}>Start a conversation</h3>
                        <p style={styles.emptyText}>
                            I can help you store facts or answer questions about your knowledge graph.
                            Just type naturally!
                        </p>
                        <div style={styles.examples}>
                            <div style={styles.exampleLabel}>Try this:</div>
                            <div style={styles.exampleItem}>"Zayeem is passionate about AI"</div>
                            <div style={styles.exampleItem}>"What is Zayeem passionate about?"</div>
                            <div style={styles.exampleItem}>"Zayeem loves System Design"</div>
                        </div>
                    </div>
                )}

                {messages.map(message => (
                    <div
                        key={message.id}
                        style={{
                            ...styles.message,
                            ...(message.type === 'user' ? styles.userMessage : styles.assistantMessage)
                        }}
                    >
                        <div style={{
                            ...styles.messageContent,
                            ...(message.type === 'user' ? styles.userMessageContent : styles.assistantMessageContent)
                        }}>
                            {message.content}
                        </div>
                        {message.action && (
                            <div style={{
                                ...styles.actionBadge,
                                color: message.type === 'user' ? '#3b82f6' : '#6b7280'
                            }}>
                                {message.action === 'add_fact' ? '📝 ADDED' : '🔍 SEARCHED'}
                            </div>
                        )}
                        {message.details && message.action === 'add_fact' && (
                            <div style={styles.details}>
                                {message.details.nodes_created} nodes, {message.details.edges_created} relationships
                            </div>
                        )}
                    </div>
                ))}

                {streamingMessage && (
                    <div style={{ ...styles.message, ...styles.assistantMessage }}>
                        <div style={{ ...styles.messageContent, ...styles.assistantMessageContent }}>
                            {streamingMessage.content}
                            <span style={styles.cursor}>▋</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div style={styles.inputContainer} className="chat-input-container">
                <div style={styles.actionSelector}>
                    <button
                        style={{
                            ...styles.actionButton,
                            ...(actionType === 'add_fact' ? styles.actionButtonActive : {})
                        }}
                        onClick={() => setActionType('add_fact')}
                        disabled={isLoading}
                    >
                        📝 Add Fact
                    </button>
                    <button
                        style={{
                            ...styles.actionButton,
                            ...(actionType === 'ask_question' ? styles.actionButtonActive : {})
                        }}
                        onClick={() => setActionType('ask_question')}
                        disabled={isLoading}
                    >
                        🔍 Ask Question
                    </button>
                </div>
                <div style={styles.inputRow}>
                    <textarea
                        style={styles.input}
                        placeholder={actionType === 'add_fact' ? 'Type a fact to add...' : 'Ask a question...'}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        style={{
                            ...styles.sendButton,
                            ...(isLoading || !input.trim() ? styles.sendButtonDisabled : {})
                        }}
                        onClick={() => handleSend()}
                        disabled={isLoading || !input.trim()}
                    >
                        {isLoading ? '⏳' : '➤'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        position: 'relative',
        flex: '1 1 0',
        minHeight: 0
    },
    messagesContainer: {
        flex: '1 1 0',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: '#fafbfc',
        WebkitOverflowScrolling: 'touch',
        minHeight: 0,
        position: 'relative'
    },
    message: {
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '80%',
        wordWrap: 'break-word',
        animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    userMessage: {
        alignSelf: 'flex-end',
        marginLeft: 'auto'
    },
    assistantMessage: {
        alignSelf: 'flex-start',
        marginRight: 'auto'
    },
    messageContent: {
        padding: '14px 18px',
        fontSize: '14.5px',
        lineHeight: '1.65',
        whiteSpace: 'pre-wrap',
        borderRadius: '18px',
        position: 'relative',
        fontWeight: 400
    },
    userMessageContent: {
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        borderBottomRightRadius: '6px',
        boxShadow: '0 2px 12px rgba(59, 130, 246, 0.3), 0 1px 4px rgba(59, 130, 246, 0.2)'
    },
    assistantMessageContent: {
        backgroundColor: '#f6f8fa',
        color: '#0f1419',
        border: '1px solid #e1e4e8',
        borderBottomLeftRadius: '6px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
    },
    cursor: {
        animation: 'blink 1s infinite',
        marginLeft: '2px',
        color: '#3b82f6'
    },
    actionBadge: {
        marginTop: '8px',
        fontSize: '11px',
        opacity: 0.75,
        fontWeight: 700,
        letterSpacing: '0.03em'
    },
    details: {
        marginTop: '5px',
        fontSize: '11px',
        opacity: 0.65,
        fontWeight: 500
    },
    inputContainer: {
        position: 'relative',
        flexShrink: 0,
        flexGrow: 0,
        padding: '16px',
        paddingBottom: '16px',
        backgroundColor: '#ffffff',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: '1px solid #e1e4e8',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
        zIndex: 10
    },
    actionSelector: {
        display: 'flex',
        backgroundColor: '#f6f8fa',
        borderRadius: '12px',
        padding: '4px',
        marginBottom: '14px',
        border: '1px solid #e1e4e8',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
        width: '100%'
    },
    actionButton: {
        padding: '10px 16px',
        fontSize: '13px',
        flex: 1,
        border: 'none',
        borderRadius: '10px',
        backgroundColor: 'transparent',
        color: '#57606a',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em'
    },
    actionButtonActive: {
        backgroundColor: '#ffffff',
        color: '#0f1419',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
        transform: 'translateY(-1px)'
    },
    inputRow: {
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-end',
        backgroundColor: '#ffffff',
        borderRadius: '18px',
        padding: '14px 18px',
        border: '2px solid #e1e4e8',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
    },
    inputRowFocused: {
        borderColor: '#3b82f6',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 16px rgba(59, 130, 246, 0.15), 0 2px 8px rgba(0, 0, 0, 0.06)'
    },
    input: {
        flex: 1,
        padding: '8px 4px',
        fontSize: '14.5px',
        border: 'none',
        backgroundColor: 'transparent',
        outline: 'none',
        resize: 'none',
        fontFamily: 'inherit',
        maxHeight: '140px',
        color: '#0f1419',
        fontWeight: 400,
        lineHeight: '1.5'
    },
    sendButton: {
        padding: '12px',
        fontSize: '18px',
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        minWidth: '48px',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4), 0 2px 6px rgba(59, 130, 246, 0.3)',
        touchAction: 'manipulation'
    },
    sendButtonHover: {
        backgroundColor: '#2563eb',
        transform: 'scale(1.05) translateY(-1px)',
        boxShadow: '0 6px 16px rgba(59, 130, 246, 0.5), 0 3px 8px rgba(59, 130, 246, 0.4)'
    },
    sendButtonDisabled: {
        backgroundColor: '#d1d5db',
        cursor: 'not-allowed',
        boxShadow: 'none',
        transform: 'none',
        opacity: 0.6
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        padding: '32px 20px'
    },
    emptyIcon: {
        fontSize: '64px',
        marginBottom: '24px',
        opacity: 0.9,
        filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))'
    },
    emptyTitle: {
        fontSize: '22px',
        fontWeight: 700,
        marginBottom: '10px',
        color: '#0f1419',
        letterSpacing: '-0.02em'
    },
    emptyText: {
        fontSize: '14.5px',
        textAlign: 'center',
        marginBottom: '36px',
        maxWidth: '400px',
        color: '#57606a',
        lineHeight: '1.65',
        fontWeight: 400
    },
    examples: {
        backgroundColor: '#f6f8fa',
        padding: '24px',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid #e1e4e8',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
    },
    exampleLabel: {
        fontSize: '12px',
        fontWeight: 700,
        marginBottom: '14px',
        color: '#57606a',
        textTransform: 'uppercase',
        letterSpacing: '0.06em'
    },
    exampleItem: {
        fontSize: '13.5px',
        padding: '12px 14px',
        backgroundColor: '#ffffff',
        border: '1px solid #e1e4e8',
        borderRadius: '10px',
        marginBottom: '10px',
        color: '#24292f',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        fontWeight: 400
    }
};

export default ChatInterface;
export { generateSessionId };
