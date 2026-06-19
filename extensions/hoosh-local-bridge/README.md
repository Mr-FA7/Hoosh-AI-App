# Hoosh Local Bridge (browser extension)

Connects **https://aihoosh.com** to the Hoosh **companion** running on your computer.

## What it enables

- Open/create projects on your real disk
- Terminal, file read/write, agents
- Ollama, LM Studio, Alma, and other local model backends

Nothing is uploaded to Firebase — traffic goes **browser → extension → localhost:3001**.

## 1. Run companion on your computer

From the Hoosh-AI-App repo:

```bash
npm install
npm run bridge
```

Keep that terminal open. Companion listens on **http://127.0.0.1:3001**.

## 2. Install this extension (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. **Load unpacked** → select this folder (`extensions/hoosh-local-bridge`)
4. Pin **Hoosh Local Bridge**

## 3. Open aihoosh.com

In the project screen, use **Connect to computer**. Status should show **Connected**.

## Troubleshooting

- Companion not running → run `npm run bridge`
- Extension not loaded → reload extension after updates
- Still disconnected → refresh aihoosh.com (Ctrl+Shift+R)
