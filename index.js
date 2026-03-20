const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const axios = require("axios")
const qrcode = require("qrcode-terminal")

// ================= CONFIG =================
const TIKTOK_APIS = [
  "https://api.tiklydown.eu.org/api/download?url=",
  "https://tikapi.io/tiktok/video?url="
]

const IG_APIS = [
  "https://api.tiklydown.eu.org/api/download?url=",
  "https://save-insta.com/api/instagram?url="
]

const MAX_RETRY = 5
// ==========================================

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session")

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update
    if (connection === "close") {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        startBot()
      }
    } else if (connection === "open") {
      console.log("✅ BOT CONNECTED")
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0]
      if (!msg.message) return

      const jid = msg.key.remoteJid
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ""

      console.log("CMD:", text)

      // ================= MENU =================
      if (text === ".menu") {
        return sock.sendMessage(jid, {
          text: `
📥 BOT DOWNLOADER ANTI-ERROR

.tt <url> → TikTok no watermark
.ig <url> → Instagram video
          `
        })
      }

      // ================= DOWNLOAD FUNCTION =================
      async function downloadWithFallback(url, apiList) {
        for (let api of apiList) {
          for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
            try {
              let res = await axios.get(api + encodeURIComponent(url))
              // cek properti video
              if (res.data?.video?.noWatermark) return res.data.video.noWatermark
              if (res.data?.video) return res.data.video
            } catch (err) {
              console.log(`API error ${api} attempt ${attempt}: ${err.message}`)
            }
          }
        }
        return null
      }

      // ================= TIKTOK =================
      if (text.startsWith(".tt ")) {
        let url = text.split(" ")[1]
        let videoUrl = await downloadWithFallback(url, TIKTOK_APIS)

        if (!videoUrl)
          return sock.sendMessage(jid, { text: "❌ Vail download TikTok" })

        await sock.sendMessage(jid, {
          video: { url: videoUrl },
          caption: "✅ TikTok No Watermark"
        })
      }

      // ================= INSTAGRAM =================
      if (text.startsWith(".ig ")) {
        let url = text.split(" ")[1]
        let videoUrl = await downloadWithFallback(url, IG_APIS)

        if (!videoUrl)
          return sock.sendMessage(jid, { text: "❌ Vail download Instagram" })

        await sock.sendMessage(jid, {
          video: { url: videoUrl },
          caption: "✅ Instagram Download"
        })
      }

    } catch (err) {
      console.log("ERROR:", err.message)
    }
  })
}

startBot()