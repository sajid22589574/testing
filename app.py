import os
import openai
import logging
from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pinecone import Pinecone
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)  # Enable CORS for all routes

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per hour"]
)

# Get environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY_INDIVILLAGE")
PINECONE_INDEX = os.getenv("PINECONE_OPENAI_INDIVILLAGE")
PINECONE_NAMESPACE = os.getenv("PINECONE_NAMESPACE_INDIVILLAGE")
ROUTE_PREFIX = os.getenv("ROUTE_PREFIX", "/indivillage")
NO_CONTEXT_RESPONSE = os.getenv("NO_CONTEXT_RESPONSE_INDIVILLAGE", "I apologize, I am currently unable to provide information about Indivillage. Please try again later or contact support.")

# Initialize APIs
openai.api_key = OPENAI_API_KEY
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX)

# Load system prompt
def load_system_prompt():
    try:
        with open("prompt.txt", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "You are a helpful assistant."

SYSTEM_PROMPT = load_system_prompt()

@app.route("/")
def home():
    logger.info(f"Home page accessed from {request.remote_addr}")
    return redirect(url_for("chat"))

@app.route(ROUTE_PREFIX + "/")
def chat():
    logger.info(f"Chat page accessed from {request.remote_addr}")
    return render_template("chat.html")

@app.route('/health')
def health():
    logger.info(f"Health check accessed from {request.remote_addr}")
    return jsonify({"status": "healthy"}), 200

@app.route(ROUTE_PREFIX + "/query", methods=["POST"])
@limiter.limit("10 per minute")
def query():
    try:
        # Log the incoming request
        logger.info(f"Received query request from {request.remote_addr}")
        
        # Validate input
        if not request.is_json:
            logger.warning("Invalid content type")
            return jsonify({"error": "Content-Type must be application/json"}), 400
            
        user_question = request.json.get("question", "").strip()
        
        if not user_question:
            logger.warning("Empty question received")
            return jsonify({"error": "Question is required"}), 400
            
        if len(user_question) > 1000:  # Limit question length
            logger.warning("Question too long")
            return jsonify({"error": "Question too long"}), 400
        
        # Generate embedding for the question
        response = openai.embeddings.create(
            model="text-embedding-3-large",
            input=user_question
        )
        embedding = response.data[0].embedding
        
        # Query Pinecone for relevant documents
        query_response = index.query(
            vector=embedding,
            top_k=3,
            namespace=PINECONE_NAMESPACE,
            include_metadata=True
        )
        
        # Extract relevant text from matches
        contexts = [match["metadata"]["text"] for match in query_response["matches"] if match["score"] > 0.5]
        
        if not contexts:
            return jsonify({"answer": NO_CONTEXT_RESPONSE})
        
        # Combine contexts
        context_text = "\n\n".join(contexts)
        
        # Generate answer using OpenAI
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context: {context_text}\n\nQuestion: {user_question}"}
        ]
        
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        
        answer = response.choices[0].message.content
        
        return jsonify({"answer": answer})
    
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}", exc_info=True)
        return jsonify({"error": "An internal error occurred"}), 500

if __name__ == "__main__":
    # Try to get port from environment, with fallback to 8000
    try:
        port = int(os.getenv("PORT", 8000))
    except ValueError:
        port = 8000
    app.run(host="0.0.0.0", port=port, debug=True)