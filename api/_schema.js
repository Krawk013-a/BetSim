import { getSupabase } from './_supabase.js';

export async function ensureSchema() {
  const supabase = getSupabase();
  // Criação de tabelas usando query SQL via PostgREST: use rpc com função, mas para simplificar assumimos que já existem.
  // Orientação: crie estas tabelas no Supabase SQL Editor (Database -> SQL editor):
  //
  // CREATE TABLE IF NOT EXISTS users (
  //   id uuid PRIMARY KEY,
  //   username text UNIQUE NOT NULL,
  //   password_hash text NOT NULL,
  //   balance numeric NOT NULL DEFAULT 0,
  //   created_at timestamptz NOT NULL DEFAULT now()
  // );
  //
  // CREATE TABLE IF NOT EXISTS logs (
  //   id uuid PRIMARY KEY,
  //   user_id uuid NOT NULL,
  //   user_name text NOT NULL,
  //   game text NOT NULL,
  //   type text NOT NULL,
  //   amount numeric NOT NULL,
  //   details text,
  //   timestamp timestamptz NOT NULL DEFAULT now(),
  //   session_id text
  // );
  //
  // Nota: supabase-js não executa SQL raw diretamente sem pg, então mantemos a criação manual via painel.
  return supabase; // para reutilizar a instância se necessário
}