# Love One Another - Personal Prayer List

A private, personal prayer-request web app where you can create people/groups, each with their own passcode-protected prayer lists. All prayer data is encrypted at rest and stored locally on your machine.

![Prayer List App](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Security](https://img.shields.io/badge/Security-Encrypted-green)

## Features

### Core Functionality
- 🙏 **Per-person prayer lists** - Each person/group has their own private prayer collection
- 🔐 **Passcode protection** - Every prayer list requires a passcode to access
- 🔒 **Auto-lock** - Sessions automatically lock after 5 minutes of inactivity
- 💾 **Local storage** - All data stored locally in an encrypted SQLite database
- 📖 **Bible verses** - Each person displays a unique verse about prayer/intercession

### Security
- **Encrypted at rest** - Prayer content encrypted using AES-256-GCM
- **Hashed passcodes** - Passcodes stored using Argon2id (never plaintext)
- **Rate limiting** - Protection against brute-force passcode attempts
- **Short-lived sessions** - Sessions expire after 5 minutes of inactivity
- **No sensitive data in URLs** - Prayer content never exposed in URLs or logs

### Prayer Management
- ➕ Add new prayer requests
- ✏️ Edit existing prayers
- 📌 Pin important prayers to the top
- ✅ Mark prayers as answered (moves to "Answered Prayers" section)
- ❤️ Mark when you've prayed (tracks last prayed date)
- 🗑️ Delete prayers

### UI/UX
- 📱 Responsive design for mobile and desktop
- ♿ Accessible with keyboard navigation and screen reader support
- 🎨 Warm, devotional aesthetic with calm colors and soft typography
- ⚡ Fast and smooth animations

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone or navigate to the project directory
cd love1another

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## How It Works

### Creating a Person/Group
1. Click the **+** button on the home page
2. Enter a name and choose Person or Group
3. Select an avatar color
4. Create a passcode (minimum 6 characters)
5. Your new prayer list is ready!

### Adding Prayers
1. Click on a person's avatar
2. Enter their passcode to unlock
3. Click "Add a prayer request"
4. Type your prayer and press Enter to save

### Security Design

#### Encryption Flow
1. When you create a person, your passcode is used to:
   - Generate a hash (for verification)
   - Derive an encryption key (for encrypting prayer data)
2. The encryption key is derived using Argon2id with per-person salt
3. Prayer content is encrypted with AES-256-GCM
4. Only the encrypted blob is stored - decryption requires the passcode

#### Session Management
- Unlocking creates a server-side session (5-minute expiry)
- Activity resets the session timer
- Inactivity for 5 minutes triggers automatic lock
- Sessions are invalidated on lock or tab close

#### Rate Limiting
- After 8 failed passcode attempts, a 60-second cooldown is enforced
- Prevents brute-force attacks on passcodes

## Data Storage

Data is stored locally in `.prayer-data/prayers.db` in your project directory.

### Backup
- Click "Download Backup" on the home page to export your encrypted database
- The backup file contains encrypted prayer data - safe to store externally
- To restore, replace the database file in `.prayer-data/`

### Data Location
You can customize the data directory by setting the `DATA_DIR` environment variable:

```bash
DATA_DIR=/path/to/custom/location npm run dev
```

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   │   ├── people/        # People CRUD & prayers
│   │   ├── session/       # Session management
│   │   └── backup/        # Database export
│   ├── add/               # Add person page
│   └── p/[id]/            # Person pages (gate, prayers, edit)
├── components/            # React components
│   ├── AvatarCircle.tsx   # Avatar display
│   ├── VerseCard.tsx      # Bible verse display
│   ├── PrayerCard.tsx     # Prayer item card
│   ├── AddPrayerComposer.tsx
│   ├── PasscodeInput.tsx
│   └── LockTimerBanner.tsx
└── lib/                   # Utilities
    ├── crypto.ts          # Encryption/hashing
    ├── db.ts              # Database operations
    ├── session.ts         # Session management
    └── verses.ts          # Bible verses data
```

## Threat Model

### Protected Against
- Casual access by someone using your computer
- Someone who finds the local data files (prayers are encrypted)
- Brute-force passcode attempts (rate limited)

### Not Protected Against
- Fully compromised OS/account (attacker with root access)
- Physical access with debugging tools
- Memory forensics while app is running

### Recommendations
- Use strong, memorable passcodes (phrases work well)
- Lock the app when stepping away
- Keep your computer secure (lock screen, encryption)
- Back up your data regularly

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATA_DIR` | Custom path for database storage | `.prayer-data/` |
| `NODE_ENV` | Environment (development/production) | `development` |

## Technologies Used

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **Encryption**: AES-256-GCM
- **Password Hashing**: Argon2id
- **Styling**: Tailwind CSS
- **Fonts**: Cormorant Garamond (serif), Source Sans 3 (sans)

## License

Private - for personal use.

---

*"Bear one another's burdens, and so fulfill the law of Christ." - Galatians 6:2*
