"""
Script to initialize global nodes (Zayeem's resume/profile)
These nodes will always be visible to all users
"""

from database import db
from config import config

def init_global_nodes():
    """Create global nodes that are visible to all sessions"""
    
    # Connect to database
    db.connect()
    
    try:
        # Define global graph structure
        global_graph = {
            "nodes": [
                {
                    "id": "zayeem",
                    "label": "Person",
                    "properties": {
                        "name": "Zayeem",
                        "role": "Software Engineer",
                        "status": "Looking for full-time roles"
                    }
                },
                {
                    "id": "ai_memory_project",
                    "label": "Project",
                    "properties": {
                        "name": "AI Memory System",
                        "type": "Full-stack Application",
                        "description": "Knowledge graph with AI-powered chat interface"
                    }
                },
                {
                    "id": "python",
                    "label": "Technology",
                    "properties": {
                        "name": "Python",
                        "type": "Programming Language"
                    }
                },
                {
                    "id": "react",
                    "label": "Technology",
                    "properties": {
                        "name": "React",
                        "type": "Frontend Framework"
                    }
                },
                {
                    "id": "neo4j",
                    "label": "Technology",
                    "properties": {
                        "name": "Neo4j",
                        "type": "Graph Database"
                    }
                },
                {
                    "id": "gemini",
                    "label": "Technology",
                    "properties": {
                        "name": "Google Gemini",
                        "type": "AI Model"
                    }
                }
            ],
            "edges": [
                {
                    "from": "zayeem",
                    "to": "ai_memory_project",
                    "type": "DEVELOPED",
                    "properties": {}
                },
                {
                    "from": "ai_memory_project",
                    "to": "python",
                    "type": "USES",
                    "properties": {}
                },
                {
                    "from": "ai_memory_project",
                    "to": "react",
                    "type": "USES",
                    "properties": {}
                },
                {
                    "from": "ai_memory_project",
                    "to": "neo4j",
                    "type": "USES",
                    "properties": {}
                },
                {
                    "from": "ai_memory_project",
                    "to": "gemini",
                    "type": "USES",
                    "properties": {}
                }
            ]
        }
        
        # Create global nodes with session_id = "global"
        result = db.create_graph_from_json(global_graph, session_id="global")
        
        print("✅ Global nodes initialized successfully!")
        print(f"   - Created {result['nodes_created']} nodes")
        print(f"   - Created {result['edges_created']} relationships")
        print("\nGlobal nodes (visible to all sessions):")
        for node in result['nodes']:
            print(f"   • {node['name']}")
        
    except Exception as e:
        print(f"❌ Error initializing global nodes: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_global_nodes()
