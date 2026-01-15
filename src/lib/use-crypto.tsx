"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  UserKeyPair,
  DecryptedKeyPair,
  EncryptedData,
  generateUserKeys,
  unlockUserKeys,
  lockUserKeys,
  getUserKeyPair,
  createConversationKey,
  decryptConversationKey,
  encryptMessage,
  decryptMessage,
  encryptPrayers,
  decryptPrayers,
  encryptPrayersWithCachedKey,
  decryptPrayersWithCachedKey,
  isUserUnlocked,
  reEncryptPrivateKey,
  checkCryptoSupport,
  storeDEK,
} from "./e2e-crypto";
import {
  E2EEKeys,
  setupEnvelopeEncryption,
  unwrapDEK,
  restoreWithRecoveryCode,
  rewrapDEKWithNewPassword,
  decryptRecoveryCode,
  storeDEKInSession,
  clearStoredDEK,
  importDEK,
} from "./dek-crypto";

// ============================================================================
// Types
// ============================================================================

interface CryptoContextType {
  // State
  isUnlocked: boolean;
  isLoading: boolean;
  cryptoSupported: boolean;
  missingFeatures: string[];
  migrationState: "unknown" | "legacy" | "migrating" | "upgraded" | "needs_recovery";
  needsRecoverySetup: boolean;

  // Key Management
  generateKeys: (password: string) => Promise<UserKeyPair>;
  unlock: (
    userKeys: UserKeyPair,
    password: string,
    userId: string
  ) => Promise<boolean>;
  lock: () => Promise<void>;
  getKeyPair: (
    userId: string,
    publicKeyBase64: string
  ) => Promise<DecryptedKeyPair | null>;
  changePassword: (
    currentKeys: UserKeyPair,
    oldPassword: string,
    newPassword: string
  ) => Promise<UserKeyPair>;
  checkUnlocked: (userId: string) => Promise<boolean>;

  // Conversation Encryption
  createConversation: (
    myKeyPair: DecryptedKeyPair,
    theirPublicKeyBase64: string
  ) => Promise<{ myEncryptedKey: string; theirEncryptedKey: string }>;
  getConversationKey: (
    encryptedKeyBase64: string,
    privateKey: CryptoKey
  ) => Promise<CryptoKey>;
  encryptMsg: (
    content: string,
    conversationKey: CryptoKey
  ) => Promise<EncryptedData>;
  decryptMsg: (
    encrypted: EncryptedData,
    conversationKey: CryptoKey
  ) => Promise<string>;

  // Prayer Encryption (password-based, for initial setup)
  encryptPrayerData: (
    prayers: object,
    password: string
  ) => Promise<{ encrypted: string; iv: string; salt: string }>;
  decryptPrayerData: (
    encryptedBase64: string,
    ivBase64: string,
    saltBase64: string,
    password: string
  ) => Promise<object>;

  // Prayer Encryption (cached key, for normal use)
  encryptPrayers: (
    prayers: object,
    userId: string
  ) => Promise<{ encrypted: string; iv: string }>;
  decryptPrayers: (
    encryptedBase64: string,
    ivBase64: string,
    userId: string
  ) => Promise<object>;

  // DEK / Envelope Encryption (e2ee_v2)
  setupEnvelope: (
    password: string,
    userId: string
  ) => Promise<{
    recoveryCode: string;
    e2eeKeys: Omit<E2EEKeys, "userId">;
  }>;
  unlockWithDEK: (
    e2eeKeys: E2EEKeys,
    password: string,
    userId: string
  ) => Promise<boolean>;
  restoreWithRecovery: (
    e2eeKeys: E2EEKeys,
    recoveryCode: string,
    newPassword: string,
    userId: string
  ) => Promise<Omit<E2EEKeys, "userId">>;
  getRecoveryCode: (
    e2eeKeys: E2EEKeys,
    password: string
  ) => Promise<string>;
  changePasswordWithDEK: (
    e2eeKeys: E2EEKeys,
    oldPassword: string,
    newPassword: string
  ) => Promise<Omit<E2EEKeys, "userId">>;
  setMigrationState: (state: "unknown" | "legacy" | "migrating" | "upgraded" | "needs_recovery") => void;
  setNeedsRecoverySetup: (needs: boolean) => void;
}

