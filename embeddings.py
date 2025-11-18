from google import genai
from config import config
import json

class EmbeddingService:
    """Service for generating embeddings using Gemini API"""
    
    def __init__(self):
        self.client = None
    
    def initialize(self):
        """Initialize Gemini client"""
        self.client = genai.Client(api_key=config.GEMINI_API_KEY)
    
    def generate_embedding(self, text: str) -> list:
        """Generate embedding vector for given text"""
        result = self.client.models.embed_content(
            model="gemini-embedding-001",
            contents=text
        )
        return result.embeddings[0].values
    
    def extract_graph_structure(self, text: str) -> dict:
        """Extract structured graph data (nodes and edges) from text using Gemini"""
        
        prompt = f"""You are a knowledge graph extraction system. Analyze the following text and extract entities (nodes) and their relationships (edges).

Return ONLY valid JSON in this exact format:
{{
  "nodes": [
    {{"id": "unique_id", "label": "EntityType", "properties": {{"name": "entity_name", "other_property": "value"}}}}
  ],
  "edges": [
    {{"from": "node_id", "to": "node_id", "type": "RELATIONSHIP_TYPE", "properties": {{}}}}
  ]
}}

Rules:
1. Use descriptive labels like Person, Company, Location, Concept, etc.
2. Each node must have a unique id (use lowercase with underscores)
3. Each node must have a "name" property at minimum
4. Relationship types should be UPPERCASE_WITH_UNDERSCORES
5. Extract meaningful relationships between entities
6. Return ONLY the JSON, no other text

Text: {text}

JSON:"""
        
        response = self.client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt
        )
        
        # Extract JSON from response
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
        
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        # Parse JSON
        graph_data = json.loads(response_text)
        
        # Validate structure
        if "nodes" not in graph_data or "edges" not in graph_data:
            raise ValueError("Invalid graph structure: missing nodes or edges")
        
        return graph_data

    def generate_cypher_query(self, question: str) -> str:
        """
        Converts a natural language question into a Cypher query using Gemini.
        """
        # 1. Define the schema (The "Map")
        schema_context = """
        Schema:
        - Nodes: labelled dynamically (e.g., Person, Company, Location, Concept)
        - Relationships: defined dynamically based on the text (e.g., WORKS_AT, WORKED_AT, LOCATED_IN, CREATED_BY, etc.)
        - Common properties: 'name' (string), 'id' (string)
        - Relationship types can be present or past tense depending on the stored fact
        """

        # 2. The Prompt
        prompt = f"""
        You are a Neo4j Cypher Query Expert. Convert the following natural language question into a valid Cypher query.
        
        {schema_context}
        
        Question: "{question}"
        
        Rules:
        1. When relationship type is uncertain or could vary (present/past tense), use a flexible pattern with regex:
           - For work relationships: -[r:WORKS_AT|WORKED_AT]->
           - Or match ANY relationship: -[r]-> and filter in WHERE if needed
        2. Always perform case-insensitive search on 'name' property using toLower()
        3. RETURN the answer directly (e.g., node names or properties)
        4. Do NOT return JSON or Markdown. Return ONLY the raw Cypher query string
        5. Prefer matching multiple relationship types over being too specific
        
        Example Question: "Where does Alice work?" or "Where did Alice work?"
        Example Cypher: MATCH (p)-[r:WORKS_AT|WORKED_AT]->(c) WHERE toLower(p.name) CONTAINS 'alice' RETURN c.name
        
        Example Question: "What companies does Alice know about?"
        Example Cypher: MATCH (p)-[r]-(c:Company) WHERE toLower(p.name) CONTAINS 'alice' RETURN c.name, type(r)
        
        Cypher Query:
        """
        
        response = self.client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=prompt
        )
        
        # Clean the response (remove ```cypher ... ``` if Gemini adds it)
        query = response.text.strip()
        if query.startswith("```"):
            query = query.split("\n", 1)[1]
            if query.endswith("```"):
                query = query.rsplit("\n", 1)[0]
        
        return query.strip()

# Global embedding service instance
embedding_service = EmbeddingService()
