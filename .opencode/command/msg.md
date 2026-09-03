---
description: Send a message to any platform via Hermes. Usage: /msg <platform:target> <message>
agent: hermes
subtask: true
---

Send a message to any connected messaging platform using the Hermes messaging bridge.

Target format: "platform:identifier"
Supported platforms: telegram, discord, slack, whatsapp, signal, matrix, and others.

Examples:
- /msg telegram:6308981865 Hello!
- /msg discord:#general Check this out
- /msg slack:#engineering Deploy complete

Use hermes_channels_list to discover all available channels and targets.
Use hermes_messages_send to deliver the message.

Message to send: $ARGUMENTS
