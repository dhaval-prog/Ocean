// Who is in the ocean right now. Demo data for the letter UI; this will come
// from the backend once chat is built.
//   photo:  optional profile picture URL (falls back to the coloured initials)
//   unread: letters from them you have not read yet (a turning ring round the avatar)
//   online: on the ocean right now (a little boat on the avatar)
// The two demo photos are illustrations, not real people.
export const ME = { id: 'me', name: 'Dhaval', city: 'Mumbai', initials: 'DD', color: '#ef8f73', ring: '#c9684e' };

export const FRIENDS = [
  { id: 'aarav', name: 'Aarav', city: 'Mumbai', initials: 'AA', color: '#9cc0ec', unread: 2, online: true },
  { id: 'demo1', name: 'Demo1', city: 'Mumbai', initials: 'D1', color: '#c2aeea', unread: 1 },
  { id: 'willa', name: 'Willa', city: 'Lisbon', initials: 'WW', color: '#d6e8a6', unread: 14, online: true, photo: '/avatars/willa.svg' },
  { id: 'kenji', name: 'Kenji', city: 'Osaka', initials: 'KS', color: '#f4cd93', photo: '/avatars/kenji.svg' },
];

export const NOTIFICATIONS = 12; // shown as "9+"
export const INBOX = 17;
