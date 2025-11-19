"""
Script to initialize global nodes (Zayeem's resume/profile)
These nodes will always be visible to all users
"""

from database import db
from config import config

def create_indexes():
    """Create database indexes for performance optimization"""
    print("📊 Creating database indexes...")
    
    try:
        # Index on session_id for fast session filtering
        db.execute_cypher("""
        CREATE INDEX node_session_id IF NOT EXISTS FOR (n) ON (n.session_id)
        """)
        print("   ✅ Created index: node_session_id")
        
        # Index on name for fast name lookups
        db.execute_cypher("""
        CREATE INDEX node_name IF NOT EXISTS FOR (n) ON (n.name)
        """)
        print("   ✅ Created index: node_name")
        
        # Index on normalized_id for case-insensitive matching
        db.execute_cypher("""
        CREATE INDEX node_normalized_id IF NOT EXISTS FOR (n) ON (n.normalized_id)
        """)
        print("   ✅ Created index: node_normalized_id")
        
        # Index on relationship session_id
        db.execute_cypher("""
        CREATE INDEX rel_session_id IF NOT EXISTS FOR ()-[r]-() ON (r.session_id)
        """)
        print("   ✅ Created index: rel_session_id")
        
    except Exception as e:
        print(f"   ⚠️  Index creation warning: {e}")

def init_global_nodes():
    """Create global nodes that are visible to all sessions"""
    
    # Connect to database
    db.connect()
    
    try:
        # Create indexes first for performance
        create_indexes()
        print()
        
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
