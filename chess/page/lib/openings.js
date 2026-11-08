// The three openings of the repertoire. The sentences under "said" are carried over word for word
// from the page's previous version (Alex's own copy); the demonstration lines are standard opening
// lines, labelled on the page as demonstrations, not as games.
export const OPENINGS = [
  {
    key: 'reti',
    name: 'Réti',
    family: 'Réti Opening',
    start: '1. Nf3',
    line: ['Nf3', 'd5', 'c4'],
    said: 'I like the flexibility: develop first, decide on the pawn structure after seeing what Black commits to.',
    page: 'https://www.chess.com/openings/Reti-Opening',
  },
  {
    key: 'scotch',
    name: 'Scotch',
    family: 'Scotch Game',
    start: '1. e4 e5 2. Nf3 Nc6 3. d4',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4'],
    said: 'An open center and concrete decisions early. It tends to produce positions I enjoy playing.',
    page: 'https://www.chess.com/openings/Scotch-Game',
  },
  {
    key: 'okelly',
    name: 'O’Kelly Sicilian',
    family: 'Sicilian Defense: O’Kelly',
    start: '1. e4 c5 2. Nf3 a6',
    line: ['e4', 'c5', 'Nf3', 'a6'],
    said: 'My Sicilian sideline. The early …a6 changes White’s usual options and keeps …b5 available.',
    page: 'https://www.chess.com/openings/Sicilian-Defense-OKelly-Variation',
  },
];

