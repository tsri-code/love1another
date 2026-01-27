# Love1Another - Prayer List App

A private, encrypted prayer list web app where you can create profiles for people you care about, track prayer requests, connect with friends, and share prayer needs through secure messaging.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Security](https://img.shields.io/badge/Security-E2E_Encrypted-green)
![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E)

## Features

### Core Functionality
- **Personal prayer profiles** - Create profiles for people you pray for
- **Prayer request tracking** - Add, edit, pin, and mark prayers as answered
- **Friend connections** - Connect with other users and share prayer requests
- **Secure messaging** - Send encrypted messages and prayer requests to friends
- **Group chats** - Create group conversations with multiple friends
- **Daily verse** - A new Bible verse (BSB) cycles daily on the home page
- **Profile verses** - Each profile displays a unique verse about prayer

### Privacy & Security
- **End-to-end encryption** - All prayer content and messages are encrypted
- **Zero-knowledge architecture** - Server cannot read your data
- **Encrypted profiles** - Profile names and initials are encrypted
- **Secure key management** - Recovery keys for account portability
- **No tracking** - Your prayer life stays private

### Social Features
- **Friend requests** - Find and connect with other users by username
- **Profile linking** - Link friend accounts to prayer profiles for automatic updates
- **Prayer sharing** - Share prayers directly via messages
- **Real-time notifications** - Get notified of new messages and friend requests

### User Experience
- **Responsive design** - Works beautifully on mobile and desktop
- **PWA support** - Install as an app on your phone
- **Dark/light themes** - Comfortable viewing in any environment
- **Offline capable** - Core features work without internet

## Quick Start

### Prerequisites
- Node.js 18+
- npm
- Supabase account (for database)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/love1another.git
cd love1another

# Install dependencies
npm install

# Set up environment variables (see below)
cp .env.example .env.local

# Start the development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Environment Variables

Create a `.env.local` file with:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Encryption
ENCRYPTION_SECRET=your_32_byte_hex_secret

# Stripe (for donations)
STRIPE_SECRET_KEY=your_stripe_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable

# Email (Brevo)
BREVO_API_KEY=your_brevo_api_key
```

### Production Build

```bash
npm run build
npm start
```

## How It Works

### Creating Your Account
1. Sign up with email or username (missionary mode)
2. Set up your encryption keys
3. Save your recovery phrase securely
4. Your "ME" profile is created automatically

### Managing Prayer Lists
1. Create profiles for people you pray for
2. Add prayer requests to each profile
3. Mark prayers as answered when God responds
4. Pin important prayers to keep them visible

### Connecting with Friends
1. Search for friends by username
2. Send friend requests
3. Link accepted friends to prayer profiles
4. Receive their prayer requests via messages

### Messaging
1. Open the messages panel
2. Start a conversation with a friend
3. Send text messages or prayer requests
4. Add received prayers to your prayer list

## Security Architecture

### Encryption Model
- **AES-256-GCM** for all encrypted content
- **Per-user encryption keys** derived from account
- **Server-side encryption** for profile data
- **Client-side decryption** for prayer content

### Data Protection
- Profile names encrypted at rest
- Avatar initials encrypted
- All messages end-to-end encrypted
- Prayer content never visible to server

### Recovery
- Recovery keys allow account restoration
- Keys can be exported and stored securely
- Password changes require recovery key re-entry

## Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   │   ├── connections/   # Friend connections
│   │   ├── conversations/ # Group chats
│   │   ├── friends/       # Friend requests
│   │   ├── messages/      # Messaging
│   │   ├── people/        # Profile management
│   │   └── users/         # User operations
│   ├── friends/           # Friends page
│   ├── settings/          # User settings
│   └── p/[id]/            # Profile pages
├── components/            # React components
│   ├── Navbar.tsx         # Navigation
│   ├── MessagesButton.tsx # Messaging UI
│   ├── PrayerCard.tsx     # Prayer display
│   └── VerseCard.tsx      # Bible verses
└── lib/                   # Utilities
    ├── e2e-crypto.ts      # Encryption
    ├── supabase-db.ts     # Database ops
    ├── verses.ts          # 66 BSB verses
    └── use-notifications.tsx
```

## Bible Verses

The app includes 66 carefully selected Bible verses about prayer from the Berean Standard Bible (BSB), which is in the public domain. Verses are:
- Displayed daily on the home page (same verse for all users each day)
- Randomly assigned to new profiles
- Focused on prayer, intercession, and God's faithfulness

## Technologies

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Encryption**: Web Crypto API + AES-256-GCM
- **Styling**: Tailwind CSS + CSS Variables
- **Email**: Brevo (transactional emails)
- **Payments**: Stripe (donations)
- **Hosting**: Vercel

## Contributing

This is a personal project for Christian prayer communities. If you'd like to contribute or have suggestions, please open an issue.

## License

Private - for personal and ministry use.

---

*"Carry each other's burdens, and in this way you will fulfill the law of Christ." - Galatians 6:2 (BSB)*
