import { useState } from 'react';
import axios from 'axios';
import './App.css';
import KnowledgeGraph from './KnowledgeGraph';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_KEY = import.meta.env.VITE_API_SECRET || "default-dev-secret";

function App() {
  // Left Panel State
  const [memoryText, setMemoryText] = useState('');
  const [memoryStatus, setMemoryStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Right Panel State
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [askLoading, setAskLoading] = useState(false);

  // Graph refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Add Memory Handler
  const handleAddMemory = async () => {
    if (!memoryText.trim()) {
      setMemoryStatus('Please enter some text');
      return;
    }

    setLoading(true);
    setMemoryStatus('');

    try {
      const response = await axios.post(`${API_BASE_URL}/add-fact`, {
        text: memoryText
      });

      setMemoryStatus(`✅ Added: ${response.data.nodes_created} nodes, ${response.data.edges_created} edges`);
      setMemoryText('');
      setRefreshKey(k => k + 1); // Trigger graph refresh
    } catch (error) {
      setMemoryStatus(`❌ Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Ask Question Handler
  const handleAskQuestion = async () => {
    if (!question.trim()) {
      setAnswer({ error: 'Please enter a question' });
      return;
    }

    setAskLoading(true);
    setAnswer(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/ask`, {
        params: { q: question }
      });

      setAnswer(response.data);
    } catch (error) {
      setAnswer({ error: error.response?.data?.detail || error.message });
    } finally {
      setAskLoading(false);
    }
  };

  const api = axios.create({
    baseURL: 'http://localhost:5001',
    headers: {
      'x-api-key': API_KEY 
    }
  });

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>AI Memory System</h1>
      
      <div style={styles.panels}>
        {/* Left Panel: Add Memory */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Add Memory</h2>
          <textarea
            style={styles.textarea}
            placeholder="Enter a fact (e.g., 'Alice works at Google in Mountain View')..."
            value={memoryText}
            onChange={(e) => setMemoryText(e.target.value)}
            rows={6}
          />
          <button
            style={styles.button}
            onClick={handleAddMemory}
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Memory'}
          </button>
          {memoryStatus && (
            <div style={styles.status}>{memoryStatus}</div>
          )}
        </div>

        {/* Right Panel: Ask Question */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Ask Question</h2>
          <input
            style={styles.input}
            type="text"
            placeholder="Ask a question (e.g., 'Where does Alice work?')..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
          />
          <button
            style={styles.button}
            onClick={handleAskQuestion}
            disabled={askLoading}
          >
            {askLoading ? 'Searching...' : 'Ask'}
          </button>
          
          {answer && (
            <div style={styles.answerBox}>
              {answer.error ? (
                <div style={styles.error}>❌ {answer.error}</div>
              ) : (
                <>
                  <div style={styles.answerSection}>
                    <strong>Question:</strong> {answer.question}
                  </div>
                  <div style={styles.answerSection}>
                    <strong>Answer:</strong>
                    {answer.answer && answer.answer.length > 0 ? (
                      <pre style={styles.json}>{JSON.stringify(answer.answer, null, 2)}</pre>
                    ) : (
                      <div style={styles.noAnswer}>No results found</div>
                    )}
                  </div>
                  <div style={styles.cypherSection}>
                    <strong>Generated Cypher:</strong>
                    <code style={styles.code}>{answer.generated_cypher}</code>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
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
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
    color: '#333'
  },
  panels: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '30px',
    alignItems: 'start'
  },
  panel: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    backgroundColor: '#f9f9f9'
  },
  panelTitle: {
    marginBottom: '15px',
    color: '#555',
    fontSize: '20px'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    marginBottom: '15px',
    fontFamily: 'inherit',
    resize: 'vertical'
  },
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    marginBottom: '15px'
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.3s'
  },
  status: {
    marginTop: '15px',
    padding: '10px',
    borderRadius: '4px',
    backgroundColor: '#e8f5e9',
    fontSize: '14px'
  },
  answerBox: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #ddd'
  },
  answerSection: {
    marginBottom: '15px'
  },
  json: {
    backgroundColor: '#f5f5f5',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '13px',
    overflow: 'auto',
    marginTop: '8px'
  },
  noAnswer: {
    color: '#999',
    fontStyle: 'italic',
    marginTop: '8px'
  },
  cypherSection: {
    marginTop: '15px',
    paddingTop: '15px',
    borderTop: '1px solid #eee'
  },
  code: {
    display: 'block',
    backgroundColor: '#f5f5f5',
    padding: '10px',
    borderRadius: '4px',
    fontSize: '12px',
    marginTop: '8px',
    fontFamily: 'monospace',
    overflow: 'auto'
  },
  error: {
    color: '#d32f2f',
    padding: '10px',
    backgroundColor: '#ffebee',
    borderRadius: '4px'
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
