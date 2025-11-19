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
            model="gemini-embedding-001", contents=text
        )
        return result.embeddings[0].values

    def extract_graph_structure(self, text: str) -> dict:
        """Extract structured graph data (nodes and edges) from text using Gemini"""

        prompt = f"""You are a knowledge graph extraction system. Extract entities (nodes) and relationships (edges) from the text.

CRITICAL: Follow these DATA STANDARDS exactly. Violating these rules will break the database.

===== MANDATORY FORMAT RULES =====

1. ID FIELDS (snake_case - LOWERCASE WITH UNDERSCORES):
   - ALL "id" fields MUST be lowercase_with_underscores
   - "Ohio" → "ohio", "New York" → "new_york", "Zayeem" → "zayeem"
   - This ensures "Ohio" and "ohio" map to the SAME node
   - NEVER use capital letters or spaces in IDs

2. NAME PROPERTIES (Title Case - VISIBLE TO USER):
   - ALL "name" properties MUST be Title Case
   - "ohio" → "Ohio", "new york" → "New York", "zayeem" → "Zayeem"
   - This is what users see in the graph

3. RELATIONSHIP TYPES (SCREAMING_SNAKE_CASE - ALL UPPERCASE):
   - ALL "type" fields MUST be UPPERCASE_WITH_UNDERSCORES
   - "lives in" → "LIVES_IN", "works at" → "WORKS_AT", "friend of" → "FRIEND_OF"
   - This ensures "Lives In" and "LIVES_IN" are the SAME relationship

===== EXAMPLES =====

Input: "Zayeem lives in Ohio"
Output:
{{
  "nodes": [
    {{"id": "zayeem", "label": "Person", "properties": {{"name": "Zayeem"}}}},
    {{"id": "ohio", "label": "Location", "properties": {{"name": "Ohio"}}}}
  ],
  "edges": [
    {{"from": "zayeem", "to": "ohio", "type": "LIVES_IN", "properties": {{}}}}
  ]
}}

Input: "Alice works at Google"
Output:
{{
  "nodes": [
    {{"id": "alice", "label": "Person", "properties": {{"name": "Alice"}}}},
    {{"id": "google", "label": "Company", "properties": {{"name": "Google"}}}}
  ],
  "edges": [
    {{"from": "alice", "to": "google", "type": "WORKS_AT", "properties": {{}}}}
  ]
}}

===== YOUR TASK =====

Text: {text}

Return ONLY valid JSON. No explanations.

JSON:"""

        response = self.client.models.generate_content(
            model="gemini-2.5-flash", contents=prompt
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

    def generate_cypher_query(self, question: str, schema_context: str = None) -> str:
        # We simplify the prompt to use flexible "CONTAINS" matching
        # instead of strict relationship types.
        
        prompt = f"""
        You are a Neo4j Expert. Write a Cypher query to answer the question.

        SECURITY RULE:
        Every MATCH must be filtered by session_id.
        Pattern: WHERE (n.session_id = 'global' OR n.session_id = $session_id)
        
        CRITICAL: Do NOT assume specific relationship names. Use broad matching.
        
        Query Strategy:
        1. Find nodes that match the entities in the question.
        2. Return those nodes AND their connected neighbors.
        3. Filter by session_id ('global' OR $session_id).
        
        Example Target Query Structure:
        MATCH (n)-[r]-(m)
        WHERE (toLower(n.name) CONTAINS toLower('keyword') OR toLower(m.name) CONTAINS toLower('keyword'))
        AND (n.session_id = 'global' OR n.session_id = $session_id)
        RETURN n.name, type(r), m.name
        LIMIT 20
        
        Question: "{question}"
        
        Return ONLY the Cypher string.
        """
        
        response = self.client.models.generate_content(
            model="gemini-2.5-flash", 
            contents=prompt
        )
        
        return response.text.replace("```cypher", "").replace("```", "").strip()

    def format_query_results(self, question: str, results: list) -> str:
        if not results:
            return "I couldn't find that information in your memory."
        
        # 1. Structure the data with semantic awareness
        # Keep entity-relationship-entity triples for better context
        structured_data = []
        for record in results:
            entity1 = record.get('entity1', '')
            relationships = record.get('relationships', [])
            entity2 = record.get('entity2', '')
            
            # Format as structured triples
            if isinstance(relationships, list):
                rel_chain = ' -> '.join(relationships)
                structured_data.append(f"{entity1} --[{rel_chain}]--> {entity2}")
            else:
                structured_data.append(f"{entity1} --[{relationships}]--> {entity2}")
        
        context_text = "\n".join(structured_data)

        # 2. The "Semantic Sniper" Prompt
        prompt = f"""
        You are a precise Knowledge Graph Answer Engine with semantic understanding.
        
        User Question: "{question}"
        
        Graph Paths Found:
        {context_text}
        
        CRITICAL RULES:
        1. ONLY use DIRECT relationships that answer the question
        2. If the path has multiple hops (A -> B -> C), check if the relationship chain makes semantic sense
        3. "FRIEND_OF" does NOT transfer properties (if A is friend of B, and B loves C, then A does NOT love C)
        4. "WORKS_AT", "LIVES_IN", "LOVES", "HAS_HOBBY" are DIRECT properties
        5. If you only find INDIRECT connections through friends/associates, say "I don't have that information"
        6. Be brief and direct
        
        Examples:
        Q: "What does Zayeem love?"
        Paths: "Zayeem --[LOVES]--> Football"
        Answer: "Zayeem loves Football."
        
        Q: "What does Zayeem love?"
        Paths: "Zayeem --[FRIEND_OF]--> Subham"
               "Subham --[LOVES]--> Football"
        Answer: "I don't have information about what Zayeem loves. I only know that his friend Subham loves Football."
        
        Q: "Where does Alice live?"
        Paths: "Alice --[LIVES_IN]--> Ohio"
        Answer: "Alice lives in Ohio."
        
        Q: "Where does Alice live?"
        Paths: "Alice --[FRIEND_OF, LIVES_IN]--> Bob --[LIVES_IN]--> Ohio"
        Answer: "I don't have information about where Alice lives. I only know her friend Bob lives in Ohio."
        
        Answer:"""
        
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return response.text.strip()
    
    # Add this method to EmbeddingService class
    def rewrite_query(self, original_query: str, chat_history: list) -> str:
        """
        Rewrites a query to make it standalone based on chat history.
        """
        if not chat_history:
            return original_query

        # Format history for the prompt
        history_text = "\n".join(
            [f"{msg['role']}: {msg['content']}" for msg in chat_history[-4:]]
        )

        prompt = f"""
        You are a query rewriting assistant. Your job is to rewrite the "Current Question" to be a standalone question that contains all necessary context from the "Chat History".
        
        Rules:
        1. Replace pronouns (he, she, it, they) with the specific names they refer to.
        2. If the question is already standalone, return it exactly as is.
        3. Do NOT answer the question. Just rewrite it.
        
        Chat History:
        {history_text}
        
        Current Question: "{original_query}"
        
        Standalone Question:"""

        response = self.client.models.generate_content(
            model="gemini-2.5-flash", contents=prompt
        )

        return response.text.strip()

    def process_query_optimized(self, query: str, history: list) -> dict:
        """
        PERFORMANCE OPTIMIZATION: Single LLM call replacing 3 sequential calls.
        Combines: rewrite_query + extract_keywords into one structured output.
        
        Returns:
        {
            "rewritten_query": "standalone question",
            "keywords": ["Entity1", "Entity2"]
        }
        """
        if not history:
            # No history means no rewriting needed, just extract keywords
            return {
                "rewritten_query": query,
                "keywords": self.extract_keywords(query)
            }
        
        # Format history for context
        history_text = "\n".join(
            [f"{msg['role']}: {msg['content']}" for msg in history[-4:]]
        )
        
        prompt = f"""
        You are a Query Processing Engine. Perform TWO tasks in ONE response:
        
        Task 1 - Query Rewriting:
        Rewrite the current question to be standalone by replacing pronouns with specific names from the chat history.
        
        Task 2 - Keyword Extraction:
        Extract important entities (names, places, companies, objects) from the REWRITTEN query.
        
        Chat History:
        {history_text}
        
        Current Question: "{query}"
        
        Rules:
        1. If the question is already standalone, return it as-is
        2. Replace pronouns (he, she, it, they, etc.) with specific names
        3. Extract only proper nouns and significant entities
        4. Return keywords in Title Case
        5. If no keywords found, return empty array
        
        Example:
        Input: "where does he live?"
        History: "user: Zayeem is my friend"
        Output:
        {{
          "rewritten_query": "Where does Zayeem live?",
          "keywords": ["Zayeem"]
        }}
        
        Return ONLY valid JSON with these two fields:
        {{
          "rewritten_query": "...",
          "keywords": ["..."]
        }}
        
        JSON:"""
        
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={
                    "response_mime_type": "application/json"
                }
            )
            
            result = json.loads(response.text.strip())
            
            # Validate structure
            if "rewritten_query" not in result or "keywords" not in result:
                raise ValueError("Missing required fields in response")
            
            # Ensure keywords is a list
            if not isinstance(result["keywords"], list):
                result["keywords"] = []
            
            return result
            
        except Exception as e:
            print(f"⚠️ Optimized query processing error: {e}. Falling back to original.")
            return {
                "rewritten_query": query,
                "keywords": []
            }

    def extract_keywords(self, query: str) -> list:
        """
        Extracts important keywords/entities from the query using AI.
        These keywords will be used for deterministic Cypher query building.
        """
        prompt = f"""
        You are a keyword extraction system. Extract the most important entities and concepts from the query.
        
        Rules:
        1. Extract proper nouns (names, places, companies, etc.)
        2. Extract significant common nouns (job titles, hobbies, objects, etc.)
        3. Return keywords in Title Case format (e.g., "Zayeem", "Ohio", "Guitar")
        4. Return ONLY a JSON array of strings, nothing else
        5. If no meaningful keywords, return empty array []
        
        Examples:
        Query: "Where does Zayeem live?"
        Output: ["Zayeem"]
        
        Query: "What hobbies does he have?"
        Output: []
        
        Query: "Tell me about Alice's job at Google"
        Output: ["Alice", "Google"]
        
        Query: "{query}"
        
        Output:"""

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={
                    "response_mime_type": "application/json"
                }
            )
            
            keywords = json.loads(response.text.strip())
            
            # Validate it's a list
            if not isinstance(keywords, list):
                return []
            
            # Filter out empty strings and return
            return [k.strip() for k in keywords if k and k.strip()]
            
        except Exception as e:
            print(f"⚠️ Keyword Extraction Error: {e}. Returning empty list.")
            return []

    def build_secure_cypher_query(self, keywords: list) -> str:
        """
        Builds a deterministic, secure Cypher query with hardcoded security filters.
        Uses TWO-HOP SEARCH for better connectivity (finds nodes up to 2 steps away).
        
        This function is MATHEMATICALLY IMPOSSIBLE to leak data because:
        1. The security filter is hardcoded in Python (not AI-generated)
        2. The session_id check is always present on ALL nodes in the path
        3. Keywords are passed as parameters, not interpolated as strings
        4. The query structure is FIXED and cannot be manipulated by AI
        """
        if not keywords:
            # If no keywords, return a broad query that shows recent activity
            # Use variable-length path [*1..2] for two-hop connectivity
            return """
            MATCH path = (n)-[*1..2]-(m)
            WHERE ALL(node IN nodes(path) WHERE node.session_id = 'global' OR node.session_id = $session_id)
            WITH n, m, relationships(path) as rels, n.created_at as created
            RETURN DISTINCT n.name as entity1, 
                   [r IN rels | type(r)] as relationships, 
                   m.name as entity2
            ORDER BY created DESC
            LIMIT 20
            """
        
        # THE SECURITY FIX + TWO-HOP SEARCH (with semantic priority)
        # MATCH (n)-[*1..2]-(m) finds paths of length 1 OR 2
        # This means if Guitar -> Hobby -> Zayeem, we'll find it!
        # ALL(node IN nodes(path) ...) ensures EVERY node in the path is security-checked
        # ORDER BY path length to prioritize direct connections
        query = """
        MATCH path = (n)-[*1..2]-(m)
        WHERE (
            ANY(kw IN $keywords WHERE toLower(n.name) CONTAINS toLower(kw))
            OR ANY(kw IN $keywords WHERE toLower(m.name) CONTAINS toLower(kw))
        )
        AND ALL(node IN nodes(path) WHERE node.session_id = 'global' OR node.session_id = $session_id)
        WITH n, m, relationships(path) as rels, length(path) as path_length
        ORDER BY path_length ASC
        RETURN DISTINCT n.name as entity1, 
               [r IN rels | type(r)] as relationships, 
               m.name as entity2,
               path_length
        LIMIT 20
        """
        
        return query


# Global embedding service instance
embedding_service = EmbeddingService()
