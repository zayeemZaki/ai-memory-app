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
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const graphRef = useRef();
    const containerRef = useRef();

    // Measure container size dynamically
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setDimensions({ width, height });
            }
        };

        updateDimensions();
        const resizeObserver = new ResizeObserver(updateDimensions);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    // Fetch data
    const fetchGraph = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/graph`, {
                headers: { 'x-api-key': API_KEY },
                params: { session_id: sessionId }
            });
            if (response.data.nodes && response.data.links) {
                // Mark nodes as session nodes if they were just added (not global)
                // This helps identify nodes that should show green border even if they existed before
                const enhancedNodes = response.data.nodes.map(node => ({
                    ...node,
                    // If a node is not global, it means it was touched in this session
                    isGlobal: node.isGlobal
                }));
                
                setGraphData({
                    nodes: enhancedNodes,
                    links: response.data.links
                });
                
                console.log('Graph updated. Nodes:', enhancedNodes.length, 'Links:', response.data.links.length);
            }
        } catch (error) {
            console.error("Error fetching graph:", error);
        }
    };

    useEffect(() => {
        fetchGraph();
    }, [refreshTrigger, sessionId]);

    // Configure D3 forces after graph loads
    useEffect(() => {
        if (graphRef.current && graphData.nodes.length > 0) {
            const fg = graphRef.current;
            
            // Set moderate charge repulsion
            if (fg.d3Force('charge')) {
                fg.d3Force('charge').strength(-400);
            }
            
            // Set link distance
            if (fg.d3Force('link')) {
                fg.d3Force('link').distance(50);
            }
            
            // Reheat simulation to apply changes
            if (fg.d3ReheatSimulation) {
                fg.d3ReheatSimulation();
            }
        }
    }, [graphData]);

    // 🎥 Cinematic Zoom on Click
    const handleNodeClick = useCallback(node => {
        const distance = 40;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

        graphRef.current.centerAt(node.x, node.y, 1000);
        graphRef.current.zoom(8, 2000);
    }, [graphRef]);

    return (
        <div ref={containerRef} style={styles.container}>
            <div style={styles.legend}>
                <span style={styles.legendItem}><span style={{...styles.dot, background: '#ffd700'}}></span> Global (Verified)</span>
                <span style={styles.legendItem}><span style={{...styles.dot, background: '#2ecc71'}}></span> Session (Temporary)</span>
            </div>
            
            <ForceGraph2D
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                backgroundColor="#fafbfc"
                
                // Force settings for node spacing
                d3AlphaDecay={0.01}
                d3VelocityDecay={0.3}
                cooldownTicks={300}
                warmupTicks={150}
                
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
                    const borderColor = node.isGlobal ? '#ffd700' : '#2ecc71'; 
                    const borderWidth = node.isGlobal ? 2 : 1;
                    
                    ctx.lineWidth = borderWidth / globalScale;
                    ctx.strokeStyle = borderColor;
                    ctx.stroke();

                    // Draw Label Text
                    ctx.font = `${fontSize}px Sans-Serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#333';
                    ctx.fillText(label, node.x, node.y + radius + fontSize);
                }}

                // 2. Living Particles
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={2}
                
                // 3. Link Labels
                linkCanvasObjectMode={() => 'after'}
                linkCanvasObject={(link, ctx, globalScale) => {
                    const start = link.source;
                    const end = link.target;
                    if (typeof start !== 'object' || typeof end !== 'object') return;
                    const textPos = Object.assign(...['x', 'y'].map(c => ({
                        [c]: start[c] + (end[c] - start[c]) / 2 
                    })));
                    const relLink = { x: end.x - start.x, y: end.y - start.y };
                    let textAngle = Math.atan2(relLink.y, relLink.x);
                    if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
                    if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);
                    const label = link.name;
                    
                    // Fixed font size that scales with zoom
                    const fontSize = 10 / globalScale;
                    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
                    const textWidth = ctx.measureText(label).width;
                    const padding = fontSize * 0.6;
                    const bckgDimensions = [textWidth + padding * 2, fontSize + padding * 1.2]; 
                    
                    ctx.save();
                    ctx.translate(textPos.x, textPos.y);
                    ctx.rotate(textAngle);
                    
                    // Background with shadow
                    ctx.shadowBlur = 4;
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    ctx.fillRect(-bckgDimensions[0] / 2, -bckgDimensions[1] / 2, ...bckgDimensions);
                    
                    // Border
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(-bckgDimensions[0] / 2, -bckgDimensions[1] / 2, ...bckgDimensions);
                    
                    ctx.shadowBlur = 0;
                    
                    // Text
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#333';
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
        width: '100%',
        height: '100%',
        minHeight: '70vh',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#fafbfc'
    },
    legend: {
        position: 'absolute',
        top: '12px',
        left: '12px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        padding: '10px 14px',
        borderRadius: '12px',
        border: '1px solid #e1e4e8',
        display: 'flex',
        gap: '10px',
        fontSize: '11px',
        zIndex: 10,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
        fontWeight: 600,
        letterSpacing: '0.01em',
        flexDirection: 'row'
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#57606a'
    },
    dot: {
        width: '11px',
        height: '11px',
        borderRadius: '50%',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.18), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
    }
};

export default KnowledgeGraph;