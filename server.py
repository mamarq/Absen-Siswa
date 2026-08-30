# server.py - Local multi-threaded development server with no-cache & robust Chrome support
import http.server
import http.client
import socketserver
import os
import sys

PORT = 8085

# Increase header limits to prevent 400 Bad Request from oversized localhost cookies in Chrome
http.client._MAXHEADERS = 1000

class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Force no caching across all browsers for dynamic development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        if self.path == '/sw.js' or self.path.endswith('/sw.js'):
            self.send_header('Service-Worker-Allowed', '/')
        super().end_headers()

    def guess_type(self, path):
        if path.endswith('.js'):
            return 'application/javascript; charset=utf-8'
        if path.endswith('.css'):
            return 'text/css; charset=utf-8'
        if path.endswith('manifest.json') or path.endswith('.webmanifest'):
            return 'application/manifest+json; charset=utf-8'
        if path.endswith('.svg'):
            return 'image/svg+xml'
        if path.endswith('.png'):
            return 'image/png'
        return super().guess_type(path)

    def log_message(self, format, *args):
        # Clean logging
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")
        sys.stdout.flush()

# Multi-threaded server to handle concurrent browser requests (prevent blocking)
class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print("=" * 65, flush=True)
    print(" SISTEM INFORMASI ABSENSI & JURNAL MENGAJAR - SMKN 1 BANTAENG", flush=True)
    print(f" Server lokal aktif di: http://localhost:{PORT}", flush=True)
    print(" Multi-Threaded Engine & PWA Support: AKTIF", flush=True)
    print("=" * 65, flush=True)
    
    try:
        with ThreadingHTTPServer(("", PORT), CustomHTTPHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.", flush=True)
    except Exception as e:
        print(f"Server error: {e}", flush=True)
