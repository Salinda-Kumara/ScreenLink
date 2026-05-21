# ScreenLink

<p align="center">
  <strong>Seamless screen collaboration and secure file exchange.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows-0078D6?logo=windows" alt="Platform">
  <img src="https://img.shields.io/badge/electron-33.x-47848F?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

---

## 📖 About

ScreenLink is a desktop application built with Electron that enables real-time screen mirroring, camera sharing, and secure peer-to-peer file transfer across devices on the same local network. No internet connection required — everything stays on your LAN.

**© 2026 Salinda Wickramasinghe** • Dev@Salinda v1.0

---

## ✨ Features

- **Screen Mirroring** — Cast your entire screen or individual windows to other devices in real-time via WebRTC
- **Camera Sharing** — Mirror your webcam feed to connected peers
- **File Transfer** — Send and receive files securely over a direct P2P connection
- **LAN Device Discovery** — Automatically finds other ScreenLink instances on the same Wi-Fi/network via UDP broadcast
- **Room Code System** — Connect devices using simple 6-digit room codes
- **Mini Widget Overlay** — Floating widget on the sharer's screen to stop/pause sharing (invisible to receivers)
- **Fullscreen Receive** — Receiver screen auto-enters fullscreen when a cast starts
- **Media Gallery** — Browse and manage received files
- **Custom Themes** — Multiple accent color themes (Purple, Emerald, Rose, Cyber)
- **Frameless UI** — Custom dark-mode design with glassmorphism effects

---

## 🏗️ Project Structure

```
ScreenLink/
├── main.js                          # Electron main process
├── preload.js                       # Context bridge (IPC API)
├── package.json                     # App config & dependencies
├── assets/
│   └── icon.png                     # App icon
├── src/
│   ├── server/
│   │   ├── signaling.js             # Socket.io signaling server
│   │   └── discovery.js             # UDP LAN device discovery
│   └── renderer/
│       ├── index.html               # App shell
│       ├── mini-widget.html         # Floating overlay widget
│       ├── app.js                   # App bootstrap & router
│       ├── components/
│       │   ├── sidebar.js           # Navigation sidebar
│       │   ├── titlebar.js          # Custom frameless titlebar
│       │   ├── toast.js             # Toast notifications
│       │   ├── modal.js             # Modal dialogs
│       │   ├── device-card.js       # Device card component
│       │   └── annotation-canvas.js # Screen annotation overlay
│       ├── pages/
│       │   ├── dashboard.js         # Home dashboard
│       │   ├── mirror.js            # Screen mirroring (share/receive)
│       │   ├── devices.js           # Nearby devices list
│       │   ├── file-transfer.js     # File send/receive
│       │   ├── camera.js            # Camera sharing
│       │   ├── gallery.js           # Received media gallery
│       │   └── settings.js          # App settings & about
│       ├── services/
│       │   ├── device.js            # Device management service
│       │   ├── socket.js            # Socket.io client service
│       │   ├── webrtc.js            # WebRTC peer connection manager
│       │   └── file-transfer.js     # File transfer service
│       └── styles/
│           ├── index.css            # Complete design system
│           └── animations.css       # Micro-animations & transitions
└── dist/                            # Build output (gitignored)
```

---

## 🚀 Prerequisites

