# AI Shop Builder — Streaming Chat & 3-Tier Memory

## Architecture Overview

The AI Shop Builder uses a **3-tier LangChain-inspired memory system** to keep the agent context-aware across long conversations without burning token budget.

```
┌────────────────────────────────────────────────────────────────────┐
│  Tier 1 – Buffer Memory  (short-term, in-context)                  │
│    Last 10 raw messages. Sent verbatim to the model every turn.    │
├────────────────────────────────────────────────────────────────────┤
│  Tier 2 – Summary Memory  (medium-term)                            │
│    AI-compressed summary of messages older than the buffer.        │
│    Injected into the system prompt — cheap, lossless context.      │
├────────────────────────────────────────────────────────────────────┤
│  Tier 3 – Entity Memory  (long-term, structured)                   │
│    Key-value facts extracted automatically:                        │
│    colors, font, layout, hero text, product categories, style.     │
│    Always present in the system prompt — never lost.               │
└────────────────────────────────────────────────────────────────────┘
```

When the buffer overflows (> 10 messages), a background compression call:
1. **Summarizes** the old messages into a paragraph
2. **Extracts** entities into a structured JSON object
3. **Merges** the new data with previously known facts
4. **Trims** the buffer back to the 10 most recent messages

---

## Endpoints

### `POST /api/user/shop/ai/chat` — Standard (non-streaming)

Waits for the full AI response and returns it as JSON. Best for simple integrations.

**Request**
```json
{ "message": "Make my shop look clean and minimalist, use white and teal." }
```

**Response**
```json
{
  "status": true,
  "message": "AI response",
  "data": {
    "reply": "Great choice! I'll update the theme to a clean minimalist look...\n```json\n{\"action\":\"update_theme\",\"theme_config\":{\"primaryColor\":\"#008080\",\"accentColor\":\"#ffffff\"}}\n```",
    "action": { "action": "update_theme", "theme_config": { "primaryColor": "#008080" } },
    "conversation_id": "abc-123"
  }
}
```

---

### `POST /api/user/shop/ai/chat/stream` — **SSE Streaming** ⚡

Returns a `text/event-stream` response. Tokens are pushed as they're generated — perfect for a ChatGPT-style animated UI.

**Headers sent by server**
```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

**SSE Event types**

| Event type | Payload | Description |
|---|---|---|
| `token` | `{ "type": "token", "content": "..." }` | One chunk of generated text |
| `action` | `{ "type": "action", "action": { ... } }` | AI returned a JSON action (theme update etc.) |
| `done` | `{ "type": "done", "conversation_id": "..." }` | Stream complete |
| `error` | `{ "type": "error", "message": "..." }` | Something failed |

---

## Frontend Integration Examples

### React — Fetch Streaming (recommended)

```tsx
import { useState, useRef } from 'react'

function AiShopChat({ token }: { token: string }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setStreaming(true)

    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/user/shop/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMsg }),
      })

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          if (!event.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(event.slice(6))

            if (parsed.type === 'token') {
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + parsed.content,
                }
                return updated
              })
            }

            if (parsed.type === 'action') {
              console.log('AI applied action:', parsed.action)
              // e.g. refresh shop theme preview
            }

            if (parsed.type === 'done' || parsed.type === 'error') break
          } catch {
            // malformed event — skip
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Sorry, something went wrong.' },
      ])
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            {m.content || (streaming && m.role === 'assistant' ? '▌' : '')}
          </div>
        ))}
      </div>
      <div className="input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Describe how you want your shop to look..."
          disabled={streaming}
        />
        <button onClick={sendMessage} disabled={streaming}>
          {streaming ? 'Building...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
```

### Vanilla JS

```js
async function streamChat(token, message, onToken, onDone) {
  const res = await fetch('/api/user/shop/ai/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.startsWith('data: ')) continue
      const evt = JSON.parse(part.slice(6))
      if (evt.type === 'token') onToken(evt.content)
      if (evt.type === 'done') onDone(evt.conversation_id)
    }
  }
}

// Usage:
let replyEl = document.getElementById('reply')
streamChat(
  myToken,
  'Make the hero section bold and inspiring.',
  (token) => { replyEl.textContent += token },
  (id) => { console.log('Done. Conversation:', id) }
)
```

---

### `GET /api/user/shop/ai/history` — Conversation History

Returns the current buffer, summary, and entity memory.

```json
{
  "status": true,
  "data": {
    "messages": [
      { "role": "user", "content": "Make my shop look modern" },
      { "role": "assistant", "content": "Sure! I'll apply a modern theme..." }
    ],
    "summary_memory": "The merchant wants a modern minimalist shop with teal as the primary color. They have 3 products in the apparel category.",
    "entity_memory": {
      "primaryColor": "#008080",
      "layout": "grid",
      "styleKeywords": ["modern", "minimalist"],
      "productCategories": ["apparel"]
    }
  }
}
```

### `DELETE /api/user/shop/ai/memory` — Reset All Memory

Clears buffer, summary, and entity memory. The shop itself is untouched.

---

## CSS Hint — Typing Cursor Animation

Add this to your stylesheet to animate the streaming cursor:

```css
.message.assistant.streaming::after {
  content: '▌';
  animation: blink 1s step-start infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}
```
