import os
import json
import subprocess
import threading
import time
import glob
import uuid
from urllib.parse import urlparse
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import portalocker

app = Flask(__name__, static_folder='admin')
CORS(app)

CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'public', 'config.json')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'public', 'data')
EXPORTS_DIR = os.path.join(os.path.dirname(__file__), 'exports')
REPORT_JOBS = {}


def load_config_data():
    if not os.path.exists(CONFIG_PATH):
        return {"clients": []}
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        portalocker.lock(f, portalocker.LOCK_SH)
        try:
            return json.load(f)
        finally:
            portalocker.unlock(f)


def save_config_data(data):
    with open(CONFIG_PATH, 'r+', encoding='utf-8') as f:
        portalocker.lock(f, portalocker.LOCK_EX)
        try:
            f.seek(0)
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.truncate()
        finally:
            portalocker.unlock(f)


def find_client_by_token(token, require_active=False):
    config = load_config_data()
    for client in config.get("clients", []):
        if client.get("access_token") == token:
            if require_active and not client.get("active", True):
                return None
            return client
    return None


def is_valid_manual_url(url):
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.netloc or "").lower()
    return "glovo" in host or "wolt" in host


def client_output_candidates(client):
    if client.get("type") == "national":
        base = [os.path.join(DATA_DIR, "national_business.json")]
    else:
        filename_base = (client.get("id") or client.get("name", "").lower().replace(" ", "_")).replace("client_", "")
        base = [os.path.join(DATA_DIR, f"client_{filename_base}.json")]
    manual_prefix = client.get("name", "").lower().replace(" ", "_")
    base.extend(glob.glob(os.path.join(DATA_DIR, f"manual_{manual_prefix}_*.json")))
    return base


def newest_report_timestamp(client):
    candidates = client_output_candidates(client)
    existing = [path for path in candidates if os.path.exists(path)]
    if not existing:
        return None
    return max(os.path.getmtime(path) for path in existing)


def append_job_log(token, line):
    job = REPORT_JOBS.get(token)
    if not job:
        return
    job["logs"].append(line.rstrip())
    if len(job["logs"]) > 200:
        job["logs"] = job["logs"][-200:]


def start_job_reader(token, process):
    def _reader():
        try:
            if process.stdout:
                for line in iter(process.stdout.readline, ""):
                    if not line:
                        break
                    append_job_log(token, line)
            process.wait()
            job = REPORT_JOBS.get(token)
            if job:
                job["running"] = False
                job["last_finished_at"] = time.time()
                job["exit_code"] = process.returncode
                append_job_log(token, f"[DONE] Exit code {process.returncode}")
                if process.returncode == 0:
                    archive_client_report(token)
        except Exception as err:
            append_job_log(token, f"[ERROR] {err}")

    thread = threading.Thread(target=_reader, daemon=True)
    thread.start()


def archive_client_report(token):
    client = find_client_by_token(token)
    if not client:
        return
    os.makedirs(EXPORTS_DIR, exist_ok=True)
    timestamp = int(time.time())
    archive_name = f"{token}_{timestamp}.json"
    archive_path = os.path.join(EXPORTS_DIR, archive_name)

    files = {}
    for path in client_output_candidates(client):
        if os.path.exists(path):
            key = os.path.basename(path)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    files[key] = json.load(f)
            except Exception:
                files[key] = {"error": "Nu s-a putut citi fișierul"}

    payload = {
        "client_name": client.get("name"),
        "access_token": token,
        "generated_at": timestamp,
        "files": files,
    }
    with open(archive_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)


def list_archives_for_token(token):
    os.makedirs(EXPORTS_DIR, exist_ok=True)
    pattern = os.path.join(EXPORTS_DIR, f"{token}_*.json")
    files = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    return [
        {
            "name": os.path.basename(path),
            "modified_at": os.path.getmtime(path),
        }
        for path in files
    ]

@app.route('/')
def admin_ui():
    return send_from_directory('admin', 'index.html')

@app.route('/api/config', methods=['GET'])
def get_config():
    if not os.path.exists(CONFIG_PATH):
        return jsonify({"error": "Config file not found"}), 404
    return jsonify(load_config_data())

