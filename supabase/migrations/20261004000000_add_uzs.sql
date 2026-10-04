-- Lumen: add Uzbekistani Som (UZS).
-- Run once in the Supabase SQL editor, after 20261003000000_accounts.sql. Safe to re-run.

-- Allow UZS as a profile currency.
alter table public.profiles drop constraint if exists profiles_currency_check;
alter table public.profiles add constraint profiles_currency_check
  check (currency in ('USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'UZS'));

-- UZS amounts are large (about 12,500 soʻm to the dollar), so allow transactions up to the
-- column's maximum. The app still limits other currencies to 10,000,000 per transaction.
alter table public.transactions drop constraint if exists transactions_amount_check;
alter table public.transactions add constraint transactions_amount_check
  check (amount > 0 and amount < 10000000000);
