#!/usr/bin/env python3
"""Times Archive local server. Serves web/ and the original edition PDFs (read-only) on 127.0.0.1:4645."""
import http.server, json, os, socketserver, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, 'web')
PORT = int(os.environ.get('PORT', '4645'))

def pdf_map():
    with open(os.path.join(ROOT, 'data', 'archive.json')) as f:
        return {e['id']: e['pdf'] for e in json.load(f)['editions']}

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=WEB, **k)
    def log_message(self, *a):
        pass
    def do_GET(self):
        if self.path.startswith('/pdf/'):
            eid = self.path[5:].split('?')[0].strip('/')
            p = pdf_map().get(eid)
            if not p or not os.path.exists(p):
                return self.send_error(404)
            data = open(p, 'rb').read()
            self.send_response(200); self.send_header('Content-Type', 'application/pdf')
            self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data); return
        if self.path == '/health':
            b = b'ok'; self.send_response(200); self.send_header('Content-Length', '2'); self.end_headers(); self.wfile.write(b); return
        return super().do_GET()

class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True; allow_reuse_address = True

if __name__ == '__main__':
    with S(('127.0.0.1', PORT), H) as s:
        print(f'Times Archive on http://127.0.0.1:{PORT}', flush=True)
        s.serve_forever()
