from neo4j import GraphDatabase
from config import config

class Neo4jDatabase:
    """Neo4j database connection manager"""
    
    def __init__(self):
        self.driver = None
    
    def connect(self):
        """Initialize Neo4j driver"""
        self.driver = GraphDatabase.driver(
            config.NEO4J_URI,
            auth=(config.NEO4J_USERNAME, config.NEO4J_PASSWORD)
        )
        # Verify connectivity
        self.driver.verify_connectivity()
    
    def close(self):
        """Close Neo4j driver"""
        if self.driver:
            self.driver.close()
    
    def create_embedding_node(self, text: str, embedding: list) -> dict:
        """Create a node with text and embedding in Neo4j"""
        with self.driver.session(database=config.NEO4J_DATABASE) as session:
            return session.execute_write(self._create_node_transaction, text, embedding)
    
    @staticmethod
    def _create_node_transaction(tx, text: str, embedding: list):
        """Transaction function to create embedding node"""
        query = """
        CREATE (e:Embedding {text: $text, embedding: $embedding, created_at: datetime()})
        RETURN id(e) as id
        """
        result = tx.run(query, text=text, embedding=embedding)
        return result.single()
    
    def get_all_embeddings(self) -> list:
        """Get all stored embeddings"""
        with self.driver.session(database=config.NEO4J_DATABASE) as session:
            result = session.run("""
                MATCH (e:Embedding)
                RETURN id(e) as id, e.text as text, e.created_at as created_at
                ORDER BY e.created_at DESC
            """)
            return list(result)

    
    def search_embeddings(self, query_vector: list, top_k: int = 5) -> list:
        """Search for top_k similar embeddings using a query vector"""
        with self.driver.session(database=config.NEO4J_DATABASE) as session:
            # Use execute_read for read-only operations
            return session.execute_read(self._search_transaction, query_vector, top_k)

    @staticmethod
    def _search_transaction(tx, query_vector: list, top_k: int):
        """Transaction function to search for embeddings"""
        query = """
            CALL db.index.vector.queryNodes('embedding-index', $top_k, $query_vector)
            YIELD node, score
            RETURN node.text AS text, node.created_at AS created_at, score, id(node) AS id
        """
        result = tx.run(query, query_vector=query_vector, top_k=top_k)
        return list(result)
    
    def create_graph_from_json(self, graph_data: dict) -> dict:
        """Create nodes and relationships from structured JSON data without duplicates"""
        with self.driver.session(database=config.NEO4J_DATABASE) as session:
            return session.execute_write(self._create_graph_transaction, graph_data)
    
    @staticmethod
    def _create_graph_transaction(tx, graph_data: dict):
        """Transaction function to create nodes and edges using MERGE to avoid duplicates"""
        created_nodes = []
        created_edges = []
        
        # Create nodes using MERGE (creates if not exists, matches if exists)
        for node in graph_data.get('nodes', []):
            node_id = node.get('id')
            label = node.get('label', 'Entity')
            properties = node.get('properties', {})
            
            # Build MERGE query dynamically
            # Use 'name' property as the unique identifier for merging
            name = properties.get('name', node_id)
            
            # Create SET clause for all properties
            set_clauses = []
            params = {'name': name}
            
            for key, value in properties.items():
                if key != 'name':  # name is already in MERGE
                    param_key = f"prop_{key}"
                    set_clauses.append(f"n.{key} = ${param_key}")
                    params[param_key] = value
            
            # Build and execute MERGE query
            merge_query = f"MERGE (n:{label} {{name: $name}})"
            if set_clauses:
                merge_query += " SET " + ", ".join(set_clauses)
            merge_query += " SET n.updated_at = datetime() RETURN elementId(n) as element_id, n.name as name"
            
            result = tx.run(merge_query, **params)
            record = result.single()
            created_nodes.append({
                'id': node_id,
                'element_id': record['element_id'],
                'name': record['name']
            })
        
        # Create a mapping of node_id to element_id
        node_map = {n['id']: n['element_id'] for n in created_nodes}
        
        # Create relationships using MERGE
        for edge in graph_data.get('edges', []):
            from_id = edge.get('from')
            to_id = edge.get('to')
            rel_type = edge.get('type', 'RELATED_TO')
            properties = edge.get('properties', {})
            
            if from_id not in node_map or to_id not in node_map:
                continue  # Skip if nodes don't exist
            
            from_element_id = node_map[from_id]
            to_element_id = node_map[to_id]
            
            # Build MERGE query for relationship
            # Relationships are merged based on type and connected nodes
            merge_rel_query = f"""
            MATCH (from) WHERE elementId(from) = $from_element_id
            MATCH (to) WHERE elementId(to) = $to_element_id
            MERGE (from)-[r:{rel_type}]->(to)
            SET r.updated_at = datetime()
            RETURN elementId(r) as element_id
            """
            
            rel_params = {
                'from_element_id': from_element_id,
                'to_element_id': to_element_id
            }
            
            # Add edge properties if any
            if properties:
                set_clauses = []
                for key, value in properties.items():
                    param_key = f"rel_prop_{key}"
                    set_clauses.append(f"r.{key} = ${param_key}")
                    rel_params[param_key] = value
                
                if set_clauses:
                    # Modify query to include property sets
                    merge_rel_query = merge_rel_query.replace(
                        "SET r.updated_at",
                        "SET " + ", ".join(set_clauses) + ", r.updated_at"
                    )
            
            result = tx.run(merge_rel_query, **rel_params)
            record = result.single()
            created_edges.append({
                'from': from_id,
                'to': to_id,
                'type': rel_type,
                'element_id': record['element_id']
            })
        
        return {
            'nodes_created': len(created_nodes),
            'edges_created': len(created_edges),
            'nodes': created_nodes,
            'edges': created_edges
        }
        
    def execute_cypher(self, query: str) -> list:
        """Execute a raw Cypher query"""
        with self.driver.session(database=config.NEO4J_DATABASE) as session:
            result = session.run(query)
            # Convert Neo4j records to a standard list of dictionaries
            return [record.data() for record in result]
        
    def get_schema(self) -> str:
        """Fetch the current graph schema (labels and relationships)"""
        with self.driver.session(database=config.NEO4J_DATABASE) as session:
            # Get all unique labels
            labels_result = session.run("CALL db.labels()")
            labels = [record["label"] for record in labels_result]
            
            # Get all unique relationship types
            rels_result = session.run("CALL db.relationshipTypes()")
            rels = [record["relationshipType"] for record in rels_result]
            
            return f"""
            Current Graph Schema:
            - Node Labels: {', '.join(labels)}
            - Relationship Types: {', '.join(rels)}
            """

# Global database instance
db = Neo4jDatabase()
