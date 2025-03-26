# Quick Implementation of the @botpress/chat SDK which uses the Botpress Chat API

This example demonstrates how to use the [@botpress/chat SDK](https://www.npmjs.com/package/@botpress/chat?ajs_aid=%24device%3A50f4e983-ecf7-45ec-a8a7-8a876f83bfa2) with [Next.js](https://nextjs.org/). It follows the documention with minimal changes:

- uses app state variables instead of constants to store client, conversation, and listener
- sends messages on demand, not just once
- collects all sent and received messages and displays them in real-time

## Getting started

1. Clone the repository
2. Run `npm install`
3. Create a local .env.local file with a webhook Id: `NEXT_PUBLIC_WEBHOOK_ID=<YOUR WEBHOOK ID>`
4. Run a local server: `npm run dev`
5. Deploy, e.g. to Vercel to run (don't forget to set the enn variables)

