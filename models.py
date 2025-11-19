from pydantic import BaseModel

class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    success: bool
    text: str
    embedding_dimension: int
    node_id: int

class EmbeddingInfo(BaseModel):
    id: int
    text: str
    created_at: str

class EmbeddingsResponse(BaseModel):
    success: bool
    count: int
    embeddings: list[EmbeddingInfo]

class HealthResponse(BaseModel):
    status: str
    neo4j: str
    gemini: str

class SearchHit(BaseModel):
    id: int
    text: str
    created_at: str
    score: float

class SearchResponse(BaseModel):
    success: bool
    query: str
    count: int
    hits: list[SearchHit]

class AddFactRequest(BaseModel):
    text: str

class GraphNode(BaseModel):
    id: str
    element_id: str
    name: str

class GraphEdge(BaseModel):
    from_: str
    to: str
    type: str
    element_id: str
    
    class Config:
        populate_by_name = True
        fields = {'from_': 'from'}

class AddFactResponse(BaseModel):
    success: bool
    text: str
    nodes_created: int
    edges_created: int
    graph_data: dict
    nodes: list[GraphNode]
    edges: list[GraphEdge]

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    session_id: str = None

class ChatResponse(BaseModel):
    success: bool
    action: str  # 'add_fact' or 'ask_question'
    response: str
    details: dict = None