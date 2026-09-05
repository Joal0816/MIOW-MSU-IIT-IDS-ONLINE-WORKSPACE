import json, os, subprocess

review = open("/tmp/review.txt").read()
title = os.environ.get("PR_TITLE", "unknown")
author = os.environ.get("PR_AUTHOR", "unknown")
url = os.environ.get("PR_URL", "#")
webhook = os.environ.get("DISCORD_WEBHOOK_URL", "")

embed = {
    "title": f"PR Review: {title}",
    "url": url,
    "description": review[:4000],
    "color": 5814783,
    "author": {"name": author},
    "footer": {"text": "Hermes Agent - Auto Review"}
}

payload = json.dumps({"embeds": [embed]})

result = subprocess.run([
    "curl", "-s", "-X", "POST", webhook,
    "-H", "Content-Type: application/json",
    "-d", payload
], capture_output=True, text=True)

print(f"Webhook response: {result.stdout[:200]}")
