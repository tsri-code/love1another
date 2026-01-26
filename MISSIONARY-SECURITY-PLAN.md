# Missionary Security Mode - Implementation Plan

> **CRITICAL**: This feature is designed to protect Christians in hostile environments where discovery could mean imprisonment, torture, or death. Every decision must prioritize user safety.

---

## Table of Contents

1. [Overview](#overview)
2. [Threat Model](#threat-model)
3. [User Flows](#user-flows)
4. [Sign-Up Flow: Missionary Mode](#sign-up-flow-missionary-mode)
5. [Settings: Ultra Security Page](#settings-ultra-security-page)
6. [Neutral Domain Setup](#neutral-domain-setup)
7. [Disguise Mode (Notes App)](#disguise-mode-notes-app)
8. [Duress Password System](#duress-password-system)
9. [Auto-Lock System](#auto-lock-system)
10. [Panic Button](#panic-button)
11. [Offline-First Mode](#offline-first-mode)
12. [PWA Configuration](#pwa-configuration)
13. [Data Wipe on Threat Detection](#data-wipe-on-threat-detection)
14. [Implementation Checklist](#implementation-checklist)

---

## Overview

### What This Protects Against

| Threat | Protection |
|--------|------------|
| Network surveillance | Neutral domain, no religious terms in URL |
| Device inspection | Disguise mode, looks like notes app |
| Forced unlock | Duress password shows fake/empty content |
| Shoulder surfing | Auto-lock after short timeout |
| Physical seizure | Panic button wipes all data instantly |
| Email tracing | No email required for signup |
| Server subpoena | No IP logging, minimal data retention |
| Inactive device found | Auto-wipe after X failed attempts |

### Key Principles

1. **No Trace** - When logged out, no evidence the app exists
2. **Plausible Deniability** - If forced to open, show innocent content
3. **Quick Escape** - One action to destroy all evidence
4. **Offline Capable** - Works without network connection
5. **Innocent Appearance** - Looks like a generic notes/productivity app

---

## Threat Model

### Adversaries

1. **State Surveillance**
   - Monitors internet traffic
   - Can see domains visited
   - May block known religious sites
   - Can demand data from companies

2. **Local Authorities**
   - May seize devices at checkpoints
   - May force users to unlock phones
   - May inspect installed apps
   - May look through browser history

3. **Informants**
   - May have physical access to device
   - May observe user over shoulder
   - May know user is Christian

### What They Can See

| Data Point | Visibility | Mitigation |
|------------|------------|------------|
| Domain name in URL | HIGH | Use neutral domain (dailynotes.app) |
| App name on home screen | HIGH | PWA named "Notes" with generic icon |
| App content when opened | MEDIUM | Disguise mode, duress password |
| Network traffic content | LOW | HTTPS + E2EE already protects |
| Signup email | MEDIUM | No email required in missionary mode |

---

## User Flows

### Flow 1: New Missionary User

```
1. User visits neutral domain (e.g., dailynotes.app)
2. Landing page looks like a generic notes app
3. User clicks "Get Started"
4. Sees tabs: [Sign In] [Create Account] [Missionary Work]
5. Clicks "Missionary Work" tab
6. Sees explanation of security features
7. Creates account with username + password only (no email)
8. Immediately shown "Complete Security Setup" prompt
9. Guided through:
   - Set duress password
   - Enable disguise mode
   - Set auto-lock timeout
   - Install as PWA
   - Enable offline mode
10. Setup complete - app is now secured
```

### Flow 2: Existing User Enables Missionary Mode

```
1. User goes to Settings
2. Sees "Ultra Security for Missionaries" option
3. Clicks to open security configuration
4. Shown warning about what this mode does
5. Configures all security features
6. Can optionally remove email from account
7. Setup complete
```

### Flow 3: Device Inspection Scenario

```
Scenario: User is stopped at checkpoint, forced to show phone

1. User opens app (shows disguise mode - looks like notes app)
2. If forced to "log in", enters duress password
3. App shows fake/empty content
4. Authorities see nothing suspicious
5. User is released
6. Later, user logs in with real password to access real content
```

### Flow 4: Panic Scenario

```
Scenario: User fears imminent device seizure

1. User triggers panic (shake device / button / keyboard shortcut)
2. All data is instantly wiped
3. Browser redirects to innocent page (Google, news site)
4. No trace remains
5. User can recreate account later (data is gone, but they're safe)
```

---

## Sign-Up Flow: Missionary Mode

### Login Page Changes

Add third tab to existing Sign In / Create Account flow:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Sign In]  [Create Account]  [Missionary Work]    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Missionary Work Tab Content

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│            🔒 Secure Account for                    │
│            High-Risk Environments                   │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  This signup method is designed for missionaries,   │
│  house church leaders, and believers in countries   │
│  where Christianity is dangerous.                   │
│                                                     │
│  ✓ No email required - no digital trail             │
│  ✓ Disguise mode - app looks like notes app         │
│  ✓ Duress password - shows fake content if forced   │
│  ✓ Panic button - instantly wipes all data          │
│  ✓ Offline mode - works without internet            │
│  ✓ Auto-lock - locks after 30 seconds               │
│                                                     │
│  ⚠️ IMPORTANT: Without an email, password reset     │
│  is impossible. Write down your recovery code       │
│  and store it safely.                               │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Username                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ @                                            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Password                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ ••••••••••••                                │   │
│  └─────────────────────────────────────────────┘   │
│  Min 12 characters for high-security accounts       │
│                                                     │
│  Confirm Password                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ ••••••••••••                                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         Create Secure Account               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Already have an account? Sign In                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### After Signup: Security Setup Wizard

Immediately after signup, show a multi-step wizard:

**Step 1: Recovery Code**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  🔑 Your Recovery Code                              │
│                                                     │
│  Since you don't have an email, this is the ONLY   │
│  way to recover your account if you forget your    │
│  password.                                          │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │   apple  banana  cherry  delta  echo  fox  │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ⚠️ Write this down on PAPER. Do not screenshot.   │
│  Do not save digitally. Memorize if possible.       │
│                                                     │
│  [ ] I have written down my recovery code           │
│                                                     │
│  [Continue →]                                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Step 2: Duress Password**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  🎭 Set Your Duress Password                        │
│                                                     │
│  A duress password shows FAKE content when you're   │
│  forced to open the app. Use it if someone demands  │
│  to see your phone.                                 │
│                                                     │
│  Example:                                           │
│  • Real password: "MySecretPrayer123"               │
│  • Duress password: "shopping2024"                  │
│                                                     │
│  When you enter the duress password, the app will   │
│  show an empty notes list with innocent content.    │
│  Your real prayers remain hidden and encrypted.     │
│                                                     │
│  Duress Password                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │                                              │   │
│  └─────────────────────────────────────────────┘   │
│  Must be different from your real password          │
│                                                     │
│  Confirm Duress Password                            │
│  ┌─────────────────────────────────────────────┐   │
│  │                                              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Continue →]                                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Step 3: Auto-Lock**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ⏱️ Auto-Lock Settings                              │
│                                                     │
│  The app will automatically lock after a period     │
│  of inactivity. Shorter times are more secure.      │
│                                                     │
│  Lock after:                                        │
│                                                     │
│  ○ 15 seconds (Recommended for high risk)           │
│  ○ 30 seconds                                       │
│  ○ 1 minute                                         │
│  ○ 5 minutes                                        │
│                                                     │
│  ☑️ Lock when switching tabs/apps                   │
│  ☑️ Lock when screen turns off                      │
│                                                     │
│  [Continue →]                                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Step 4: Disguise Mode**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  📝 Disguise Mode                                   │
│                                                     │
│  When enabled, the app looks like a simple notes    │
│  application. No religious content is visible       │
│  until you log in with your real password.          │
│                                                     │
│  Before login, anyone looking will see:             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  📝 Notes                                    │   │
│  │  ─────────────────────────────────────────  │   │
│  │  Welcome to Notes                            │   │
│  │  Your personal note-taking app               │   │
│  │                                              │   │
│  │  [Create Note]                               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ☑️ Enable Disguise Mode                            │
│                                                     │
│  [Continue →]                                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Step 5: Install as App**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  📱 Install as App                                  │
│                                                     │
│  Installing as an app hides the browser address     │
│  bar and makes it look like a native app.           │
│                                                     │
│  The app will appear as:                            │
│                                                     │
│  Icon: 📝 (generic notes icon)                      │
│  Name: "Notes"                                      │
│                                                     │
│  No religious terms. No suspicious name.            │
│                                                     │
│  [Install Now]                                      │
│                                                     │
│  Or continue in browser (less secure)               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Step 6: Panic Button**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  🚨 Panic Button                                    │
│                                                     │
│  In an emergency, you can instantly wipe all data   │
│  and evidence from this device.                     │
│                                                     │
│  Trigger methods:                                   │
│                                                     │
│  ☑️ Shake device rapidly (mobile)                   │
│  ☑️ Press Escape key 3 times quickly (desktop)      │
│  ☑️ Click panic button in corner                    │
│                                                     │
│  When triggered:                                    │
│  • All local data is deleted                        │
│  • Browser history for this site is cleared         │
│  • Redirects to Google.com                          │
│  • No trace remains                                 │
│                                                     │
│  ⚠️ This cannot be undone. All prayers will be      │
│  permanently deleted from this device.              │
│                                                     │
│  [Complete Setup]                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Step 7: Setup Complete**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ✅ Security Setup Complete                         │
│                                                     │
│  Your account is now configured for maximum         │
│  security. Here's a summary:                        │
│                                                     │
│  ✓ No email linked (no digital trail)               │
│  ✓ Recovery code saved (only way to recover)        │
│  ✓ Duress password set (shows fake content)         │
│  ✓ Auto-lock: 30 seconds                            │
│  ✓ Disguise mode: Enabled                           │
│  ✓ Panic button: Enabled                            │
│                                                     │
│  Remember:                                          │
│  • Real password → Your prayers                     │
│  • Duress password → Fake notes                     │
│  • Shake/Escape → Wipe everything                   │
│                                                     │
│  Stay safe. We're praying for you. 🙏               │
│                                                     │
│  [Start Using App]                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Settings: Ultra Security Page

### Location in Settings

```
Settings
├── Profile
├── Encryption & Recovery
├── Notifications
├── 🛡️ Ultra Security for Missionaries  ← NEW (with alert badge if incomplete)
├── Delete Account
└── Log Out
```

### Ultra Security Page Layout

```
┌─────────────────────────────────────────────────────┐
│  ← Settings                                         │
│                                                     │
│  🛡️ Ultra Security for Missionaries                 │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  These features protect you in high-risk            │
│  environments where being identified as a           │
│  Christian could be dangerous.                      │
│                                                     │
│  ═══════════════════════════════════════════════   │
│                                                     │
│  ACCOUNT SECURITY                                   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Email Linked                                │   │
│  │ your@email.com                              │   │
│  │                                             │   │
│  │ [Remove Email] ← For maximum security       │   │
│  │ Warning: Password reset will be impossible  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Duress Password                     [Set]  │   │
│  │                                             │   │
│  │ Not configured                              │   │
│  │ Shows fake content when forced to login    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ═══════════════════════════════════════════════   │
│                                                     │
│  AUTO-LOCK                                          │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Lock Timeout                                │   │
│  │                                             │   │
│  │ ○ 15 seconds                                │   │
│  │ ● 30 seconds                                │   │
│  │ ○ 1 minute                                  │   │
│  │ ○ 5 minutes                                 │   │
│  │ ○ Never (not recommended)                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ☑️ Lock when switching apps/tabs            │   │
│  │ ☑️ Lock when screen turns off               │   │
│  │ ☑️ Lock when minimized                      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ═══════════════════════════════════════════════   │
│                                                     │
│  DISGUISE MODE                                      │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Disguise Mode                    [ON/OFF]  │   │
│  │                                             │   │
│  │ When locked, app appears as a generic       │   │
│  │ notes application. No religious content.    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ═══════════════════════════════════════════════   │
│                                                     │
│  PANIC BUTTON                                       │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Panic Button                     [ON/OFF]  │   │
│  │                                             │   │
│  │ Triggers:                                   │   │
│  │ ☑️ Shake device rapidly                     │   │
│  │ ☑️ Press Escape 3x quickly                  │   │
│  │ ☑️ Show panic button in corner              │   │
│  │                                             │   │
│  │ Redirect to: [Google.com        ▼]         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ═══════════════════════════════════════════════   │
│                                                     │
│  OFFLINE MODE                                       │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Offline-First Mode               [ON/OFF]  │   │
│  │                                             │   │
│  │ All data stored locally. No network         │   │
│  │ requests. Maximum privacy but no sync.      │   │
│  │                                             │   │
│  │ ⚠️ Data only exists on this device          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ═══════════════════════════════════════════════   │
│                                                     │
│  FAIL-SAFE                                          │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Auto-Wipe on Failed Attempts     [ON/OFF]  │   │
│  │                                             │   │
│  │ Wipe all data after [5 ▼] failed passwords  │   │
│  │                                             │   │
│  │ Protects if device is found and someone     │   │
│  │ tries to guess your password.               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ═══════════════════════════════════════════════   │
│                                                     │
│  BROWSER HISTORY                                    │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Clear History on Logout          [ON/OFF]  │   │
│  │                                             │   │
│  │ Attempts to clear this site from browser    │   │
│  │ history when you log out.                   │   │
│  │                                             │   │
│  │ Note: Not 100% reliable in all browsers     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ═══════════════════════════════════════════════   │
│                                                     │
│  TEST YOUR SETUP                                    │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ [Test Duress Password]                      │   │
│  │ See what others will see if you use it      │   │
│  │                                             │   │
│  │ [Test Panic Button]                         │   │
│  │ Triggers wipe (will log you out)            │   │
│  │                                             │   │
│  │ [Preview Disguise Mode]                     │   │
│  │ See what the locked app looks like          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Neutral Domain Setup

### Domain Selection

Choose a domain that:
- Has no religious terms
- Sounds like a productivity/notes app
- Is short and forgettable
- Uses common TLD (.app, .io, .co)

**Suggested domains:**
- `dailynotes.app`
- `notesync.io`
- `quicknotes.app`
- `mynotepad.app`
- `simplenotes.co`

### DNS Configuration

```
Primary domain: love1another.com → Full app (for safe regions)
Neutral domain: dailynotes.app → Same app, disguise mode enforced
```

### Landing Page: Neutral Domain

When users visit the neutral domain (e.g., dailynotes.app):

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  📝                                                 │
│                                                     │
│  Notes                                              │
│                                                     │
│  Simple. Private. Secure.                           │
│                                                     │
│  A minimalist note-taking app with end-to-end       │
│  encryption. Your notes, your eyes only.            │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │              Get Started                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Already have an account? Sign In                   │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Features:                                          │
│                                                     │
│  🔒 End-to-end encrypted                            │
│  📴 Works offline                                   │
│  🌙 Dark mode                                       │
│  📱 Install as app                                  │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  © 2026 Notes App · Privacy · Terms                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Key differences from main domain:**
- No religious imagery or language
- No "Love1Another" branding
- Generic "Notes" branding throughout
- "Prayer" terminology replaced with "Notes"
- No verse of the day
- No Christian iconography

### Sign-In Page: Neutral Domain

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  📝 Notes                                           │
│                                                     │
│  Sign in to your notes                              │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  [Sign In]  [Create Account]                        │
│                                                     │
│  Username                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ @                                            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Password                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │                                              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │              Sign In                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Forgot password?                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Note:** On neutral domain:
- No "Missionary Work" tab visible (the whole site is already secure mode)
- No email option - username/password only
- After signup, security setup wizard runs automatically
- All branding is "Notes" not "Love1Another"

---

## Disguise Mode (Notes App)

### How It Works

When disguise mode is enabled and user is logged out:

1. **URL shows neutral domain** (if using neutral domain)
2. **Page title is "Notes"**
3. **Favicon is generic notes icon**
4. **Content appears as simple notes app**
5. **No religious content visible anywhere**

### Logged Out State (Disguise Active)

```
┌─────────────────────────────────────────────────────┐
│  📝 Notes                                     ≡    │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Welcome to Notes                                   │
│                                                     │
│  Your personal note-taking app.                     │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │              Sign In                         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  New here? Create Account                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### After Duress Password Login

When user logs in with duress password, show fake content:

```
┌─────────────────────────────────────────────────────┐
│  📝 Notes                                     ≡    │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  My Notes                                           │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📝 Shopping List                            │   │
│  │    Milk, bread, eggs                        │   │
│  │    Yesterday                                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📝 Meeting Notes                            │   │
│  │    Discuss project timeline                 │   │
│  │    2 days ago                               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 📝 Ideas                                    │   │
│  │    Learn new skill                          │   │
│  │    Last week                                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│                  [+ New Note]                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Fake content features:**
- Pre-populated with innocent, boring notes
- User can add/edit fake notes (stored separately)
- Looks completely functional
- No way to detect it's fake without real password

---

## Duress Password System

### Database Schema Addition

```sql
-- Add to users table or create new table
ALTER TABLE users ADD COLUMN duress_password_hash TEXT;
ALTER TABLE users ADD COLUMN missionary_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN auto_lock_seconds INTEGER DEFAULT 300;
ALTER TABLE users ADD COLUMN disguise_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN panic_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN offline_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN failed_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN max_failed_attempts INTEGER DEFAULT 10;
ALTER TABLE users ADD COLUMN auto_wipe_enabled BOOLEAN DEFAULT FALSE;

-- Fake notes for duress mode
CREATE TABLE fake_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Authentication Flow

```
User enters password
        │
        ▼
┌─────────────────────┐
│ Check against       │
│ duress_password     │
└─────────────────────┘
        │
   ┌────┴────┐
   │         │
 Match    No Match
   │         │
   ▼         ▼
┌─────────┐  ┌─────────────────────┐
│ Show    │  │ Check against       │
│ FAKE    │  │ real password       │
│ content │  └─────────────────────┘
└─────────┘          │
              ┌──────┴──────┐
              │             │
            Match       No Match
              │             │
              ▼             ▼
        ┌─────────┐   ┌─────────────┐
        │ Show    │   │ Increment   │
        │ REAL    │   │ failed      │
        │ content │   │ attempts    │
        └─────────┘   └─────────────┘
                            │
                            ▼
                      Check if >= max
                            │
                       ┌────┴────┐
                       │         │
                      Yes        No
                       │         │
                       ▼         ▼
                   ┌───────┐  ┌───────┐
                   │ WIPE  │  │ Show  │
                   │ DATA  │  │ error │
                   └───────┘  └───────┘
```

### Security Considerations

1. **Duress password is hashed** - stored securely like real password
2. **No indication which password was used** - to outside observer, both look the same
3. **Fake content is fully functional** - user can add/edit notes
4. **Session is marked as "duress"** - backend knows not to show real data
5. **Logout from duress clears duress session** - no trace

---

## Auto-Lock System

### Implementation

```javascript
// Global auto-lock manager
class AutoLockManager {
  private timeout: number = 30000; // 30 seconds default
  private timer: NodeJS.Timeout | null = null;
  private lockOnBlur: boolean = true;
  
  start() {
    this.resetTimer();
    
    // Lock on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.lockOnBlur) {
        this.lock();
      }
    });
    
    // Lock on blur (switching tabs/apps)
    window.addEventListener('blur', () => {
      if (this.lockOnBlur) {
        this.lock();
      }
    });
    
    // Reset timer on any activity
    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
      document.addEventListener(event, () => this.resetTimer());
    });
  }
  
  resetTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.lock(), this.timeout);
  }
  
  lock() {
    // Clear sensitive data from memory
    // Show lock screen
    // Require password to unlock
  }
}
```

### Lock Screen

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                      📝                             │
│                                                     │
│                    Locked                           │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Password                                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │              Unlock                          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Locked after 30 seconds of inactivity              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Panic Button

### Trigger Methods

1. **Mobile: Shake device rapidly** (3 shakes in 2 seconds)
2. **Desktop: Press Escape key 3 times quickly** (within 1 second)
3. **Both: Click hidden panic button** (small icon in corner)
4. **Both: Keyboard shortcut** (Ctrl/Cmd + Shift + X)

### What Happens on Panic

1. **Immediately:**
   - All localStorage cleared
   - All sessionStorage cleared
   - All IndexedDB data deleted
   - All cookies for this domain deleted
   - Service worker unregistered
   
2. **Then:**
   - Attempt to clear browser history for this site
   - Redirect to innocent URL (Google, news site)
   
3. **On server (if online):**
   - Session invalidated
   - Optional: Delete all data from server

### Visual Feedback

Brief flash of confirmation (< 500ms):
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                      ✓                              │
│                   Cleared                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Then immediate redirect to safe URL.

---

## Offline-First Mode

### How It Works

When enabled:
1. All data stored locally in encrypted IndexedDB
2. No network requests made (except initial load)
3. No sync to server
4. Data only exists on this device

### Trade-offs

| Feature | Online Mode | Offline Mode |
|---------|-------------|--------------|
| Data sync | ✓ Across devices | ✗ This device only |
| Network trace | Some | None after initial load |
| Password recovery | Via email/recovery | Recovery code only |
| Data backup | Server-side | None (user responsibility) |
| Messaging | ✓ Real-time | ✗ Not available |

### Implementation

```javascript
// Service worker intercepts all network requests
self.addEventListener('fetch', (event) => {
  if (offlineModeEnabled) {
    // Serve from cache only
    // Never make network request
    event.respondWith(caches.match(event.request));
  }
});
```

### Warning to User

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ⚠️ Offline Mode Warning                            │
│                                                     │
│  When enabled:                                      │
│  • No data backup - if device is lost, data is lost │
│  • No messaging - cannot contact other users        │
│  • No sync - changes stay on this device only       │
│                                                     │
│  This mode is only for high-risk environments       │
│  where network privacy is critical.                 │
│                                                     │
│  [Cancel]  [Enable Offline Mode]                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## PWA Configuration

### Manifest for Neutral Domain

```json
{
  "name": "Notes",
  "short_name": "Notes",
  "description": "Simple, private note-taking",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    {
      "src": "/icons/notes-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/notes-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Icon Design

- Simple notepad/pencil icon
- No religious symbols
- Generic colors (blue, gray, white)
- Indistinguishable from dozens of other note apps

---

## Data Wipe on Threat Detection

### Failed Attempt Counter

Track failed login attempts locally:

```javascript
const MAX_ATTEMPTS = 5; // configurable

function handleFailedLogin() {
  const attempts = parseInt(localStorage.getItem('failedAttempts') || '0');
  const newAttempts = attempts + 1;
  
  if (newAttempts >= MAX_ATTEMPTS) {
    // WIPE EVERYTHING
    await wipeAllData();
    window.location.href = 'https://google.com';
  } else {
    localStorage.setItem('failedAttempts', newAttempts.toString());
  }
}

function handleSuccessfulLogin() {
  localStorage.removeItem('failedAttempts');
}
```

### Wipe Function

```javascript
async function wipeAllData() {
  // 1. Clear all storage
  localStorage.clear();
  sessionStorage.clear();
  
  // 2. Clear IndexedDB
  const databases = await indexedDB.databases();
  for (const db of databases) {
    indexedDB.deleteDatabase(db.name);
  }
  
  // 3. Clear cookies
  document.cookie.split(";").forEach(cookie => {
    document.cookie = cookie
      .replace(/^ +/, "")
      .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
  });
  
  // 4. Unregister service workers
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    await registration.unregister();
  }
  
  // 5. Clear cache
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    await caches.delete(name);
  }
  
  // 6. Attempt to clear history (limited browser support)
  if (window.history && window.history.pushState) {
    window.history.pushState(null, '', '/');
  }
}
```

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create `missionary_mode` user flag in database
- [ ] Add "Missionary Work" tab to login page
- [ ] Implement no-email signup flow
- [ ] Create security setup wizard
- [ ] Add "Ultra Security for Missionaries" settings page
- [ ] Add notification badge for incomplete setup

### Phase 2: Core Security Features
- [ ] Implement duress password system
- [ ] Create fake notes storage and UI
- [ ] Implement auto-lock with configurable timeout
- [ ] Add lock screen UI
- [ ] Implement activity detection for timer reset

### Phase 3: Panic & Wipe
- [ ] Implement panic button triggers (shake, keyboard)
- [ ] Create data wipe function
- [ ] Add failed attempt counter
- [ ] Implement auto-wipe on max attempts
- [ ] Add history clearing (best effort)

### Phase 4: Disguise Mode
- [ ] Create alternate branding (Notes)
- [ ] Implement disguise mode toggle
- [ ] Create disguised lock screen
- [ ] Create disguised login page

### Phase 5: Neutral Domain
- [ ] Register neutral domain
- [ ] Configure DNS
- [ ] Create alternate manifest.json
- [ ] Create neutral landing page
- [ ] Create neutral icons
- [ ] Force disguise mode on neutral domain

### Phase 6: Offline Mode
- [ ] Implement offline data storage
- [ ] Add service worker for offline access
- [ ] Create offline mode toggle
- [ ] Add sync prevention when enabled

### Phase 7: Testing
- [ ] Test duress password flow
- [ ] Test panic button on all platforms
- [ ] Test auto-lock timing
- [ ] Test auto-wipe after failed attempts
- [ ] Test disguise mode appearance
- [ ] Test offline functionality
- [ ] Security audit

---

## Security Audit Checklist

Before releasing to missionaries:

- [ ] No religious terms in network requests
- [ ] No religious terms in local storage keys
- [ ] No religious terms in error messages
- [ ] No religious terms in console logs
- [ ] Duress content is indistinguishable from real
- [ ] Panic wipe leaves no traces
- [ ] Auto-lock cannot be bypassed
- [ ] Failed attempt counter cannot be reset by user
- [ ] Offline mode truly makes no network requests
- [ ] PWA icon/name is completely generic
- [ ] Third-party scripts don't leak information

---

## Final Notes

### What This CANNOT Protect Against

1. **Government forcing password disclosure** - Duress password helps, but sophisticated interrogation may detect lies
2. **Device forensics** - Deleted data may be recoverable by experts
3. **Targeted malware** - If device is compromised, all bets are off
4. **Network analysis over time** - Repeated access patterns could reveal usage
5. **Physical observation** - Someone watching over shoulder

### Recommendations for Users

1. Use Tor Browser when possible
2. Access only from private devices
3. Never save password in browser
4. Memorize recovery code, don't write down
5. Use panic button liberally - data can be recreated
6. Consider the duress password your "public" password
7. Tell no one about the app's true purpose

### Prayer

This feature is built for brothers and sisters facing real persecution. May it protect them, and may they know they are not forgotten by the global church.

---

*Document Version: 1.0*
*Created: January 2026*
*For: Love1Another Missionary Security Mode*
