---
description: Send a message to Discord via Hermes. Usage: /dc <target> <message>
agent: hermes
subtask: true
---

Send a message to Discord using the Hermes messaging bridge.

Target format: "discord:<channel_id>" or "discord:#channel-name".

Examples:
- /dc discord:#general Hello from OpenCode!
- /dc discord:#dev-updates New build deployed

Use hermes_channels_list to discover available Discord targets if needed.
Use hermes_messages_send to deliver the message.

Message to send: $ARGUMENTS
