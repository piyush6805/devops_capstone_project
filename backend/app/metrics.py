"""Prometheus ASGI instrumentation with bounded route labels and no legacy Starlette dependency."""
from time import perf_counter
from fastapi import Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

requests = Counter("http_requests", "HTTP requests", ["method", "handler", "status"])
duration = Histogram("http_request_duration_seconds", "HTTP response latency", ["method", "handler"])


class MetricsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] in {"/health", "/ready", "/metrics"}:
            return await self.app(scope, receive, send)
        started = perf_counter()
        status = 500

        async def tracked_send(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, tracked_send)
        finally:
            handler = getattr(scope.get("route"), "path", "unmatched")
            requests.labels(scope["method"], handler, f"{status // 100}xx").inc()
            duration.labels(scope["method"], handler).observe(perf_counter() - started)


def metrics_response():
    return Response(generate_latest(), headers={"Content-Type": CONTENT_TYPE_LATEST})
