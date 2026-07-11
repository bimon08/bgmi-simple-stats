import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Wallet = {
  id: string;
  player_name: string;
  share_token: string;
  phone: string | null;
  created_at: string;
};

export type Transaction = {
  id: string;
  wallet_id: string;
  amount: number; // positive = player owes you, negative = you owe player
  note: string;
  created_at: string;
};

export type WalletWithBalance = Wallet & {
  balance: number;
  transactions: Transaction[];
};
