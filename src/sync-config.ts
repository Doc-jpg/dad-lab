/**
 * Where your devices meet: the same free project Athletic Lab uses, a different code keeps the rows apart. The publishable key is public by design (Supabase row-level security
 * is what protects the data: a request only sees rows for the code whose hash it carries).
 * Empty values turn sync off and the app runs as a single-device app.
 */
export const SYNC_CONFIG = {
  url: 'https://kdulamsgpgozryacmhok.supabase.co',
  anonKey: 'sb_publishable_L-BWbmrV7Ss1aRJW_Et0Kg_G0EU0dtB'
};
export const SYNC_AVAILABLE = !!SYNC_CONFIG.url && !!SYNC_CONFIG.anonKey;
