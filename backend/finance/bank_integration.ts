import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { requireRole } from "../auth/middleware";
import { financeDB } from "./db";

// Future bank API integration structure

export interface BankTransaction {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  description: string;
  date: Date;
  type: 'credit' | 'debit';
  status: 'pending' | 'completed' | 'failed';
  reference?: string;
  category?: string;
  merchantName?: string;
  balance?: number;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string; // Last 4 digits only for security
  accountType: 'checking' | 'savings' | 'business';
  balance: number;
  currency: string;
  lastSyncAt?: Date;
  isActive: boolean;
}

export interface BankSyncRequest {
  accountId?: string; // Optional: sync specific account, otherwise sync all
  startDate?: Date;
  endDate?: Date;
}

export interface BankSyncResponse {
  accountsSynced: number;
  transactionsImported: number;
  duplicatesSkipped: number;
  errors: string[];
  lastSyncAt: Date;
}

// Shared handler for syncing bank transactions
async function syncBankTransactionsHandler(req: BankSyncRequest): Promise<BankSyncResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN")(authData);

  // TODO: Implement actual bank API integration
    // This is a placeholder structure for future implementation

    throw APIError.unimplemented("Bank API integration not yet implemented. This endpoint will be available in a future update.");

    /*
    Future implementation would include:
    
    1. Bank API Configuration:
       - API credentials management
       - OAuth flow for bank authentication
       - Account linking and verification
    
    2. Transaction Import Logic:
       - Fetch transactions from bank API
       - Categorize transactions automatically
       - Match transactions with existing revenue/expense records
       - Handle duplicates and conflicts
    
    3. Reconciliation Features:
       - Compare bank transactions with recorded transactions
       - Flag discrepancies for manual review
       - Auto-match similar transactions
    
    4. Real-time Monitoring:
       - Webhook endpoints for real-time transaction updates
       - Balance monitoring and alerts
       - Automated categorization rules
    
    Example implementation structure:
    
    const { accountId, startDate, endDate } = req;
    
    try {
      // 1. Get bank API credentials for the organization
      const bankConfig = await getBankConfig(authData.orgId);
      
      // 2. Initialize bank API client
      const bankClient = new BankAPIClient(bankConfig);
      
      // 3. Fetch transactions
      const transactions = await bankClient.getTransactions({
        accountId,
        startDate,
        endDate,
      });
      
      // 4. Process and import transactions
      const importResult = await importTransactions(transactions, authData.orgId);
      
      // 5. Update sync status
      await updateLastSyncTime(authData.orgId, accountId);
      
      return {
        accountsSynced: importResult.accountsSynced,
        transactionsImported: importResult.transactionsImported,
        duplicatesSkipped: importResult.duplicatesSkipped,
        errors: importResult.errors,
        lastSyncAt: new Date(),
      };
    } catch (error) {
      console.error('Bank sync error:', error);
      throw new Error('Failed to sync bank transactions');
    }
    */
}

// LEGACY: Placeholder for future bank API integration (keep for backward compatibility)
export const syncBankTransactions = api<BankSyncRequest, BankSyncResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/sync-bank-transactions" },
  syncBankTransactionsHandler
);

// V1: Sync bank transactions
export const syncBankTransactionsV1 = api<BankSyncRequest, BankSyncResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/bank-sync" },
  syncBankTransactionsHandler
);

export interface GetBankAccountsResponse {
  accounts: BankAccount[];
}

// Shared handler for getting bank accounts
async function getBankAccountsHandler(req: {}): Promise<GetBankAccountsResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  // TODO: Implement bank account retrieval
    throw APIError.unimplemented("Bank account integration not yet implemented.");

    /*
    Future implementation:
    
    try {
      const accounts = await financeDB.queryAll`
        SELECT 
          ba.id, ba.bank_name, ba.account_number_masked, ba.account_type,
          ba.current_balance, ba.currency, ba.last_sync_at, ba.is_active
        FROM bank_accounts ba
        WHERE ba.org_id = ${authData.orgId} AND ba.is_active = true
        ORDER BY ba.bank_name, ba.account_type
      `;

      return {
        accounts: accounts.map(account => ({
          id: account.id,
          bankName: account.bank_name,
          accountNumber: account.account_number_masked,
          accountType: account.account_type,
          balance: account.current_balance,
          currency: account.currency,
          lastSyncAt: account.last_sync_at,
          isActive: account.is_active,
        })),
      };
    } catch (error) {
      console.error('Get bank accounts error:', error);
      throw new Error('Failed to fetch bank accounts');
    }
    */
}

// LEGACY: Placeholder for retrieving connected bank accounts (keep for backward compatibility)
export const getBankAccounts = api<{}, GetBankAccountsResponse>(
  { auth: true, expose: true, method: "GET", path: "/finance/bank-accounts" },
  getBankAccountsHandler
);

// V1: Get bank accounts
export const getBankAccountsV1 = api<{}, GetBankAccountsResponse>(
  { auth: true, expose: true, method: "GET", path: "/v1/finance/bank-accounts" },
  getBankAccountsHandler
);

export interface ReconcileTransactionRequest {
  bankTransactionId: string;
  recordedTransactionId?: number;
  recordedTransactionType?: 'expense' | 'revenue';
  action: 'match' | 'ignore' | 'create_new';
}

export interface ReconcileTransactionResponse {
  success: boolean;
  matchedTransactionId?: number;
  message: string;
}

