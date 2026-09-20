import os
from pinecone import Pinecone
import cohere
from flask import current_app

_pc = None
_co = None
_index = None

def get_clients():
    global _pc, _co, _index
    if not _pc:
        api_key = os.getenv("PINECONE_API_KEY")
        if api_key:
            _pc = Pinecone(api_key=api_key)
            index_name = os.getenv("PINECONE_INDEX", "flavour-products")
            try:
                _index = _pc.Index(index_name)
            except Exception as e:
                if current_app:
                    current_app.logger.error(f"Failed to initialize Pinecone index: {e}")
                
    if not _co:
        api_key = os.getenv("COHERE_API_KEY")
        if api_key:
            _co = cohere.Client(api_key=api_key)
            
    return _pc, _index, _co

def semantic_search_products(query: str, top_k: int = 3):
    """
    Given a natural language query, returns the top_k most semantically similar products
    using Cohere for embeddings and Pinecone for vector search.
    """
    _, index, co = get_clients()
    
    if not index or not co:
        if current_app:
            current_app.logger.error("Semantic search clients not initialized.")
        return []
        
    try:
        # Generate embedding for the query
        embed_res = co.embed(
            texts=[query],
            model="embed-english-v3.0",
            input_type="search_query" # Query type
        )
        query_embedding = embed_res.embeddings[0]
        
        # Search Pinecone
        search_res = index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True
        )
        
        matches = []
        for match in search_res.matches:
            # Map Pinecone score (cosine similarity, usually 0 to 1) to a 0-100 percentage
            # Cohere cosine similarities for related items are typically >0.3
            # We'll do a simple conversion for UI display
            raw_score = match.score
            # Normalize a bit to fit into 0-100 range that UI expects
            normalized_score = max(0, min(100, round(raw_score * 100)))
            
            matches.append({
                "name": match.metadata.get("name", "Unknown Product"),
                "score": normalized_score,
                "id": match.id
            })
            
        return matches
        
    except Exception as e:
        if current_app:
            current_app.logger.error(f"Semantic search failed: {e}")
        return []

def upsert_product_to_pinecone(product_id: str, name: str):
    """Generates an embedding for a product name and upserts it to Pinecone."""
    pc, index, co = get_clients()
    if not index or not co:
        return
        
    try:
        embed_res = co.embed(
            texts=[name],
            model="embed-english-v3.0",
            input_type="search_document"
        )
        embedding = embed_res.embeddings[0]
        
        index.upsert(vectors=[{
            "id": str(product_id),
            "values": embedding,
            "metadata": {"name": name}
        }])
    except Exception as e:
        if current_app:
            current_app.logger.error(f"Failed to upsert product {product_id} to Pinecone: {e}")

def delete_product_from_pinecone(product_id: str):
    """Deletes a product vector from Pinecone."""
    pc, index, co = get_clients()
    if not index:
        return
        
    try:
        index.delete(ids=[str(product_id)])
    except Exception as e:
        if current_app:
            current_app.logger.error(f"Failed to delete product {product_id} from Pinecone: {e}")
