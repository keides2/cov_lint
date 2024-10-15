# server.py
from flask import Flask, request
import subprocess

app = Flask(__name__)

@app.route('/ping')
def ping():
    ip = request.args.get('ip')
    # コマンドインジェクションの脆弱性がある
    result = subprocess.check_output(f"ping -c 1 {ip}", shell=True)
    return f"<pre>{result.decode('utf-8')}</pre>"

if __name__ == '__main__':
    app.run(debug=True)