// Shared handler for reconciling transactions
async function reconcileTransactionHandler(req: ReconcileTransactionRequest): Promise<ReconcileTransactionResponse> {
  const authData = getAuthData();
  if (!authData) {
    throw APIError.unauthenticated("Authentication required");
  }
  requireRole("ADMIN", "MANAGER")(authData);

  // TODO: Implement transaction reconciliation
    throw APIError.unimplemented("Transaction reconciliation not yet implemented.");

    /*
    Future implementation for matching bank transactions with recorded transactions:
    
    const { bankTransactionId, recordedTransactionId, recordedTransactionType, action } = req;
    
    try {
      switch (action) {
        case 'match':
          // Link bank transaction with existing recorded transaction
          await linkTransactions(bankTransactionId, recordedTransactionId, recordedTransactionType);
          return {
            success: true,
            matchedTransactionId: recordedTransactionId,
            message: 'Transaction matched successfully',
          };
          
        case 'ignore':
          // Mark bank transaction as ignored (e.g., internal transfers)
          await markTransactionIgnored(bankTransactionId);
          return {
            success: true,
            message: 'Transaction marked as ignored',
          };
          
        case 'create_new':
          // Create new expense/revenue record from bank transaction
          const newTransactionId = await createFromBankTransaction(bankTransactionId, authData.orgId);
          return {
            success: true,
            matchedTransactionId: newTransactionId,
            message: 'New transaction record created',
          };
          
        default:
          throw APIError.invalidArgument('Invalid reconciliation action');
      }
    } catch (error) {
      console.error('Reconcile transaction error:', error);
      throw new Error('Failed to reconcile transaction');
    }
    */
}

// LEGACY: Placeholder for transaction reconciliation (keep for backward compatibility)
export const reconcileTransaction = api<ReconcileTransactionRequest, ReconcileTransactionResponse>(
  { auth: true, expose: true, method: "POST", path: "/finance/reconcile-transaction" },
  reconcileTransactionHandler
);

// V1: Reconcile transaction
export const reconcileTransactionV1 = api<ReconcileTransactionRequest, ReconcileTransactionResponse>(
  { auth: true, expose: true, method: "POST", path: "/v1/finance/reconcile" },
  reconcileTransactionHandler
);

/*
Future Database Schema for Bank Integration:

-- Bank accounts table
CREATE TABLE bank_accounts (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_number_masked VARCHAR(20) NOT NULL, -- Last 4 digits only
    account_number_hash VARCHAR(255) NOT NULL, -- Hashed full account number
    account_type VARCHAR(20) NOT NULL, -- checking, savings, business
    routing_number_hash VARCHAR(255), -- Hashed routing number
    current_balance DECIMAL(12,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    bank_api_account_id VARCHAR(255), -- External bank API account ID
    bank_api_provider VARCHAR(50), -- plaid, yodlee, etc.
    last_sync_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_bank_accounts_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
    UNIQUE(org_id, bank_api_account_id)
);

-- Bank transactions table
CREATE TABLE bank_transactions (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL,
    bank_account_id INTEGER NOT NULL,
    bank_transaction_id VARCHAR(255) NOT NULL, -- External bank transaction ID
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(10) NOT NULL, -- credit, debit
    status VARCHAR(20) DEFAULT 'completed', -- pending, completed, failed
    reference VARCHAR(255),
    category VARCHAR(100),
    merchant_name VARCHAR(255),
    balance_after_cents INTEGER,
    is_reconciled BOOLEAN DEFAULT false,
    is_ignored BOOLEAN DEFAULT false,
    reconciled_expense_id INTEGER,
    reconciled_revenue_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_bank_transactions_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
    CONSTRAINT fk_bank_transactions_bank_account_id FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
    CONSTRAINT fk_bank_transactions_expense_id FOREIGN KEY (reconciled_expense_id) REFERENCES expenses(id),
    CONSTRAINT fk_bank_transactions_revenue_id FOREIGN KEY (reconciled_revenue_id) REFERENCES revenues(id),
    UNIQUE(org_id, bank_transaction_id)
);

-- Bank API configurations table
CREATE TABLE bank_api_configs (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL,
    provider VARCHAR(50) NOT NULL, -- plaid, yodlee, etc.
    client_id VARCHAR(255),
    encrypted_client_secret TEXT, -- Encrypted credentials
    environment VARCHAR(20) DEFAULT 'production', -- sandbox, production
    webhook_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_bank_api_configs_org_id FOREIGN KEY (org_id) REFERENCES organizations(id),
    UNIQUE(org_id, provider)
);

-- Reconciliation rules table
CREATE TABLE reconciliation_rules (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    description_pattern VARCHAR(255), -- Regex pattern for transaction description
    merchant_pattern VARCHAR(255), -- Regex pattern for merchant name
    amount_min_cents INTEGER,
    amount_max_cents INTEGER,
    auto_category VARCHAR(100), -- Auto-assign category
    auto_create_expense BOOLEAN DEFAULT false,
    auto_create_revenue BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_reconciliation_rules_org_id FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Indexes for efficient querying
CREATE INDEX idx_bank_transactions_org_date ON bank_transactions(org_id, transaction_date);
CREATE INDEX idx_bank_transactions_reconciled ON bank_transactions(org_id, is_reconciled);
CREATE INDEX idx_bank_accounts_org_active ON bank_accounts(org_id, is_active);
*/

