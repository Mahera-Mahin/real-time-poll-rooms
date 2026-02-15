const STORAGE_KEY = 'poll_rooms_voter_id';

export function getOrCreateVoterToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem(STORAGE_KEY);
  if (!token) {
    token = `v_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
    localStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}
