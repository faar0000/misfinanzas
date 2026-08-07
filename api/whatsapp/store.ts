export interface StoredWhatsAppTransaction {
  id: string;
  phone: string;
  rawMessage: string;
  transaction: any;
  createdAt: string;
}

// Memory store using globalThis to persist across hot serverless invocations in Node
const globalStore = globalThis as unknown as {
  _waTransactionsStore?: StoredWhatsAppTransaction[];
};

if (!globalStore._waTransactionsStore) {
  globalStore._waTransactionsStore = [];
}

export function saveWhatsAppTransaction(item: StoredWhatsAppTransaction) {
  if (!globalStore._waTransactionsStore) {
    globalStore._waTransactionsStore = [];
  }
  // Prevent duplicates by ID
  const exists = globalStore._waTransactionsStore.some((t) => t.id === item.id);
  if (!exists) {
    globalStore._waTransactionsStore.unshift(item);
    // Keep max 100 recent transactions
    if (globalStore._waTransactionsStore.length > 100) {
      globalStore._waTransactionsStore = globalStore._waTransactionsStore.slice(0, 100);
    }
  }
}

export function getWhatsAppTransactions(): StoredWhatsAppTransaction[] {
  return globalStore._waTransactionsStore || [];
}
