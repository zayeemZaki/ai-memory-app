import { useState } from 'react';
import './App.css';
import ChatInterface from './ChatInterface';
import KnowledgeGraph from './KnowledgeGraph';

function App() {
  // Graph refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  const handleGraphUpdate = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>🧠 AI Memory System</h1>
      <p style={styles.subtitle}>Chat naturally - I'll understand whether you're adding facts or asking questions</p>
      
      {/* Unified Chat Interface */}
      <div style={styles.chatSection}>
        <ChatInterface onGraphUpdate={handleGraphUpdate} />
      </div>

      {/* Knowledge Graph Visualization at Bottom */}
      <div style={styles.graphContainer}>
        <KnowledgeGraph refreshTrigger={refreshKey} />
      </div>
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
  }
};

export default App;
