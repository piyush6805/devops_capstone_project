"""Bounded load against real read APIs. Run on the host, or as a cluster Job."""
import argparse
import concurrent.futures
import time
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:8080/api/products")
parser.add_argument("--host", default="stockpilot.localhost", help="Ingress Host header; avoids relying on OS resolution of .localhost")
parser.add_argument("--seconds", type=int, default=120)
parser.add_argument("--workers", type=int, default=20)
args = parser.parse_args()
if not 1 <= args.seconds <= 600 or not 1 <= args.workers <= 100:
    parser.error("seconds must be 1..600; workers must be 1..100")
deadline = time.monotonic() + args.seconds


def worker(_):
    successes = failures = 0
    while time.monotonic() < deadline:
        try:
            request = urllib.request.Request(args.url, headers={"Host": args.host} if args.host else {})
            with urllib.request.urlopen(request, timeout=5) as response:
                response.read()
                successes += 1
        except Exception:
            failures += 1
            time.sleep(0.01)
    return successes, failures


with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
    results = list(pool.map(worker, range(args.workers)))
successes, failures = map(sum, zip(*results))
print(f"Successful requests: {successes}; errors: {failures}; duration: {args.seconds}s")
raise SystemExit(1 if failures or not successes else 0)
