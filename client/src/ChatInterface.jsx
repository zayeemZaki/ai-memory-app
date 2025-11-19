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

function ChatInterface({ onGraphUpdate }) {
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

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

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
                history: history // <--- The new magic field
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
                            <div style={styles.exampleLabel}>Try asking:</div>
                            <div style={styles.exampleItem}>"Alice works at Google"</div>
                            <div style={styles.exampleItem}>"Where does Alice work?"</div>
                            <div style={styles.exampleItem}>"Bob is friends with Alice"</div>
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
                        <div style={styles.messageContent}>
                            {message.content}
                        </div>
                        {message.action && (
                            <div style={styles.actionBadge}>
                                {message.action === 'add_fact' ? '📝 Added to knowledge' : '🔍 Searched knowledge'}
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
                        <div style={styles.messageContent}>
                            {streamingMessage.content}
                            <span style={styles.cursor}>▋</span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div style={styles.inputContainer}>
                <textarea
                    style={styles.input}
                    placeholder="Type a fact or ask a question..."
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
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                >
                    {isLoading ? '⏳' : '➤'}
                </button>
            </div>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '600px',
        border: '1px solid #ddd',
        borderRadius: '12px',
        backgroundColor: '#fff',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    messagesContainer: {
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    message: {
        padding: '12px 16px',
        borderRadius: '12px',
        maxWidth: '80%',
        wordWrap: 'break-word',
        animation: 'slideIn 0.3s ease-out'
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#4CAF50',
        color: 'white',
        marginLeft: 'auto'
    },
    assistantMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#f5f5f5',
        color: '#333',
        marginRight: 'auto'
    },
    messageContent: {
        fontSize: '15px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap'
    },
    cursor: {
        animation: 'blink 1s infinite'
    },
    actionBadge: {
        marginTop: '8px',
        fontSize: '12px',
        opacity: 0.8,
        fontWeight: 'bold'
    },
    details: {
        marginTop: '4px',
        fontSize: '11px',
        opacity: 0.6
    },
    inputContainer: {
        display: 'flex',
        gap: '12px',
        padding: '16px',
        borderTop: '1px solid #eee',
        backgroundColor: '#fafafa'
    },
    input: {
        flex: 1,
        padding: '12px 16px',
        fontSize: '15px',
        border: '1px solid #ddd',
        borderRadius: '24px',
        outline: 'none',
        resize: 'none',
        fontFamily: 'inherit',
        maxHeight: '120px',
        transition: 'border-color 0.3s'
    },
    sendButton: {
        padding: '12px 20px',
        fontSize: '20px',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        cursor: 'pointer',
        transition: 'all 0.3s',
        width: '48px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc',
        cursor: 'not-allowed'
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#666',
        padding: '40px'
    },
    emptyIcon: {
        fontSize: '64px',
        marginBottom: '16px'
    },
    emptyTitle: {
        fontSize: '24px',
        marginBottom: '8px',
        color: '#333'
    },
    emptyText: {
        fontSize: '16px',
        textAlign: 'center',
        marginBottom: '24px',
        maxWidth: '400px'
    },
    examples: {
        backgroundColor: '#f9f9f9',
        padding: '16px',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '400px'
    },
    exampleLabel: {
        fontSize: '14px',
        fontWeight: 'bold',
        marginBottom: '8px',
        color: '#555'
    },
    exampleItem: {
        fontSize: '14px',
        padding: '8px',
        backgroundColor: '#fff',
        border: '1px solid #eee',
        borderRadius: '4px',
        marginBottom: '6px',
        fontStyle: 'italic',
        color: '#666'
    }
};

export default ChatInterface;
