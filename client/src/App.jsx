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
    <div style={styles.app}>
      {/* Header Bar */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>🧠</span>
            <span style={styles.logoText}>AI Memory System</span>
          </div>
          <div style={styles.headerSubtitle}>Intelligent Knowledge Graph</div>
        </div>
      </header>

      {sessionId ? (
        <div style={styles.mainContent}>
          {/* Left Panel - Chat Interface */}
          <div style={styles.leftPanel}>
            <ChatInterface onGraphUpdate={handleGraphUpdate} sessionId={sessionId} />
          </div>

          {/* Right Panel - Knowledge Graph */}
          <div style={styles.rightPanel}>
            <div style={styles.graphWrapper}>
              <div style={styles.graphHeader}>
                <h3 style={styles.graphTitle}>Knowledge Graph</h3>
                <div style={styles.graphSubtitle}>Real-time visualization</div>
              </div>
              <KnowledgeGraph refreshTrigger={refreshKey} sessionId={sessionId} />
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.loading}>
          <div style={styles.loadingSpinner}></div>
          <div style={styles.loadingText}>Initializing session...</div>
        </div>
      )}

      {/* Footer Branding */}
      <footer style={styles.footer}>
        <span style={styles.footerText}>Developed by Zayeem</span>
        <span style={styles.footerIcon}>✨</span>
      </footer>
    </div>
  );
}

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    overflow: 'hidden'
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e1e4e8',
    padding: '16px 20px',
    boxShadow: '0 1px 0 rgba(0, 0, 0, 0.03)',
    zIndex: 10
  },
  headerContent: {
    maxWidth: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '8px'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logoIcon: {
    fontSize: '24px',
    lineHeight: 1,
    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f1419',
    letterSpacing: '-0.03em',
    background: 'linear-gradient(135deg, #0f1419 0%, #3b82f6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  },
  headerSubtitle: {
    fontSize: '12px',
    color: '#57606a',
    fontWeight: 500,
    letterSpacing: '0.01em',
    display: 'none'
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    width: '100%',
    gap: '0',
    overflow: 'auto',
    flexDirection: 'column',
    WebkitOverflowScrolling: 'touch'
  },
  leftPanel: {
    width: '100%',
    minWidth: 'unset',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderRight: 'none',
    borderBottom: 'none',
    overflow: 'visible',
    boxShadow: 'none',
    minHeight: '60vh',
    flex: 'none'
  },
  rightPanel: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fafbfc',
    overflow: 'visible',
    position: 'relative',
    minHeight: '70vh',
    flex: 'none'
  },
  graphWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '70vh',
    position: 'relative'
  },
  graphHeader: {
    padding: '16px 20px 12px',
    borderBottom: '1px solid #e1e4e8',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 0 rgba(0, 0, 0, 0.02)'
  },
  graphTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f1419',
    letterSpacing: '-0.02em'
  },
  graphSubtitle: {
    fontSize: '12px',
    color: '#57606a',
    marginTop: '4px',
    fontWeight: 400
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '20px'
  },
  loadingSpinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e1e4e8',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  },
  loadingText: {
    fontSize: '15px',
    color: '#57606a',
    fontWeight: 500,
    letterSpacing: '0.01em'
  },
  footer: {
    position: 'fixed',
    bottom: '12px',
    right: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#ffffff',
    border: '1px solid #e1e4e8',
    borderRadius: '24px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
    zIndex: 100,
    transition: 'all 0.2s ease'
  },
  footerText: {
    fontSize: '11px',
    color: '#57606a',
    fontWeight: 600,
    letterSpacing: '0.01em'
  },
  footerIcon: {
    fontSize: '14px',
    lineHeight: 1
  }
};

// Media query for desktop
if (typeof window !== 'undefined' && window.innerWidth >= 768) {
  styles.headerSubtitle.display = 'block';
  styles.mainContent.flexDirection = 'row';
  styles.mainContent.overflow = 'hidden';
  styles.leftPanel.width = '40%';
  styles.leftPanel.minWidth = '400px';
  styles.leftPanel.borderRight = '1px solid #e1e4e8';
  styles.leftPanel.borderBottom = 'none';
  styles.leftPanel.boxShadow = '1px 0 0 rgba(0, 0, 0, 0.02)';
  styles.leftPanel.height = 'auto';
  styles.leftPanel.minHeight = 'unset';
  styles.leftPanel.overflow = 'hidden';
  styles.rightPanel.width = '60%';
  styles.rightPanel.height = 'auto';
  styles.rightPanel.minHeight = 'unset';
  styles.rightPanel.overflow = 'hidden';
  styles.graphWrapper.minHeight = '100%';
  styles.header.padding = '20px 40px';
  styles.logoIcon.fontSize = '32px';
  styles.logoText.fontSize = '22px';
  styles.headerSubtitle.fontSize = '13px';
  styles.graphHeader.padding = '28px 40px 20px';
  styles.graphTitle.fontSize = '19px';
  styles.graphSubtitle.fontSize = '13px';
  styles.footer.bottom = '24px';
  styles.footer.right = '40px';
  styles.footer.padding = '10px 20px';
  styles.footerText.fontSize = '13px';
  styles.footerIcon.fontSize = '16px';
}

export default App;
