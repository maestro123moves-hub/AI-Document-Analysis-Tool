"""AI-powered classification, summarization, and embedding generation using Gemini."""

import logging

import google.generativeai as genai

from app.config import settings
from app.schemas.document import ClassificationResult

logger = logging.getLogger(__name__)

# Configure the Gemini SDK explicitly from the app's settings object
genai.configure(api_key=settings.GOOGLE_API_KEY)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks of whole words.

    Groups words from text.split() into chunks of `chunk_size` words with
    `overlap` words overlapping between consecutive chunks. Because grouping
    happens on whole words, no word is ever cut mid-string.
    """
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))
        # Advance by (chunk_size - overlap) words for the next chunk
        start += chunk_size - overlap
        # If the next chunk would start past the end, we're done
        if start >= len(words):
            break
    return chunks


def classify_and_summarize(text: str) -> dict:
    """Classify document type and generate summary using a single Gemini call.

    Uses structured output (response_schema=ClassificationResult) so Gemini
    is constrained to return valid, correctly-shaped JSON.

    Returns a dict with keys: document_type, confidence, summary.
    Falls back to safe defaults if the API call fails.
    """
    prompt = (
        "You are a document classification and summarization expert.\n\n"
        "Analyze the following document text and provide:\n"
        "1. document_type: classify as exactly one of: INVOICE, CONTRACT, "
        "RESUME, MEDICAL, BANK_STATEMENT, OTHER\n"
        "2. confidence: a float between 0.0 and 1.0 indicating how confident "
        "you are in the classification\n"
        "3. summary: a concise summary of the document's key content "
        "(2-4 sentences)\n\n"
        f"DOCUMENT TEXT:\n{text[:10000]}"  # Limit input to ~10k chars
    )

    try:
        # Use gemini-3.5-flash-lite which has generous free-tier quota and fast latency
        model = None
        for model_name in ("gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"):
            try:
                candidate = genai.GenerativeModel(model_name)
                response = candidate.generate_content(
                    prompt,
                    generation_config={
                        "response_mime_type": "application/json",
                        "response_schema": ClassificationResult,
                    },
                )
                break
            except Exception as model_err:
                logger.warning(f"Model {model_name} failed: {model_err}, trying next candidate")
        else:
            raise RuntimeError("All Gemini model candidates failed or quota exceeded")

        import json
        result = json.loads(response.text)
        # Validate document_type is one of our expected values
        valid_types = {"INVOICE", "CONTRACT", "RESUME", "MEDICAL", "BANK_STATEMENT", "OTHER"}
        if result.get("document_type") not in valid_types:
            result["document_type"] = "OTHER"
        return result
    except Exception as exc:
        logger.error(f"Gemini classification failed: {exc}")
        return {
            "document_type": "OTHER",
            "confidence": 0.0,
            "summary": "Summary could not be generated due to a processing error.",
        }


def embed_chunk(text: str) -> list[float]:
    """Generate an embedding vector for a single chunk of text.

    Uses the gemini-embedding-001 model with RETRIEVAL_DOCUMENT task type
    and output_dimensionality=768, returning a 768-dimensional vector.
    """
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text,
        task_type="RETRIEVAL_DOCUMENT",
        output_dimensionality=768,
    )
    return result["embedding"]


def embed_query(text: str) -> list[float]:
    """Generate an embedding vector for a search query.

    Uses the same embedding model as embed_chunk but with RETRIEVAL_QUERY
    task type — this asymmetry (RETRIEVAL_DOCUMENT for stored chunks,
    RETRIEVAL_QUERY for search queries) measurably improves retrieval quality
    even though both produce identical 768-dim vectors.
    """
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text,
        task_type="RETRIEVAL_QUERY",
        output_dimensionality=768,
    )
    return result["embedding"]


def generate_answer(question: str, context_chunks: str) -> str:
    """Generate an answer grounded in the provided context chunks.

    Makes a single Gemini call with a system prompt that constrains the model
    to answer using ONLY the provided context. Returns raw answer text.

    On any Gemini API failure, the exception propagates up — the calling
    router is responsible for converting it to a 502.
    """
    system_prompt = (
        "You are a document analysis assistant. Answer the question using "
        "ONLY the provided context below. If the answer cannot be found in "
        "the context, say so clearly and do not guess or make up information."
    )

    user_prompt = (
        f"CONTEXT:\n{context_chunks}\n\n"
        f"QUESTION:\n{question}"
    )

    # Try model candidates in the same order as classify_and_summarize
    for model_name in ("gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"):
        try:
            model = genai.GenerativeModel(
                model_name,
                system_instruction=system_prompt,
            )
            response = model.generate_content(user_prompt)
            return response.text
        except Exception as model_err:
            logger.warning(f"Model {model_name} failed for Q&A: {model_err}, trying next candidate")

    raise RuntimeError("All Gemini model candidates failed for answer generation")
