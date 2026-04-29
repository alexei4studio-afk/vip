import os
import json
import subprocess
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='admin')
CORS(app)

CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'public', 'config.json')

@app.route('/')
def admin_ui():
    return send_from_directory('admin', 'index.html')

@app.route('/api/config', methods=['GET'])
def get_config():
    if not os.path.exists(CONFIG_PATH):
        return jsonify({"error": "Config file not found"}), 404
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/config', methods=['POST'])
def save_config():
    try:
        data = request.json
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return jsonify({"message": "Config saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/start', methods=['POST'])
def start_scraping():
    try:
        # Start scrape.py in the background
        subprocess.Popen(['python', 'scrape.py'], 
                         cwd=os.path.dirname(__file__))
        return jsonify({"message": "Scraping started in background"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Admin Dashboard on http://localhost:5000")
    app.run(port=5000, debug=True)
