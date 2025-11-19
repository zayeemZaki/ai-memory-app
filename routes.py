from fastapi import APIRouter, HTTPException, Query, Depends
from models import (
    EmbedRequest,
    EmbedResponse,
    EmbeddingsResponse,
    EmbeddingInfo,
    HealthResponse,
    SearchHit,
    SearchResponse,
    AddFactRequest,
    AddFactResponse,
    GraphNode,
    GraphEdge,
    ChatRequest,
    ChatResponse,
)
from database import db
from embeddings import embedding_service
from security import validate_api_key

router = APIRouter(dependencies=[Depends(validate_api_key)])


@router.post("/embed", response_model=EmbedResponse, status_code=201)
async def embed_and_store(request: EmbedRequest):
    """
    POST endpoint that takes a string, generates embeddings using Gemini,
    and stores them in Neo4j.
    """
    try:
        text = request.text

        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        # Generate embeddings using Gemini
        embedding = embedding_service.generate_embedding(text)

        # Store in Neo4j
        record = db.create_embedding_node(text, embedding)

        return EmbedResponse(
            success=True,
            text=text,
            embedding_dimension=len(embedding),
            node_id=record["id"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/embeddings", response_model=EmbeddingsResponse)
async def get_embeddings():
    """Get all stored embeddings"""
    try:
        result = db.get_all_embeddings()

        embeddings = [
            EmbeddingInfo(
                id=record["id"],
                text=record["text"],
                created_at=str(record["created_at"]),
            )
            for record in result
        ]

        return EmbeddingsResponse(
            success=True, count=len(embeddings), embeddings=embeddings
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search", response_model=SearchResponse)
async def search_embeddings(
    q: str = Query(..., min_length=1), top_k: int = Query(5, ge=1, le=20)
):
    """
    GET endpoint that takes a query string, finds the most
    semantically similar embeddings from Neo4j.
    """
    try:
        # 1. Embed the search query
        query_vector = embedding_service.generate_embedding(q)

        # 2. Search the database with the vector
        results = db.search_embeddings(query_vector=query_vector, top_k=top_k)

        # 3. Format the results
        hits = [
            SearchHit(
                id=record["id"],
                text=record["text"],
                created_at=str(record["created_at"]),
                score=record["score"],
            )
            for record in results
        ]

        return SearchResponse(success=True, query=q, count=len(hits), hits=hits)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/add-fact", response_model=AddFactResponse, status_code=201)
async def add_fact(request: AddFactRequest):
    """
    POST endpoint that extracts entities and relationships from text
    and stores them as a knowledge graph in Neo4j.
    """
    try:
        text = request.text

        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        # Extract graph structure using Gemini
        graph_data = embedding_service.extract_graph_structure(text)

        # Store graph in Neo4j using MERGE to avoid duplicates
        result = db.create_graph_from_json(graph_data)

        # Format response
        nodes = [
            GraphNode(id=node["id"], element_id=node["element_id"], name=node["name"])
            for node in result["nodes"]
        ]

        edges = [
            GraphEdge(
                from_=edge["from"],
                to=edge["to"],
                type=edge["type"],
                element_id=edge["element_id"],
            )
            for edge in result["edges"]
        ]

        return AddFactResponse(
            success=True,
            text=text,
            nodes_created=result["nodes_created"],
            edges_created=result["edges_created"],
            graph_data=graph_data,
            nodes=nodes,
            edges=edges,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ask")
async def ask_question(q: str = Query(..., min_length=1)):
    """
    GET endpoint that answers natural language questions using the Knowledge Graph.
    """
    try:
        current_schema = db.get_schema()

        cypher_query = embedding_service.generate_cypher_query(q, current_schema)

        results = db.execute_cypher(cypher_query)

        return {
            "success": True,
            "question": q,
            "generated_cypher": cypher_query,
            "answer": results,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Smart Chat Endpoint: Handles both adding facts and asking questions
    with context awareness (rewriting).
    """
    try:
        message = request.message
        history = request.history

        if not message or not message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        # 1. REWRITE QUERY FIRST
        # We do this for BOTH intents so the AI understands context for adding facts too
        rewritten_message = embedding_service.rewrite_query(message, history)
        print(
            f"Original: '{message}' -> Rewritten: '{rewritten_message}'"
        )  # For debugging

        # 2. CLASSIFY INTENT (Use the rewritten message!)
        intent_result = embedding_service.classify_message_intent(rewritten_message)

        if intent_result["intent"] == "add_fact":
            graph_data = embedding_service.extract_graph_structure(rewritten_message)
            result = db.create_graph_from_json(graph_data)

            response_text = f"Got it! I've added that to your knowledge graph."
            if result["nodes_created"] > 0:
                response_text += f" Created {result['nodes_created']} entities and {result['edges_created']} relationships."

            return ChatResponse(
                success=True,
                action="add_fact",
                response=response_text,
                details={
                    "nodes_created": result["nodes_created"],
                    "edges_created": result["edges_created"],
                },
            )

        else:  # ask_question
            current_schema = db.get_schema()
            # Use REWRITTEN message to generate Cypher
            cypher_query = embedding_service.generate_cypher_query(
                rewritten_message, current_schema
            )
            results = db.execute_cypher(cypher_query)

            if results and len(results) > 0:
                # Use REWRITTEN message to format answer
                answer_text = embedding_service.format_query_results(
                    rewritten_message, results
                )
            else:
                answer_text = "I couldn't find any information about that in your knowledge graph yet."

            return ChatResponse(
                success=True,
                action="ask_question",
                response=answer_text,
                details={"cypher_query": cypher_query, "results_count": len(results)},
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph")
async def get_graph_data():
    """
    GET endpoint to fetch the graph data (nodes and edges) for visualization.
    """
    try:
        # Fetch all nodes and relationships explicitly asking for IDs
        query = """
        MATCH (n)-[r]->(m)
        RETURN elementId(n) as source_id, n.name as source_name, labels(n) as source_labels,
               elementId(m) as target_id, m.name as target_name, labels(m) as target_labels,
               elementId(r) as rel_id, type(r) as rel_type
        LIMIT 100
        """
        results = db.execute_cypher(query)

        # Format for frontend visualization
        nodes = {}
        edges = []

        for row in results:
            # Process source node
            n_id = row["source_id"]
            if n_id not in nodes:
                nodes[n_id] = {
                    "id": n_id,
                    "group": (
                        row["source_labels"][0] if row["source_labels"] else "Entity"
                    ),
                    "name": row["source_name"] or "Unknown",
                }

            # Process target node
            m_id = row["target_id"]
            if m_id not in nodes:
                nodes[m_id] = {
                    "id": m_id,
                    "group": (
                        row["target_labels"][0] if row["target_labels"] else "Entity"
                    ),
                    "name": row["target_name"] or "Unknown",
                }

            # Process relationship
            edges.append(
                {
                    "source": n_id,
                    "target": m_id,
                    "name": row["rel_type"],
                }
            )
        return {"nodes": list(nodes.values()), "links": edges}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    try:
        db.driver.verify_connectivity()
        return HealthResponse(status="healthy", neo4j="connected", gemini="configured")
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
