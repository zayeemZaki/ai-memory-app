from neo4j import GraphDatabase
from config import config


class Neo4jDatabase:
    """Neo4j database connection manager"""

    def __init__(self):
        self.driver = None

    def connect(self):
        """Initialize Neo4j driver"""
        self.driver = GraphDatabase.driver(
            config.NEO4J_URI, auth=(config.NEO4J_USERNAME, config.NEO4J_PASSWORD)
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
            result = session.run(
                """
                MATCH (e:Embedding)
                RETURN id(e) as id, e.text as text, e.created_at as created_at
                ORDER BY e.created_at DESC
            """
            )
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

    def create_graph_from_json(self, graph_data: dict, session_id: str = None) -> dict:
        """Create nodes and relationships from structured JSON data without duplicates"""
        with self.driver.session(database=config.NEO4J_DATABASE) as session:
            return session.execute_write(self._create_graph_transaction, graph_data, session_id)

    @staticmethod
    def _create_graph_transaction(tx, graph_data: dict, session_id: str = None):
        """Transaction function to create nodes and edges using MERGE to avoid duplicates"""
        created_nodes = []
        created_edges = []
        
        # Default to 'global' if no session provided
        session_id = session_id or "global"

        # --- 1. CREATE NODES ---
        for node in graph_data.get("nodes", []):
            node_id = node.get("id")  # Already lowercase from extract_graph_structure
            label = node.get("label", "Entity")
            properties = node.get("properties", {})
            name = properties.get("name", node_id)
            
            # CRITICAL FIX: Normalize ID to lowercase for case-insensitive matching
            # This ensures "Zayeem", "zayeem", "ZAYEEM" all map to the same node
            normalized_id = node_id.lower() if node_id else name.lower()

            # MERGE on normalized_id (guaranteed lowercase) instead of name
            params = {
                "normalized_id": normalized_id,
                "name": name,  # Display name (Title Case)
                "session_id": session_id
            }
            
            # Build dynamic property setting
            set_clauses = []
            for key, value in properties.items():
                if key not in ["name"]:
                    param_key = f"prop_{key}"
                    set_clauses.append(f"n.{key} = ${param_key}")
                    params[param_key] = value
            
            set_clause_str = ", ".join(set_clauses)
            if set_clause_str:
                set_clause_str = ", " + set_clause_str

            merge_query = f"""
            MERGE (n:{label} {{normalized_id: $normalized_id}})
            ON CREATE SET 
                n.name = $name,
                n.session_id = $session_id,
                n.created_at = datetime(),
                n.updated_at = datetime()
                {set_clause_str}
            ON MATCH SET 
                n.name = $name,
                n.session_id = CASE 
                    WHEN n.session_id = 'global' THEN 'global'
                    WHEN n.session_id = $session_id THEN $session_id
                    ELSE n.session_id
                END,
                n.updated_at = datetime()
            RETURN elementId(n) as element_id, n.name as name
            """

            result = tx.run(merge_query, **params)
            record = result.single()
            created_nodes.append(
                {
                    "id": node_id,
                    "element_id": record["element_id"],
                    "name": record["name"],
                }
            )

        node_map = {n["id"]: n["element_id"] for n in created_nodes}

        # --- 2. CREATE RELATIONSHIPS ---
        for edge in graph_data.get("edges", []):
            from_id = edge.get("from")
            to_id = edge.get("to")
            rel_type = edge.get("type", "RELATED_TO")
            properties = edge.get("properties", {})

            if from_id not in node_map or to_id not in node_map:
                continue 

            from_element_id = node_map[from_id]
            to_element_id = node_map[to_id]

            # We also tag the RELATIONSHIP with the session_id
            merge_rel_query = f"""
            MATCH (from) WHERE elementId(from) = $from_element_id
            MATCH (to) WHERE elementId(to) = $to_element_id
            MERGE (from)-[r:{rel_type}]->(to)
            ON CREATE SET 
                r.session_id = $session_id,
                r.created_at = datetime()
            ON MATCH SET
                r.session_id = CASE
                    WHEN r.session_id = 'global' THEN 'global'
                    ELSE $session_id
                END
            RETURN elementId(r) as element_id
            """

            rel_params = {
                "from_element_id": from_element_id,
                "to_element_id": to_element_id,
                "session_id": session_id
            }

            # Add edge properties
            if properties:
                prop_sets = []
                for key, value in properties.items():
                    param_key = f"rel_prop_{key}"
                    prop_sets.append(f"r.{key} = ${param_key}")
                    rel_params[param_key] = value
                
                if prop_sets:
                    merge_rel_query = merge_rel_query.replace(
                        "r.created_at = datetime()",
                        "r.created_at = datetime(), " + ", ".join(prop_sets)
                    )

            result = tx.run(merge_rel_query, **rel_params)
            record = result.single()
            created_edges.append(
                {
                    "from": from_id,
                    "to": to_id,
                    "type": rel_type,
                    "element_id": record["element_id"],
                }
            )

        return {
            "nodes_created": len(created_nodes),
            "edges_created": len(created_edges),
            "nodes": created_nodes,
            "edges": created_edges,
        }

    def execute_cypher(self, query: str, params: dict = None) -> list:
        """Execute a raw Cypher query with safe session_id handling"""
        import uuid
        
        # CRITICAL FIX: Ensure session_id is never None or a dangerous default
        safe_params = params or {}
        if 'session_id' in safe_params and (safe_params['session_id'] is None or safe_params['session_id'] == 'none'):
            # Use a UUID that will never match a real session
            safe_params['session_id'] = f'_nonexistent_{uuid.uuid4()}'
        
        with self.driver.session(database=config.NEO4J_DATABASE) as session:
            result = session.run(query, safe_params)
            return [record.data() for record in result]

    def get_schema(self) -> str:
        """Fetch the current graph schema"""
        with self.driver.session(database=config.NEO4J_DATABASE) as session:
            labels_result = session.run("CALL db.labels()")
            labels = [record["label"] for record in labels_result]

            rels_result = session.run("CALL db.relationshipTypes()")
            rels = [record["relationshipType"] for record in rels_result]

            return f"""
            Current Graph Schema:
            - Node Labels: {', '.join(labels)}
            - Relationship Types: {', '.join(rels)}
            """

db = Neo4jDatabase()