// ============================================================================
// Context
// ============================================================================

const CryptoContext = createContext<CryptoContextType | undefined>(undefined);

interface CryptoProviderProps {
  children: ReactNode;
}

/**
 * Provider component for E2E encryption functionality
 * Wrap your app with this to enable encryption features
 */
// Check crypto support once at module load time (safe, no side effects)
const cryptoCheck = typeof window !== "undefined" ? checkCryptoSupport() : { supported: true, missing: [] as string[] };

export function CryptoProvider({ children }: CryptoProviderProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading] = useState(false);
  const [cryptoSupported] = useState(cryptoCheck.supported);
  const [missingFeatures] = useState<string[]>(cryptoCheck.missing);
  const [migrationState, setMigrationState] = useState<
    "unknown" | "legacy" | "migrating" | "upgraded" | "needs_recovery"
  >("unknown");
  const [needsRecoverySetup, setNeedsRecoverySetup] = useState(false);

  // Generate keys for a new user
  const generateKeys = useCallback(
    async (password: string): Promise<UserKeyPair> => {
      if (!cryptoSupported) {
        throw new Error("Encryption is not supported in this browser");
      }
      return generateUserKeys(password);
    },
    [cryptoSupported]
  );

  // Unlock keys after login
  const unlock = useCallback(
    async (
      userKeys: UserKeyPair,
      password: string,
      userId: string
    ): Promise<boolean> => {
      if (!cryptoSupported) {
        throw new Error("Encryption is not supported in this browser");
      }

      const success = await unlockUserKeys(userKeys, password, userId);
      setIsUnlocked(success);
      return success;
    },
    [cryptoSupported]
  );

  // Lock keys on logout
  const lock = useCallback(async (): Promise<void> => {
    await lockUserKeys();
    await clearStoredDEK();
    setIsUnlocked(false);
    setMigrationState("unknown");
    setNeedsRecoverySetup(false);
  }, []);

  // Get decrypted key pair
  const getKeyPair = useCallback(
    async (
      userId: string,
      publicKeyBase64: string
    ): Promise<DecryptedKeyPair | null> => {
      return getUserKeyPair(userId, publicKeyBase64);
    },
    []
  );

  // Change password (re-encrypt private key)
  const changePassword = useCallback(
    async (
      currentKeys: UserKeyPair,
      oldPassword: string,
      newPassword: string
    ): Promise<UserKeyPair> => {
      return reEncryptPrivateKey(currentKeys, oldPassword, newPassword);
    },
    []
  );

  // Create a new conversation with encrypted keys
  const createConversation = useCallback(
    async (
      myKeyPair: DecryptedKeyPair,
      theirPublicKeyBase64: string
    ): Promise<{ myEncryptedKey: string; theirEncryptedKey: string }> => {
      return createConversationKey(myKeyPair, theirPublicKeyBase64);
    },
    []
  );

  // Get a conversation's encryption key
  const getConversationKey = useCallback(
    async (
      encryptedKeyBase64: string,
      privateKey: CryptoKey
    ): Promise<CryptoKey> => {
      return decryptConversationKey(encryptedKeyBase64, privateKey);
    },
    []
  );

  // Encrypt a message
  const encryptMsg = useCallback(
    async (
      content: string,
      conversationKey: CryptoKey
    ): Promise<EncryptedData> => {
      return encryptMessage(content, conversationKey);
    },
    []
  );

  // Decrypt a message
  const decryptMsg = useCallback(
    async (
      encrypted: EncryptedData,
      conversationKey: CryptoKey
    ): Promise<string> => {
      return decryptMessage(encrypted, conversationKey);
    },
    []
  );

  // Encrypt prayers
  const encryptPrayerData = useCallback(
    async (
      prayers: object,
      password: string
    ): Promise<{ encrypted: string; iv: string; salt: string }> => {
      return encryptPrayers(prayers, password);
    },
    []
  );

  // Decrypt prayers
  const decryptPrayerData = useCallback(
    async (
      encryptedBase64: string,
      ivBase64: string,
      saltBase64: string,
      password: string
    ): Promise<object> => {
      return decryptPrayers(encryptedBase64, ivBase64, saltBase64, password);
    },
    []
  );

  // Encrypt prayers using cached key (for normal use after login)
  const encryptPrayersWithKey = useCallback(
    async (
      prayers: object,
      userId: string
    ): Promise<{ encrypted: string; iv: string }> => {
      return encryptPrayersWithCachedKey(prayers, userId);
    },
    []
  );

  // Decrypt prayers using cached key (for normal use after login)
  const decryptPrayersWithKey = useCallback(
    async (
      encryptedBase64: string,
      ivBase64: string,
      userId: string
    ): Promise<object> => {
      return decryptPrayersWithCachedKey(encryptedBase64, ivBase64, userId);
    },
    []
  );

  // Check if user's keys are unlocked
  const checkUnlocked = useCallback(
    async (userId: string): Promise<boolean> => {
      return isUserUnlocked(userId);
    },
    []
  );

  // ============================================================================
  // DEK / Envelope Encryption Methods (e2ee_v2)
  // ============================================================================

  // Set up envelope encryption for a user (generates DEK, recovery code, wrappers)
  const setupEnvelope = useCallback(
    async (
      password: string,
      userId: string
    ): Promise<{
      recoveryCode: string;
      e2eeKeys: Omit<E2EEKeys, "userId">;
    }> => {
      if (!cryptoSupported) {
        throw new Error("Encryption is not supported in this browser");
      }

      const result = await setupEnvelopeEncryption(password);

      // Store DEK in session
      await storeDEKInSession(userId, result.dek);
      
      // Also store as CryptoKey for e2e-crypto functions
      const dekKey = await importDEK(result.dek);
      await storeDEK(userId, dekKey);

      setMigrationState("upgraded");
      setNeedsRecoverySetup(false);
      setIsUnlocked(true);

      return {
        recoveryCode: result.recoveryCode,
        e2eeKeys: {
          version: 1,
          wrappedDekPassword: result.wrappedDekPassword.wrappedDek,
          passwordKdfSalt: result.wrappedDekPassword.kdfSalt,
          wrappedDekRecovery: result.wrappedDekRecovery.wrappedDek,
          recoveryKdfSalt: result.wrappedDekRecovery.kdfSalt,
          encryptedRecoveryCode: result.encryptedRecoveryCode,
          migrationState: "upgraded",
        },
      };
    },
    [cryptoSupported]
  );

  // Unlock using DEK (for upgraded users)
  const unlockWithDEK = useCallback(
    async (
      e2eeKeys: E2EEKeys,
      password: string,
      userId: string
    ): Promise<boolean> => {
      if (!cryptoSupported) {
        throw new Error("Encryption is not supported in this browser");
      }

      try {
        // Unwrap DEK using password
        const dek = await unwrapDEK(
          e2eeKeys.wrappedDekPassword,
          e2eeKeys.passwordKdfSalt,
          password,
          false
        );

        // Store DEK in session
        await storeDEKInSession(userId, dek);
        
        // Also store as CryptoKey for e2e-crypto functions
        const dekKey = await importDEK(dek);
        await storeDEK(userId, dekKey);

        setMigrationState(e2eeKeys.migrationState);
        setIsUnlocked(true);
        return true;
      } catch (error) {
        console.error("Failed to unlock with DEK:", error);
        return false;
      }
    },
    [cryptoSupported]
  );

  // Restore access after password reset using recovery code
  const restoreWithRecovery = useCallback(
    async (
      e2eeKeys: E2EEKeys,
      recoveryCode: string,
      newPassword: string,
      userId: string
    ): Promise<Omit<E2EEKeys, "userId">> => {
      if (!cryptoSupported) {
        throw new Error("Encryption is not supported in this browser");
      }

      if (!e2eeKeys.wrappedDekRecovery || !e2eeKeys.recoveryKdfSalt) {
        throw new Error("Recovery not set up for this account");
      }

      const result = await restoreWithRecoveryCode(
        e2eeKeys.wrappedDekRecovery,
        e2eeKeys.recoveryKdfSalt,
        recoveryCode,
        newPassword
      );

      // Store DEK in session
      await storeDEKInSession(userId, result.dek);
      
      // Also store as CryptoKey for e2e-crypto functions
      const dekKey = await importDEK(result.dek);
      await storeDEK(userId, dekKey);

      setMigrationState("upgraded");
      setIsUnlocked(true);

      return {
        version: e2eeKeys.version,
        wrappedDekPassword: result.wrappedDekPassword.wrappedDek,
        passwordKdfSalt: result.wrappedDekPassword.kdfSalt,
        wrappedDekRecovery: e2eeKeys.wrappedDekRecovery,
        recoveryKdfSalt: e2eeKeys.recoveryKdfSalt,
        encryptedRecoveryCode: result.encryptedRecoveryCode,
        migrationState: "upgraded",
      };
    },
    [cryptoSupported]
  );

  // Get the recovery code (requires password)
  const getRecoveryCode = useCallback(
    async (e2eeKeys: E2EEKeys, password: string): Promise<string> => {
      if (!e2eeKeys.encryptedRecoveryCode) {
        throw new Error("Recovery code not available");
      }

      return decryptRecoveryCode(
        e2eeKeys.encryptedRecoveryCode,
        password,
        e2eeKeys.passwordKdfSalt
      );
    },
    []
  );

  // Change password with DEK (re-wrap DEK, re-encrypt recovery code)
  const changePasswordWithDEK = useCallback(
    async (
      e2eeKeys: E2EEKeys,
      oldPassword: string,
      newPassword: string
    ): Promise<Omit<E2EEKeys, "userId">> => {
      if (!cryptoSupported) {
        throw new Error("Encryption is not supported in this browser");
      }

      // First, unwrap the DEK with old password
      const dek = await unwrapDEK(
        e2eeKeys.wrappedDekPassword,
        e2eeKeys.passwordKdfSalt,
        oldPassword,
        false
      );

      // Get the recovery code
      let recoveryCode: string;
      if (e2eeKeys.encryptedRecoveryCode) {
        recoveryCode = await decryptRecoveryCode(
          e2eeKeys.encryptedRecoveryCode,
          oldPassword,
          e2eeKeys.passwordKdfSalt
        );
      } else {
        throw new Error("Recovery code not available for password change");
      }

      // Re-wrap DEK and re-encrypt recovery code with new password
      const result = await rewrapDEKWithNewPassword(dek, recoveryCode, newPassword);

      return {
        version: e2eeKeys.version,
        wrappedDekPassword: result.wrappedDekPassword.wrappedDek,
        passwordKdfSalt: result.wrappedDekPassword.kdfSalt,
        wrappedDekRecovery: e2eeKeys.wrappedDekRecovery,
        recoveryKdfSalt: e2eeKeys.recoveryKdfSalt,
        encryptedRecoveryCode: result.encryptedRecoveryCode,
        migrationState: e2eeKeys.migrationState,
      };
    },
    [cryptoSupported]
  );

  const value: CryptoContextType = {
    isUnlocked,
    isLoading,
    cryptoSupported,
    missingFeatures,
    migrationState,
    needsRecoverySetup,
    generateKeys,
    unlock,
    lock,
    getKeyPair,
    changePassword,
    checkUnlocked,
    createConversation,
    getConversationKey,
    encryptMsg,
    decryptMsg,
    encryptPrayerData,
    decryptPrayerData,
    encryptPrayers: encryptPrayersWithKey,
    decryptPrayers: decryptPrayersWithKey,
    // DEK / Envelope Encryption
    setupEnvelope,
    unlockWithDEK,
    restoreWithRecovery,
    getRecoveryCode,
    changePasswordWithDEK,
    setMigrationState,
    setNeedsRecoverySetup,
  };

  return (
    <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>
  );
}

/**
 * Hook to access E2E encryption functionality
 */
export function useCrypto(): CryptoContextType {
  const context = useContext(CryptoContext);
  if (context === undefined) {
    throw new Error("useCrypto must be used within a CryptoProvider");
  }
  return context;
}

/**
 * Hook to check if encryption is available
 */
export function useCryptoSupport(): { supported: boolean; missing: string[] } {
  const { cryptoSupported, missingFeatures } = useCrypto();
  return { supported: cryptoSupported, missing: missingFeatures };
}
