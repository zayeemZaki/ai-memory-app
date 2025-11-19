import { useState, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';

// 1. Get the correct URL and Key from the environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_KEY = import.meta.env.VITE_API_SECRET || "default-dev-secret";

const KnowledgeGraph = ({ refreshTrigger, sessionId }) => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const graphRef = useRef();

    // Fetch graph data from API
    const fetchGraph = async () => {
        try {
            // 2. Use the dynamic URL and include the security header
            const response = await axios.get(`${API_BASE_URL}/graph`, {
                headers: {
                    'x-api-key': API_KEY
                },
                params: {
                    session_id: sessionId
                }
            });

            const data = response.data; 
            if (data.nodes && data.links) {
                setGraphData(data);
            }
        } catch (error) {
            console.error("Error fetching graph:", error);
        }
    };

    // Re-fetch when the component loads or when 'refreshTrigger' changes
    useEffect(() => {
        fetchGraph();
    }, [refreshTrigger]);

    return (
        <div style={{ border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
            <h3 style={{ padding: '10px', borderBottom: '1px solid #eee', margin: 0 }}>
                Knowledge Graph
                <span style={{ fontSize: '12px', marginLeft: '10px', color: '#666' }}>
                    🔵 Global | 🟢 Your Session
                </span>
            </h3>
            <ForceGraph2D
                ref={graphRef}
                width={800}
                height={400}
                graphData={graphData}
                nodeLabel={(node) => `${node.name}${node.isGlobal ? ' (Global)' : ' (Session)'}`}
                nodeColor={(node) => node.isGlobal ? '#4a90e2' : '#4CAF50'}
                nodeRelSize={6}
                linkDirectionalArrowLength={6}
                linkDirectionalArrowRelPos={1}
                linkLabel="name"
            />
        </div>
    );
};

export default KnowledgeGraph;