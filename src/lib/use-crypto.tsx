"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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
} from "./e2e-crypto";

// ============================================================================
// Types
// ============================================================================

interface CryptoContextType {
  // State
  isUnlocked: boolean;
  isLoading: boolean;
  cryptoSupported: boolean;
  missingFeatures: string[];

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
export function CryptoProvider({ children }: CryptoProviderProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cryptoSupported, setCryptoSupported] = useState(true);
  const [missingFeatures, setMissingFeatures] = useState<string[]>([]);

  // Check crypto support on mount
  useEffect(() => {
    const check = checkCryptoSupport();
    setCryptoSupported(check.supported);
    setMissingFeatures(check.missing);
    setIsLoading(false);
  }, []);

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
    setIsUnlocked(false);
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

  const value: CryptoContextType = {
    isUnlocked,
    isLoading,
    cryptoSupported,
    missingFeatures,
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
