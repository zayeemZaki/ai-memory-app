# AI Second Brain (GraphRAG Memory System)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11-blue.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)
![Neo4j](https://img.shields.io/badge/neo4j-5-green.svg)
![Gemini](https://img.shields.io/badge/AI-Gemini%202.5-purple)

Most LLMs have amnesia—they forget context the moment a session ends, or they hallucinate facts when you ask simple questions.

I built AI Second Brain to solve this. It is a full-stack GraphRAG (Graph Retrieval-Augmented Generation) application that gives AI a long-term, structured memory. Unlike standard RAG which just matches similar words, this system builds a Knowledge Graph to understand the relationships between entities (e.g., "Zayeem" -> DEVELOPED -> "This Project").

Live Demo: [https://ai-memory-app.vercel.app/]

## System Architecture

I designed the system to be deterministic and secure. Instead of letting the AI write database queries (which is prone to injection attacks and errors), I built a Python-based query builder that enforces strict security filters.

![Architecture Diagram](client/public/architecture.png)

## Key Engineering Features

### 1. GraphRAG over Vector RAG
Standard vector search is fuzzy. If you ask "Who worked on React?", a vector search might return anyone who mentioned React. My system uses Graph Traversal, so it only returns nodes explicitly connected via a WORKS_ON relationship.

### 2. The Session Sandbox (Row-Level Security)
I wanted this to be a public demo, but I did not want strangers messing up my verified data. I implemented a Session Layering System:
* Global Layer: Verified facts (like my resume) are visible to everyone.
* Session Layer: When you visit the site, you get a unique session_id. You can add facts, and they overlay on top of the global graph.
* The Magic: Your changes are visible only to you. If you refresh or if another user visits, they see a clean slate.

### 3. Hybrid Intent Classification
Pure AI classifiers are slow and expensive. I built a 2-Stage Intent Engine:
* Layer 1 (Speed Gate): Regex and grammar rules catch 90% of inputs instantly.
* Layer 2 (Reasoning): Complex inputs go to Gemini 2.5, which uses Chain-of-Thought reasoning to decide if the user is stating a fact or asking a question.

### 4. Data Normalization Pipeline
To prevent graph fragmentation (e.g., "Ohio" vs "ohio" becoming two different nodes), the ingestion pipeline enforces strict data governance:
* IDs: Converted to snake_case (machine-readable).
* Labels: Converted to Title Case (human-readable).
* Relationships: Converted to SCREAMING_SNAKE_CASE.

## Tech Stack

* Frontend: React 18, Vite, react-force-graph-2d
* Backend: FastAPI, Pydantic, Python 3.11
* AI Model: Google Gemini 2.5 Flash (via google-genai SDK)
* Database: Neo4j AuraDB (Cloud Graph Database)
* Infrastructure: Vercel (Frontend), Render (Backend)

## How to Run Locally

### 1. Clone the Repository

```bash
git clone https://github.com/zayeemZaki/ai-memory-app.git
cd ai-memory-app
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
# On Windows use `venv\Scripts\activate`
source venv/bin/activate
pip install -r requirements.txt
```

Create a .env file in /backend:

```env
GEMINI_API_KEY=your_google_ai_key
NEO4J_URI=neo4j+s://your-db-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password
NEO4J_DATABASE=neo4j
API_SECRET=my-dev-secret-123
```

Run the Server:

```bash
uvicorn app:app --reload --port 5001
```

### 3. Frontend Setup

Open a new terminal:

```bash
cd client
npm install
```

Create a .env file in /client:

```env
VITE_API_URL=http://localhost:5001
VITE_API_SECRET=my-dev-secret-123
```

Run the UI:

```bash
npm run dev
```

## Screenshot
![Screenshot](client/public/ss.png)

## Author

**Zayeem**
Software Engineer & AI Enthusiast

Built as a proof-of-concept to explore the intersection of LLMs and Knowledge Graphs. Feel free to reach out if you have questions about the architecture!
