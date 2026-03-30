# ManagePage Chat Redesign

## Spec (confirmed via /design-shotgun)

- iMessage chat bubbles: user right (coral), AI left (sand)
- Quote reply for threading (Telegram style)
- Floating pill toggle: 修改 / 提問
- Textarea: 1→5 lines, grow upward
- No quick reply chips
- Newest at bottom, auto-scroll to bottom, scroll up for history
- Desktop: left sidebar (trip list) + right chat
- Mobile: full-screen chat, no sidebar
- Logo: Caveat italic

## Changes to ManagePage.tsx

1. Remove SCOPED_STYLES (move to Tailwind classes)
2. RequestItem → ChatBubble (user bubble right, AI reply left with quote)
3. Input bar: floating toggle pills above pill-shaped textarea
4. Auto-scroll to bottom on load + new message
5. Desktop: flex layout with sidebar
6. Textarea auto-grow upward (max 5 lines)
