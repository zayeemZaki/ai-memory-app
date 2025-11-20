import { useState, useEffect } from 'react';
import './App.css';
import ChatInterface, { generateSessionId } from './ChatInterface';
import KnowledgeGraph from './KnowledgeGraph';

function App() {
  // Graph refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);
  // Session ID for sandboxing
  const [sessionId, setSessionId] = useState(null);
  // Mobile tab navigation
  const [activeTab, setActiveTab] = useState('chat');
  // Track if mobile or desktop
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Generate session ID on mount
  useEffect(() => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    console.log('Session ID:', newSessionId);
  }, []);

  // Listen for window resize to detect mobile/desktop
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Reset to chat tab when switching to mobile
      if (mobile && activeTab !== 'chat') {
        setActiveTab('chat');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

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
        <div style={isMobile ? styles.mobileMainContent : styles.mainContent}>
          {/* Desktop: Split View | Mobile: Single Tab View */}
          {!isMobile ? (
            <>
              {/* Left Panel - Chat Interface (Desktop) */}
              <div style={styles.leftPanel}>
                <ChatInterface onGraphUpdate={handleGraphUpdate} sessionId={sessionId} />
              </div>

              {/* Right Panel - Knowledge Graph (Desktop) */}
              <div style={styles.rightPanel}>
                <div style={styles.graphWrapper}>
                  <div style={styles.graphHeader}>
                    <h3 style={styles.graphTitle}>Knowledge Graph</h3>
                    <div style={styles.graphSubtitle}>Real-time visualization</div>
                  </div>
                  <KnowledgeGraph refreshTrigger={refreshKey} sessionId={sessionId} />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Mobile: Chat Tab */}
              <div 
                style={{
                  ...styles.mobileTabContent,
                  display: activeTab === 'chat' ? 'flex' : 'none'
                }}
              >
                <ChatInterface onGraphUpdate={handleGraphUpdate} sessionId={sessionId} />
              </div>

              {/* Mobile: Graph Tab */}
              <div 
                style={{
                  ...styles.mobileTabContent,
                  display: activeTab === 'graph' ? 'flex' : 'none'
                }}
              >
                <div style={styles.graphWrapper}>
                  <div style={styles.graphHeader}>
                    <h3 style={styles.graphTitle}>Knowledge Graph</h3>
                    <div style={styles.graphSubtitle}>Real-time visualization</div>
                  </div>
                  <KnowledgeGraph 
                    refreshTrigger={refreshKey} 
                    sessionId={sessionId} 
                    key={`graph-${activeTab}`} // Force re-render on tab switch
                  />
                </div>
              </div>

              {/* Mobile Bottom Navigation Bar */}
              <nav style={styles.mobileNavBar}>
                <button
                  style={{
                    ...styles.navButton,
                    ...(activeTab === 'chat' ? styles.navButtonActive : {})
                  }}
                  onClick={() => setActiveTab('chat')}
                >
                  <span style={styles.navIcon}>💬</span>
                  <span style={styles.navLabel}>Chat</span>
                </button>
                <button
                  style={{
                    ...styles.navButton,
                    ...(activeTab === 'graph' ? styles.navButtonActive : {})
                  }}
                  onClick={() => setActiveTab('graph')}
                >
                  <span style={styles.navIcon}>🕸️</span>
                  <span style={styles.navLabel}>Graph</span>
                </button>
              </nav>
            </>
          )}
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
    height: '100dvh',
    width: '100%',
    maxHeight: '100dvh',
    backgroundColor: '#f8f9fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    overflow: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e1e4e8',
    padding: '16px 20px',
    boxShadow: '0 1px 0 rgba(0, 0, 0, 0.03)',
    zIndex: 10,
    flexShrink: 0,
    flexGrow: 0
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
    flex: '1 1 0',
    width: '100%',
    gap: '0',
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
    minHeight: 0,
    minWidth: 0
  },
  mobileMainContent: {
    display: 'flex',
    flex: '1 1 0',
    width: '100%',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 0,
    minWidth: 0
  },
  mobileTabContent: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 'calc(20px + env(safe-area-inset-bottom))'
  },
  leftPanel: {
    width: '40%',
    minWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e1e4e8',
    overflow: 'hidden',
    boxShadow: '1px 0 0 rgba(0, 0, 0, 0.02)',
    flex: '0 0 40%',
    minHeight: 0
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fafbfc',
    overflow: 'hidden',
    position: 'relative',
    flex: '1 1 0',
    minHeight: 0,
    minWidth: 0
  },
  graphWrapper: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'hidden'
  },
  graphHeader: {
    padding: '16px 20px 12px',
    borderBottom: '1px solid #e1e4e8',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 0 rgba(0, 0, 0, 0.02)',
    flexShrink: 0,
    flexGrow: 0
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
    zIndex: 50,
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
  },
  // Mobile Navigation Bar Styles
  mobileNavBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e1e4e8',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '8px 16px',
    paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.08)',
    zIndex: 1000,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)'
  },
  navButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    flex: 1,
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    maxWidth: '120px'
  },
  navButtonActive: {
    backgroundColor: '#f0f7ff',
    transform: 'scale(1.05)'
  },
  navIcon: {
    fontSize: '24px',
    lineHeight: 1,
    transition: 'transform 0.2s ease'
  },
  navLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#57606a',
    letterSpacing: '0.02em',
    textTransform: 'uppercase'
  }
};

export default App;
