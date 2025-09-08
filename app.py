import os
from flask import Flask, request, jsonify, render_template
from groq import Groq

app = Flask(__name__)

# API key directly in the code
api_key = "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"
client = Groq(api_key=api_key)

@app.route("/test-api")
def test_api():
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": "Say 'API is working!'"}]
        )
        return jsonify({"status": "success", "response": response.choices[0].message.content})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    user_message = data.get("message", "")
    if not user_message:
        return jsonify({"response": "⚠️ Please provide a message."})
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": user_message}]
        )
        ai_message = response.choices[0].message.content
        return jsonify({"response": ai_message})
    except Exception as e:
        # Log full error server-side, return user-friendly message
        friendly = "Sorry, something went wrong while contacting the AI service."
        # Provide hint if it's an auth issue
        error_text = str(e)
        if "invalid_api_key" in error_text or "401" in error_text:
            friendly = "Service not configured. Please check the API key on the server."
        return jsonify({"response": friendly}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)