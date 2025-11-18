import { useState, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';

const KnowledgeGraph = ({ refreshTrigger }) => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const graphRef = useRef();

    // Fetch graph data from API
    const fetchGraph = async () => {
        try {
            const response = await axios.get('http://localhost:5001/graph');
            // API returns { nodes: [...], links: [...] }
            // We might need to wrap it if your API returns { success: true, nodes: ... }
            // Adjust based on your exact API response structure
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
            <h3 style={{ padding: '10px', borderBottom: '1px solid #eee', margin: 0 }}>Knowledge Graph</h3>
            <ForceGraph2D
                ref={graphRef}
                width={800}
                height={400}
                graphData={graphData}
                nodeLabel="name"             // Show 'name' property on hover
                nodeAutoColorBy="group"      // Color by group if you have it
                linkDirectionalArrowLength={6} // Draw arrows for relationships
                linkDirectionalArrowRelPos={1}
                linkLabel="name"             // Show relationship type on hover
            />
        </div>
    );
};

export default KnowledgeGraph;