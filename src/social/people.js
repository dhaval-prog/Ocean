// Who is in the ocean right now. Demo data for the letter UI; this will come
// from the backend once chat is built.
//   photo:      optional profile picture URL (falls back to the coloured initials)
//   unread:     letters from them you have not read yet (number at the top right)
//   online:     on the ocean right now (a green boat sailing round their circle)
//   tz, lat/lon: where they are - their circle shows their local time of day and weather
//   status:     shown as a message in a bottle floating in their circle
//   lastLetter: the first line of their last letter (long-press to peek)
//   lastWrote:  days since you last wrote to them
//   streak:     days in a row you've written to each other (shown when you long-press to peek)
//   writes:     how often you write to them (night constellations join the closest)
//   birthday:   'MM-DD' (or 'today' for the demo): confetti when you pick them
// The two demo photos are illustrations, not real people.
export const ME = { id: 'me', name: 'Dhaval', city: 'Mumbai', initials: 'DD', color: '#ef8f73', ring: '#c9684e' };

export const FRIENDS = [
  { id: 'aarav', name: 'Aarav', city: 'Mumbai', initials: 'AA', color: '#9cc0ec', unread: 2, online: true,
    tz: 'Asia/Kolkata', lat: 19.08, lon: 72.88, status: 'Off to the beach 🌊', lastLetter: 'Did you see the sunset tonight?', lastWrote: 1, streak: 5, writes: 42 },
  { id: 'demo1', name: 'Demo1', city: 'Mumbai', initials: 'D1', color: '#c2aeea', unread: 1,
    tz: 'Asia/Kolkata', lat: 19.08, lon: 72.88, lastLetter: 'Happy to hear from you!', lastWrote: 6, streak: 0, writes: 9, birthday: 'today' },
  { id: 'willa', name: 'Willa', city: 'Lisbon', initials: 'WW', color: '#d6e8a6', unread: 14, online: true, photo: '/avatars/willa.svg',
    tz: 'Europe/Lisbon', lat: 38.72, lon: -9.14, status: 'Learning to surf', lastLetter: 'The waves here are huge today', lastWrote: 3, streak: 12, writes: 31 },
  { id: 'kenji', name: 'Kenji', city: 'Osaka', initials: 'KS', color: '#f4cd93', photo: '/avatars/kenji.svg',
    tz: 'Asia/Tokyo', lat: 34.69, lon: 135.5, status: 'Cherry blossoms soon', lastLetter: 'Sending you a photo of the river', lastWrote: 14, streak: 2, writes: 18 },
];

export const NOTIFICATIONS = 12; // shown as "9+"
export const INBOX = 17;
