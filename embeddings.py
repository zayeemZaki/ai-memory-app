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
            model="gemini-2.0-flash-exp", contents=prompt
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
        """
        Converts a natural language question into a Cypher query using Gemini.
        """
        # 1. Define the schema (The "Map")
        if not schema_context:
            schema_context = """
            Schema:
            - Nodes: labelled dynamically (e.g., Person, Company, Location, Concept)
            - Relationships: defined dynamically based on the text (e.g., WORKS_AT, WORKED_AT, LOCATED_IN, CREATED_BY, etc.)
            - Common properties: 'name' (string), 'id' (string)
            - Relationship types can be present or past tense depending on the stored fact
            """

        # 2. The Prompt
        prompt = f"""
        You are a Neo4j Cypher Query Expert. Convert the user's question into a Cypher query.
        
        CRITICAL: You must ONLY use the Node Labels and Relationship Types defined in the schema below. 
        Do not invent new relationship types. If a user asks "Where does he live", look for 'LIVES_IN', 'RESIDES_AT', etc. in the schema and use the closest match.

        {schema_context}

        Question: "{question}"
        
        Rules:
        1. Use 'MATCH' to find patterns.
        2. WHERE clause: Always use 'toLower(n.name) CONTAINS "value"' for flexible matching.
        3. RETURN the specific answer (e.g., the node's name), not the whole node.
        4. Return ONLY the raw Cypher string.
        
        Cypher Query:
        """

        response = self.client.models.generate_content(
            model="gemini-2.0-flash-exp", contents=prompt
        )

        # Clean the response (remove ```cypher ... ``` if Gemini adds it)
        query = response.text.strip()
        if query.startswith("```"):
            query = query.split("\n", 1)[1]
            if query.endswith("```"):
                query = query.rsplit("\n", 1)[0]

        return query.strip()

    def classify_message_intent(self, message: str) -> dict:
        """
        Classify whether a message is adding a fact or asking a question.
        """
        prompt = f"""You are a message classifier. Determine if the user is:
1. Adding a fact/statement (e.g., "Alice works at Google", "Bob lives in NYC")
2. Asking a question (e.g., "Where does Alice work?", "Who works at Google?")

Return ONLY valid JSON in this format:
{{
    "intent": "add_fact" or "ask_question",
    "confidence": 0.0 to 1.0
}}

Message: "{message}"

JSON:"""

        response = self.client.models.generate_content(
            model="gemini-2.0-flash-exp", contents=prompt
        )

        response_text = response.text.strip()

        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]

        if response_text.endswith("```"):
            response_text = response_text[:-3]

        response_text = response_text.strip()

        return json.loads(response_text)

    def format_query_results(self, question: str, results: list) -> str:
        """
        Format query results into a natural language response.
        """
        if not results:
            return "I couldn't find any information about that."

        prompt = f"""You are a helpful assistant. Format these database results into a natural, conversational answer.

Question: "{question}"

Results: {json.dumps(results, indent=2)}

Rules:
1. Give a direct, conversational answer
2. Don't mention "database" or "query"
3. If multiple results, list them naturally
4. Be concise but friendly
5. If the result is a simple value, just state it directly

Answer:"""

        response = self.client.models.generate_content(
            model="gemini-2.0-flash-exp", contents=prompt
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
            model="gemini-2.0-flash-exp", contents=prompt
        )

        return response.text.strip()


# Global embedding service instance
embedding_service = EmbeddingService()
