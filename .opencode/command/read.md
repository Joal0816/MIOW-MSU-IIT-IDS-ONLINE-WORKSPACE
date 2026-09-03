---
description: Read recent messages from a conversation. Usage: /read <session_key> [limit]
agent: hermes
subtask: true
---

Read recent messages from a specific conversation using the Hermes messaging bridge.

Use hermes_conversations_list first to find the session_key for the conversation you want to read.
Then use hermes_messages_read with the session_key to retrieve message history.

Arguments: $ARGUMENTS
