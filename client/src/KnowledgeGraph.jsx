import { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_KEY = import.meta.env.VITE_API_SECRET || "default-dev-secret";

// 🎨 Cyberpunk / Modern Color Palette
const TYPE_COLORS = {
    Person: '#ff6b6b',      // Red/Coral
    Project: '#4ecdc4',     // Teal
    Technology: '#45b7d1',  // Sky Blue
    Company: '#a29bfe',     // Purple
    Location: '#55efc4',    // Mint
    Entity: '#95a5a6',      // Gray (Default)
};

const KnowledgeGraph = ({ refreshTrigger, sessionId }) => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const graphRef = useRef();

    // Fetch data
    const fetchGraph = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/graph`, {
                headers: { 'x-api-key': API_KEY },
                params: { session_id: sessionId }
            });
            if (response.data.nodes && response.data.links) {
                setGraphData(response.data);
            }
        } catch (error) {
            console.error("Error fetching graph:", error);
        }
    };

    useEffect(() => {
        fetchGraph();
    }, [refreshTrigger, sessionId]);

    // 🎥 Cinematic Zoom on Click
    const handleNodeClick = useCallback(node => {
        const distance = 40;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        graphRef.current.centerAt(node.x, node.y, 1000);
        graphRef.current.zoom(8, 2000);
    }, [graphRef]);

    return (
        <div style={styles.container}>
            <div style={styles.legend}>
                <span style={styles.legendItem}><span style={{...styles.dot, background: '#ffd700'}}></span> Global (Verified)</span>
                <span style={styles.legendItem}><span style={{...styles.dot, background: '#2ecc71'}}></span> Session (Temporary)</span>
            </div>
            
            <ForceGraph2D
                ref={graphRef}
                width={800}
                height={500}
                graphData={graphData}
                backgroundColor="#ffffff"
                
                // 1. Custom Node Painting
                nodeCanvasObject={(node, ctx, globalScale) => {
                    const label = node.name;
                    const fontSize = 12 / globalScale;
                    const radius = 5;
                    
                    // Pick color based on label (Person, Tech, etc.)
                    const color = TYPE_COLORS[node.group] || TYPE_COLORS.Entity;
                    
                    // Draw the Node (Circle)
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                    ctx.fillStyle = color;
                    ctx.fill();

                    // Draw the "Halo" (Border) for Session vs Global
                    // Gold = Global, Green = Session
                    const borderColor = node.isGlobal ? '#ffd700' : '#2ecc71'; 
                    const borderWidth = node.isGlobal ? 2 : 1; // Make global nodes stand out more
                    
                    ctx.lineWidth = borderWidth / globalScale;
                    ctx.strokeStyle = borderColor;
                    ctx.stroke();

                    // Draw Label Text
                    ctx.font = `${fontSize}px Sans-Serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#333'; // Dark text for visibility
                    ctx.fillText(label, node.x, node.y + radius + fontSize);
                }}

                // 2. Living Particles
                linkDirectionalParticles={2} // Number of dots moving
                linkDirectionalParticleSpeed={0.005} // Speed of flow
                linkDirectionalParticleWidth={2}
                
                // 3. Link Labels (Keeping your nice labels)
                linkCanvasObjectMode={() => 'after'}
                linkCanvasObject={(link, ctx) => {
                    const MAX_FONT_SIZE = 4;
                    const LABEL_NODE_MARGIN = graphRef.current.d3Force('link').distance() * 0.5 + 1;
                    const start = link.source;
                    const end = link.target;
                    if (typeof start !== 'object' || typeof end !== 'object') return;
                    const textPos = Object.assign(...['x', 'y'].map(c => ({
                        [c]: start[c] + (end[c] - start[c]) / 2 
                    })));
                    const relLink = { x: end.x - start.x, y: end.y - start.y };
                    const maxTextLength = Math.sqrt(Math.pow(relLink.x, 2) + Math.pow(relLink.y, 2)) - LABEL_NODE_MARGIN * 2;
                    let textAngle = Math.atan2(relLink.y, relLink.x);
                    if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
                    if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);
                    const label = link.name;
                    ctx.font = '1px Sans-Serif';
                    const fontSize = Math.min(MAX_FONT_SIZE, maxTextLength / ctx.measureText(label).width);
                    ctx.font = `${fontSize}px Sans-Serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); 
                    ctx.save();
                    ctx.translate(textPos.x, textPos.y);
                    ctx.rotate(textAngle);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.fillRect(-bckgDimensions[0] / 2, -bckgDimensions[1] / 2, ...bckgDimensions);
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#666';
                    ctx.fillText(label, 0, 0);
                    ctx.restore();
                }}

                // Interaction
                onNodeClick={handleNodeClick}
            />
        </div>
    );
};

const styles = {
    container: {
        border: '1px solid #e0e0e0', 
        borderRadius: '12px', 
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        position: 'relative',
        backgroundColor: 'white'
    },
    legend: {
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(255,255,255,0.9)',
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid #eee',
        display: 'flex',
        gap: '15px',
        fontSize: '12px',
        zIndex: 10
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        color: '#555',
        fontWeight: '500'
    },
    dot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%'
    }
};

export default KnowledgeGraph;