@app.route('/api/config', methods=['POST'])
def save_config():
    try:
        data = request.json
        save_config_data(data)
        return jsonify({"message": "Config saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/start', methods=['POST'])
def start_scraping():
    try:
        payload = request.json or {}
        target_url = payload.get('target_url')
        target_name = payload.get('target_name', 'target_manual')

        cmd = ['python', 'scrape.py']
        if target_url:
            cmd.extend(['--target-url', target_url, '--target-name', target_name])

        process_env = os.environ.copy()
        process_env["PYTHONIOENCODING"] = "utf-8"
        subprocess.Popen(cmd, cwd=os.path.dirname(__file__), env=process_env)
        return jsonify({"message": "Scraping started in background", "target_url": target_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/start-client', methods=['POST'])
def start_client_scraping():
    try:
        payload = request.json or {}
        client_token = payload.get('access_token')
        force = bool(payload.get("force", False))
        if not client_token:
            return jsonify({"error": "Missing access_token"}), 400

        client = find_client_by_token(client_token, require_active=True)
        if not client:
            return jsonify({"error": "Client not found or inactive"}), 403

        invalid_sources = [url for url in client.get("sources", []) if not is_valid_manual_url(url)]
        if invalid_sources:
            return jsonify({"error": "Invalid source URLs", "invalid_sources": invalid_sources}), 400

        latest_ts = newest_report_timestamp(client)
        if latest_ts and (time.time() - latest_ts) < 30 * 60 and not force:
            return jsonify(
                {
                    "requires_confirmation": True,
                    "message": "Datele sunt recente. Sigur vrei o actualizare nouă?",
                    "last_report_at": latest_ts,
                }
            ), 200

        job = REPORT_JOBS.get(client_token)
        if job and job.get("running"):
            return jsonify({"error": "Scraping already running for this client"}), 409

        cmd = ['python', 'scrape.py', '--client-token', client_token]
        process_env = os.environ.copy()
        process_env["PYTHONIOENCODING"] = "utf-8"
        process = subprocess.Popen(
            cmd,
            cwd=os.path.dirname(__file__),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=process_env,
        )
        REPORT_JOBS[client_token] = {
            "running": True,
            "started_at": time.time(),
            "last_finished_at": None,
            "exit_code": None,
            "logs": [f"[START] Scraping started for client token {client_token}"],
            "pid": process.pid,
        }
        start_job_reader(client_token, process)
        return jsonify({"message": "Client scraping started", "access_token": client_token, "pid": process.pid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/report-status', methods=['GET'])
def report_status():
    token = request.args.get("access_token")
    if not token:
        return jsonify({"error": "Missing access_token"}), 400
    client = find_client_by_token(token, require_active=True)
    if not client:
        return jsonify({"error": "Client not found or inactive"}), 403
    job = REPORT_JOBS.get(token)
    if not job:
        return jsonify({"running": False, "logs": [], "pid": None, "exit_code": None})
    return jsonify(job)


@app.route('/api/exports', methods=['GET'])
def list_exports():
    token = request.args.get("access_token")
    if not token:
        return jsonify({"error": "Missing access_token"}), 400
    client = find_client_by_token(token, require_active=True)
    if not client:
        return jsonify({"error": "Client not found or inactive"}), 403
    return jsonify({"exports": list_archives_for_token(token)})


@app.route('/api/exports/<path:filename>', methods=['GET'])
def download_export(filename):
    token = request.args.get("access_token")
    if not token:
        return jsonify({"error": "Missing access_token"}), 400
    client = find_client_by_token(token, require_active=True)
    if not client:
        return jsonify({"error": "Client not found or inactive"}), 403
    safe_name = os.path.basename(filename)
    if not safe_name.endswith(".json"):
        return jsonify({"error": "Invalid file type"}), 400
    if not safe_name.startswith(f"{token}_"):
        return jsonify({"error": "Access denied"}), 403
    return send_from_directory(EXPORTS_DIR, safe_name, as_attachment=True)


@app.route('/api/admin/add', methods=['POST'])
def add_client():
    payload = request.json or {}
    name = (payload.get("name") or "").strip()
    token = (payload.get("access_token") or "").strip()
    glovo_url = (payload.get("glovo_url") or "").strip()
    wolt_url = (payload.get("wolt_url") or "").strip()

    if not name or not token:
        return jsonify({"error": "Name and access_token are required"}), 400

    config = load_config_data()
    for c in config.get("clients", []):
        if c.get("access_token") == token:
            return jsonify({"error": "Token already exists"}), 409

    sources = []
    for url in [glovo_url, wolt_url]:
        if url:
            if not is_valid_manual_url(url):
                return jsonify({"error": f"Invalid URL: {url}"}), 400
            sources.append(url)

    new_client = {
        "id": uuid.uuid4().hex[:8],
        "name": name,
        "access_token": token,
        "type": "local",
        "active": True,
        "sources": sources,
    }

    config.setdefault("clients", []).append(new_client)
    save_config_data(config)

    return jsonify({
        "message": "Client added",
        "client": new_client,
        "dashboard_url": f"/dashboard/{token}",
    }), 201


@app.route('/dashboard/<path:path>')
def spa_fallback(path):
    return send_from_directory('dist', 'index.html')

if __name__ == '__main__':
    print("Starting Admin Dashboard on http://localhost:5000")
    app.run(port=5000, debug=True)