Before building, make sure you have the following installed:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | 18.x or higher | [nodejs.org](https://nodejs.org/) |
| **npm** | 9.x or higher | Comes with Node.js |
| **Git** | Latest | [git-scm.com](https://git-scm.com/) |

Verify your installations:

```bash
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
git --version     # Should show git version 2.x.x
```

---

## 📦 Build Walkthrough — Step by Step

### Step 1: Clone the Repository

```bash
git clone https://github.com/Salinda-Kumara/ScreenLink.git
cd ScreenLink
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages:
- **electron** — Desktop app framework
- **electron-builder** — Packaging & installer builder
- **express** — HTTP server for signaling
- **socket.io** / **socket.io-client** — Real-time WebSocket communication

### Step 3: Run in Development Mode (Optional)

To test the app without building an installer:

```bash
npm start
```

This launches ScreenLink directly using Electron. Great for development and debugging.

### Step 4: Build the Windows Installer (.exe)

```bash
npm run build
```

This runs `electron-builder --win` which:

1. Rebuilds native dependencies for the target Electron version
2. Packages the app into `dist/win-unpacked/` (portable version)
3. Creates the NSIS installer at `dist/ScreenLink Setup 1.0.0.exe`

> **Build output location:** `dist/ScreenLink Setup 1.0.0.exe`

### Step 5: Install & Run

1. Navigate to the `dist/` folder
2. Double-click **`ScreenLink Setup 1.0.0.exe`**
3. Follow the installer prompts
4. ScreenLink will launch automatically after installation

---

## 🎯 How to Use

### Screen Mirroring

1. Open ScreenLink on **both** devices (they must be on the same Wi-Fi network)
2. On the **receiver** device, go to **Screen Mirror → Receive Feed** and note the 6-digit room code
3. On the **sharer** device, go to **Screen Mirror → Share Screen**
4. Enter the room code and click **Connect**
5. Select the screen or window you want to share
6. Click **Cast Screen** — the receiver will auto-enter fullscreen

### File Transfer

1. Go to **File Transfer** on the sending device
2. Connect to a nearby device from the list
3. Drag & drop a file or click to browse
4. Select the target device and click **Send File**
5. The receiver will get a prompt to accept the file

### Device Discovery

- Go to **Devices Nearby** in the sidebar to see all ScreenLink instances on your network
- Devices are auto-discovered via UDP broadcast every few seconds

---

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Launch the app in development mode |
| `npm run build` | Build the Windows installer (.exe) |
| `npm run pack` | Package the app without creating an installer |

---

## 🛠️ Tech Stack

- **Electron 33** — Cross-platform desktop framework
- **WebRTC** — Peer-to-peer screen/camera/data streaming
- **Socket.io** — Real-time signaling server
- **Express** — HTTP server backbone
- **UDP Broadcast** — LAN device auto-discovery
- **Vanilla JS + CSS** — No frontend frameworks, pure performance

---

## 📋 System Requirements

- **OS:** Windows 10/11 (64-bit)
- **RAM:** 4 GB minimum
- **Network:** Wi-Fi or Ethernet (LAN connection required for device communication)
- **Ports:** 3489 (signaling), 3490 (UDP discovery) — must be open on local firewall

---

## 🔧 Troubleshooting

### Devices Cannot See Each Other / Cannot Share Screen (Firewall Issues)
If ScreenLink cannot discover other devices or connect for screen sharing, the **Windows Defender Firewall** might be blocking its required ports. You need to allow ports `3489` (TCP) and `3490` (UDP) through the firewall on **both** devices.

**How to fix via PowerShell (Run as Administrator):**
```powershell
New-NetFirewallRule -DisplayName "ScreenLink Signaling (TCP)" -Direction Inbound -LocalPort 3489 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "ScreenLink Discovery (UDP)" -Direction Inbound -LocalPort 3490 -Protocol UDP -Action Allow
```

**How to fix manually:**
1. Open the Start Menu and search for **Windows Defender Firewall with Advanced Security**.
2. Click **Inbound Rules** on the left panel.
3. Click **New Rule...** on the right panel.
4. Select **Port** and click Next.
5. Select **TCP**, enter `3489` in "Specific local ports", and click Next.
6. Allow the connection, check all network profiles (Domain, Private, Public), and name it "ScreenLink TCP".
7. Repeat steps 3-6, but select **UDP**, enter `3490`, and name it "ScreenLink UDP".
8. Restart ScreenLink on both devices.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with ❤️ by <a href="https://www.linkedin.com/in/salinda-kumara/">Salinda Wickramasinghe</a></strong>
</p>
