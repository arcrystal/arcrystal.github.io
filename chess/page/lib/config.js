// The one place the page names the Chess.com account it reads (a public handle, as in chess/chess.js).
// Everything else takes the account as a parameter, so tests and fixtures never need it.
export const ACCOUNT = 'thecrystalball';
export const profileUrl = (account = ACCOUNT) => `https://www.chess.com/member/${encodeURIComponent(account)}`;
