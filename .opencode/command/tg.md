---
description: Send a message to Telegram via Hermes. Usage: /tg <target> <message>
agent: hermes
subtask: true
---

Send a message to Telegram using the Hermes messaging bridge.

Target format: "telegram:<chat_id>" or a human-friendly channel name that will be resolved automatically.

Examples:
- /tg telegram:6308981865 Hello from OpenCode!
- /tg #my-group Check out this code change

Use hermes_channels_list to discover available Telegram targets if needed.
Use hermes_messages_send to deliver the message.

Message to send: $ARGUMENTS
