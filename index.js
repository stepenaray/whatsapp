const express = require("express")
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const P = require("pino")

// ================= EXPRESS (Railway no sleep) =================
const app = express()

app.get("/", (req, res) => {
  res.send("WhatsApp Bot is running")
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("Server running on port", PORT))

// ================= WHATSAPP BOT =================
async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("./session")

  const sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state
  })
// ===== you number here =====
if (!sock.authState.creds.registered) {
  const phoneNumber = "1543xxxxxxxxxx" // you number
  const code = await sock.requestPairingCode(phoneNumber)
  console.log("PAIRING CODE:", code)
}
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      console.log("connection closed, reconnecting...", shouldReconnect)
      if (shouldReconnect) {
        startBot()
      }
    } else if (connection === "open") {
      console.log("BOT WHATSAPP ONLINE")
    }
  })

  sock.ev.on("creds.update", saveCreds)

  // ================= AUTO REPLY =================
  sock.ev.on("messages.upsert", async (msg) => {
    const m = msg.messages[0]
    if (!m.message) return

    const from = m.key.remoteJid
    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      ""

    if (text.toLowerCase() === "ping") {
      await sock.sendMessage(from, { text: "pong 🟢 bot aktif" })
    }
  })
}

startBot()
