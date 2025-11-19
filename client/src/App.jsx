import { useState, useEffect } from 'react';
import './App.css';
import ChatInterface, { generateSessionId } from './ChatInterface';
import KnowledgeGraph from './KnowledgeGraph';

function App() {
  // Graph refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);
  // Session ID for sandboxing
  const [sessionId, setSessionId] = useState(null);

  // Generate session ID on mount
  useEffect(() => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    console.log('Session ID:', newSessionId);
  }, []);

  const handleGraphUpdate = () => {
    // Delay to handle Neo4j Aura's eventual consistency
    // New nodes take ~500ms to become readable after write
    setTimeout(() => {
      setRefreshKey(k => k + 1);
    }, 500);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>🧠 AI Memory System</h1>
      <p style={styles.subtitle}>Chat naturally - I'll understand whether you're adding facts or asking questions</p>
      
      {/* Unified Chat Interface */}
      {sessionId ? (
        <>
          <div style={styles.chatSection}>
            <ChatInterface onGraphUpdate={handleGraphUpdate} sessionId={sessionId} />
          </div>

          {/* Knowledge Graph Visualization at Bottom */}
          <div style={styles.graphContainer}>
            <KnowledgeGraph refreshTrigger={refreshKey} sessionId={sessionId} />
          </div>
        </>
      ) : (
        <div style={styles.loading}>Initializing session...</div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '10px',
    color: '#333',
    fontSize: '32px'
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    fontSize: '16px',
    marginBottom: '30px'
  },
  chatSection: {
    marginBottom: '40px'
  },
  graphContainer: {
    marginTop: '40px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    backgroundColor: '#fff'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
    fontSize: '16px'
  }
};

export default App;
