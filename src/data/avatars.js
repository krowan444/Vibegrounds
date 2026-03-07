// Built-in avatar options for VibeGrounds profiles
// Each avatar is stored in public/images/avatars/

export const AVATARS = [
  { id: 'avatar_01', name: 'Cool Cat', path: '/images/avatars/avatar_01.png' },
  { id: 'avatar_02', name: 'Robot', path: '/images/avatars/avatar_02.png' },
  { id: 'avatar_03', name: 'Ninja', path: '/images/avatars/avatar_03.png' },
  { id: 'avatar_04', name: 'Wizard', path: '/images/avatars/avatar_04.png' },
  { id: 'avatar_05', name: 'Punk Rocker', path: '/images/avatars/avatar_05.png' },
  { id: 'avatar_06', name: 'Ghost', path: '/images/avatars/avatar_06.png' },
  { id: 'avatar_07', name: 'Alien', path: '/images/avatars/avatar_07.png' },
  { id: 'avatar_08', name: 'Pirate', path: '/images/avatars/avatar_08.png' },
  { id: 'avatar_09', name: 'Fire Spirit', path: '/images/avatars/avatar_09.png' },
  { id: 'avatar_10', name: 'Skull', path: '/images/avatars/avatar_10.png' },
  { id: 'avatar_11', name: 'Fox', path: '/images/avatars/avatar_11.png' },
  { id: 'avatar_12', name: 'Slime', path: '/images/avatars/avatar_12.png' },
  { id: 'avatar_13', name: 'Knight', path: '/images/avatars/avatar_13.png' },
  { id: 'avatar_14', name: 'Vampire', path: '/images/avatars/avatar_14.png' },
  { id: 'avatar_15', name: 'Mushroom', path: '/images/avatars/avatar_15.png' },
  { id: 'avatar_16', name: 'Panda', path: '/images/avatars/avatar_16.png' },
  { id: 'avatar_17', name: 'Dragon', path: '/images/avatars/avatar_17.png' },
  { id: 'avatar_18', name: 'Cyber Girl', path: '/images/avatars/avatar_18.png' },
  { id: 'avatar_19', name: 'Penguin', path: '/images/avatars/avatar_19.png' },
  { id: 'avatar_20', name: 'Cactus', path: '/images/avatars/avatar_20.png' }
];

// Default avatar if none selected
export const DEFAULT_AVATAR = AVATARS[0];

// Get avatar by path or ID
export function getAvatarByUrl(url) {
  if (!url) return DEFAULT_AVATAR;
  return AVATARS.find(a => a.path === url || a.id === url) || null;
}
