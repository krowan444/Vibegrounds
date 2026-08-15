// Built-in avatar options for VibeGrounds profiles.
// Files live in public/images/avatars/.
//
// `group` exists so the picker can break 132 options into sections. A flat
// grid of that many is a wall rather than a choice, and people give up and
// take the first one. AVATARS stays a flat array so anything already
// reading it keeps working.

export const AVATAR_GROUPS = [
  'Originals',
  'Cats',
  'Dogs',
  'Wild',
  'Creatures',
  'Mythical',
  'Machines',
  'Vibe Coders',
];

export const AVATARS = [
  // The first twenty, kept exactly as they were: members already wear
  // these and their profiles point at these filenames.
  { id: 'avatar_01', name: 'Cool Cat', group: 'Originals', path: '/images/avatars/avatar_01.png' },
  { id: 'avatar_02', name: 'Robot', group: 'Originals', path: '/images/avatars/avatar_02.png' },
  { id: 'avatar_03', name: 'Ninja', group: 'Originals', path: '/images/avatars/avatar_03.png' },
  { id: 'avatar_04', name: 'Wizard', group: 'Originals', path: '/images/avatars/avatar_04.png' },
  { id: 'avatar_05', name: 'Punk Rocker', group: 'Originals', path: '/images/avatars/avatar_05.png' },
  { id: 'avatar_06', name: 'Ghost', group: 'Originals', path: '/images/avatars/avatar_06.png' },
  { id: 'avatar_07', name: 'Alien', group: 'Originals', path: '/images/avatars/avatar_07.png' },
  { id: 'avatar_08', name: 'Pirate', group: 'Originals', path: '/images/avatars/avatar_08.png' },
  { id: 'avatar_09', name: 'Fire Spirit', group: 'Originals', path: '/images/avatars/avatar_09.png' },
  { id: 'avatar_10', name: 'Skull', group: 'Originals', path: '/images/avatars/avatar_10.png' },
  { id: 'avatar_11', name: 'Fox', group: 'Originals', path: '/images/avatars/avatar_11.png' },
  { id: 'avatar_12', name: 'Slime', group: 'Originals', path: '/images/avatars/avatar_12.png' },
  { id: 'avatar_13', name: 'Knight', group: 'Originals', path: '/images/avatars/avatar_13.png' },
  { id: 'avatar_14', name: 'Vampire', group: 'Originals', path: '/images/avatars/avatar_14.png' },
  { id: 'avatar_15', name: 'Mushroom', group: 'Originals', path: '/images/avatars/avatar_15.png' },
  { id: 'avatar_16', name: 'Panda', group: 'Originals', path: '/images/avatars/avatar_16.png' },
  { id: 'avatar_17', name: 'Dragon', group: 'Originals', path: '/images/avatars/avatar_17.png' },
  { id: 'avatar_18', name: 'Cyber Girl', group: 'Originals', path: '/images/avatars/avatar_18.png' },
  { id: 'avatar_19', name: 'Penguin', group: 'Originals', path: '/images/avatars/avatar_19.png' },
  { id: 'avatar_20', name: 'Cactus', group: 'Originals', path: '/images/avatars/avatar_20.png' },

  // ---- Cats ----
  { id: 'avatar_021', name: 'Tabby Cat', group: 'Cats', path: '/images/avatars/avatar_021.webp' },
  { id: 'avatar_022', name: 'Black Cat', group: 'Cats', path: '/images/avatars/avatar_022.webp' },
  { id: 'avatar_023', name: 'Fluffy White Cat', group: 'Cats', path: '/images/avatars/avatar_023.webp' },
  { id: 'avatar_024', name: 'Ginger Tom', group: 'Cats', path: '/images/avatars/avatar_024.webp' },
  { id: 'avatar_025', name: 'Siamese Cat', group: 'Cats', path: '/images/avatars/avatar_025.webp' },
  { id: 'avatar_026', name: 'Calico Cat', group: 'Cats', path: '/images/avatars/avatar_026.webp' },
  { id: 'avatar_027', name: 'Grumpy Cat', group: 'Cats', path: '/images/avatars/avatar_027.webp' },
  { id: 'avatar_028', name: 'Grey Kitten', group: 'Cats', path: '/images/avatars/avatar_028.webp' },
  { id: 'avatar_029', name: 'Shades Cat', group: 'Cats', path: '/images/avatars/avatar_029.webp' },
  { id: 'avatar_030', name: 'Headphones Cat', group: 'Cats', path: '/images/avatars/avatar_030.webp' },
  { id: 'avatar_031', name: 'Wizard Cat', group: 'Cats', path: '/images/avatars/avatar_031.webp' },
  { id: 'avatar_032', name: 'Pirate Cat', group: 'Cats', path: '/images/avatars/avatar_032.webp' },
  { id: 'avatar_033', name: 'Ninja Cat', group: 'Cats', path: '/images/avatars/avatar_033.webp' },
  { id: 'avatar_034', name: 'Astronaut Cat', group: 'Cats', path: '/images/avatars/avatar_034.webp' },
  { id: 'avatar_035', name: 'Robot Cat', group: 'Cats', path: '/images/avatars/avatar_035.webp' },
  { id: 'avatar_036', name: 'Zombie Cat', group: 'Cats', path: '/images/avatars/avatar_036.webp' },

  // ---- Dogs ----
  { id: 'avatar_037', name: 'Golden Retriever', group: 'Dogs', path: '/images/avatars/avatar_037.webp' },
  { id: 'avatar_038', name: 'Pug', group: 'Dogs', path: '/images/avatars/avatar_038.webp' },
  { id: 'avatar_039', name: 'Dachshund', group: 'Dogs', path: '/images/avatars/avatar_039.webp' },
  { id: 'avatar_040', name: 'Husky', group: 'Dogs', path: '/images/avatars/avatar_040.webp' },
  { id: 'avatar_041', name: 'Corgi', group: 'Dogs', path: '/images/avatars/avatar_041.webp' },
  { id: 'avatar_042', name: 'Shiba Inu', group: 'Dogs', path: '/images/avatars/avatar_042.webp' },
  { id: 'avatar_043', name: 'French Bulldog', group: 'Dogs', path: '/images/avatars/avatar_043.webp' },
  { id: 'avatar_044', name: 'Dalmatian', group: 'Dogs', path: '/images/avatars/avatar_044.webp' },
  { id: 'avatar_045', name: 'German Shepherd', group: 'Dogs', path: '/images/avatars/avatar_045.webp' },
  { id: 'avatar_046', name: 'Poodle', group: 'Dogs', path: '/images/avatars/avatar_046.webp' },
  { id: 'avatar_047', name: 'Sheepdog', group: 'Dogs', path: '/images/avatars/avatar_047.webp' },
  { id: 'avatar_048', name: 'Puppy', group: 'Dogs', path: '/images/avatars/avatar_048.webp' },
  { id: 'avatar_049', name: 'Shades Rottweiler', group: 'Dogs', path: '/images/avatars/avatar_049.webp' },
  { id: 'avatar_050', name: 'Skater Dog', group: 'Dogs', path: '/images/avatars/avatar_050.webp' },
  { id: 'avatar_051', name: 'Knight Dog', group: 'Dogs', path: '/images/avatars/avatar_051.webp' },
  { id: 'avatar_052', name: 'Cyber Dog', group: 'Dogs', path: '/images/avatars/avatar_052.webp' },

  // ---- Wild ----
  { id: 'avatar_053', name: 'Fox', group: 'Wild', path: '/images/avatars/avatar_053.webp' },
  { id: 'avatar_054', name: 'Wolf', group: 'Wild', path: '/images/avatars/avatar_054.webp' },
  { id: 'avatar_055', name: 'Bear', group: 'Wild', path: '/images/avatars/avatar_055.webp' },
  { id: 'avatar_056', name: 'Tiger', group: 'Wild', path: '/images/avatars/avatar_056.webp' },
  { id: 'avatar_057', name: 'Lion', group: 'Wild', path: '/images/avatars/avatar_057.webp' },
  { id: 'avatar_058', name: 'Panda', group: 'Wild', path: '/images/avatars/avatar_058.webp' },
  { id: 'avatar_059', name: 'Red Panda', group: 'Wild', path: '/images/avatars/avatar_059.webp' },
  { id: 'avatar_060', name: 'Raccoon', group: 'Wild', path: '/images/avatars/avatar_060.webp' },
  { id: 'avatar_061', name: 'Owl', group: 'Wild', path: '/images/avatars/avatar_061.webp' },
  { id: 'avatar_062', name: 'Eagle', group: 'Wild', path: '/images/avatars/avatar_062.webp' },
  { id: 'avatar_063', name: 'Deer', group: 'Wild', path: '/images/avatars/avatar_063.webp' },
  { id: 'avatar_064', name: 'Hedgehog', group: 'Wild', path: '/images/avatars/avatar_064.webp' },
  { id: 'avatar_065', name: 'Badger', group: 'Wild', path: '/images/avatars/avatar_065.webp' },
  { id: 'avatar_066', name: 'Otter', group: 'Wild', path: '/images/avatars/avatar_066.webp' },
  { id: 'avatar_067', name: 'Sloth', group: 'Wild', path: '/images/avatars/avatar_067.webp' },
  { id: 'avatar_068', name: 'Monkey', group: 'Wild', path: '/images/avatars/avatar_068.webp' },

  // ---- Creatures ----
  { id: 'avatar_069', name: 'Frog', group: 'Creatures', path: '/images/avatars/avatar_069.webp' },
  { id: 'avatar_070', name: 'Axolotl', group: 'Creatures', path: '/images/avatars/avatar_070.webp' },
  { id: 'avatar_071', name: 'Octopus', group: 'Creatures', path: '/images/avatars/avatar_071.webp' },
  { id: 'avatar_072', name: 'Jellyfish', group: 'Creatures', path: '/images/avatars/avatar_072.webp' },
  { id: 'avatar_073', name: 'Snail', group: 'Creatures', path: '/images/avatars/avatar_073.webp' },
  { id: 'avatar_074', name: 'Bee', group: 'Creatures', path: '/images/avatars/avatar_074.webp' },
  { id: 'avatar_075', name: 'Beetle', group: 'Creatures', path: '/images/avatars/avatar_075.webp' },
  { id: 'avatar_076', name: 'Crab', group: 'Creatures', path: '/images/avatars/avatar_076.webp' },
  { id: 'avatar_077', name: 'Penguin', group: 'Creatures', path: '/images/avatars/avatar_077.webp' },
  { id: 'avatar_078', name: 'Duckling', group: 'Creatures', path: '/images/avatars/avatar_078.webp' },
  { id: 'avatar_079', name: 'Chameleon', group: 'Creatures', path: '/images/avatars/avatar_079.webp' },
  { id: 'avatar_080', name: 'Gecko', group: 'Creatures', path: '/images/avatars/avatar_080.webp' },
  { id: 'avatar_081', name: 'Bat', group: 'Creatures', path: '/images/avatars/avatar_081.webp' },
  { id: 'avatar_082', name: 'Rat', group: 'Creatures', path: '/images/avatars/avatar_082.webp' },
  { id: 'avatar_083', name: 'Ferret', group: 'Creatures', path: '/images/avatars/avatar_083.webp' },
  { id: 'avatar_084', name: 'Capybara', group: 'Creatures', path: '/images/avatars/avatar_084.webp' },

  // ---- Mythical ----
  { id: 'avatar_085', name: 'Red Dragon', group: 'Mythical', path: '/images/avatars/avatar_085.webp' },
  { id: 'avatar_086', name: 'Baby Dragon', group: 'Mythical', path: '/images/avatars/avatar_086.webp' },
  { id: 'avatar_087', name: 'Griffin', group: 'Mythical', path: '/images/avatars/avatar_087.webp' },
  { id: 'avatar_088', name: 'Phoenix', group: 'Mythical', path: '/images/avatars/avatar_088.webp' },
  { id: 'avatar_089', name: 'Unicorn', group: 'Mythical', path: '/images/avatars/avatar_089.webp' },
  { id: 'avatar_090', name: 'Pegasus', group: 'Mythical', path: '/images/avatars/avatar_090.webp' },
  { id: 'avatar_091', name: 'Kraken', group: 'Mythical', path: '/images/avatars/avatar_091.webp' },
  { id: 'avatar_092', name: 'Yeti', group: 'Mythical', path: '/images/avatars/avatar_092.webp' },
  { id: 'avatar_093', name: 'Minotaur', group: 'Mythical', path: '/images/avatars/avatar_093.webp' },
  { id: 'avatar_094', name: 'Cyclops', group: 'Mythical', path: '/images/avatars/avatar_094.webp' },
  { id: 'avatar_095', name: 'Gargoyle', group: 'Mythical', path: '/images/avatars/avatar_095.webp' },
  { id: 'avatar_096', name: 'Hydra', group: 'Mythical', path: '/images/avatars/avatar_096.webp' },
  { id: 'avatar_097', name: 'Kitsune', group: 'Mythical', path: '/images/avatars/avatar_097.webp' },
  { id: 'avatar_098', name: 'Thunderbird', group: 'Mythical', path: '/images/avatars/avatar_098.webp' },
  { id: 'avatar_099', name: 'Basilisk', group: 'Mythical', path: '/images/avatars/avatar_099.webp' },
  { id: 'avatar_100', name: 'Chimera', group: 'Mythical', path: '/images/avatars/avatar_100.webp' },

  // ---- Machines ----
  { id: 'avatar_101', name: 'Retro Robot', group: 'Machines', path: '/images/avatars/avatar_101.webp' },
  { id: 'avatar_102', name: 'Chrome Android', group: 'Machines', path: '/images/avatars/avatar_102.webp' },
  { id: 'avatar_103', name: 'Scrap Bot', group: 'Machines', path: '/images/avatars/avatar_103.webp' },
  { id: 'avatar_104', name: 'Orb Droid', group: 'Machines', path: '/images/avatars/avatar_104.webp' },
  { id: 'avatar_105', name: 'Mech Pilot', group: 'Machines', path: '/images/avatars/avatar_105.webp' },
  { id: 'avatar_106', name: 'Cyborg', group: 'Machines', path: '/images/avatars/avatar_106.webp' },
  { id: 'avatar_107', name: 'Toaster Bot', group: 'Machines', path: '/images/avatars/avatar_107.webp' },
  { id: 'avatar_108', name: 'CRT Head', group: 'Machines', path: '/images/avatars/avatar_108.webp' },
  { id: 'avatar_109', name: 'Clockwork Bot', group: 'Machines', path: '/images/avatars/avatar_109.webp' },
  { id: 'avatar_110', name: 'Magnet Bot', group: 'Machines', path: '/images/avatars/avatar_110.webp' },
  { id: 'avatar_111', name: 'Satellite Bot', group: 'Machines', path: '/images/avatars/avatar_111.webp' },
  { id: 'avatar_112', name: 'Camera Drone', group: 'Machines', path: '/images/avatars/avatar_112.webp' },
  { id: 'avatar_113', name: 'Arcade Bot', group: 'Machines', path: '/images/avatars/avatar_113.webp' },
  { id: 'avatar_114', name: 'Calculator Bot', group: 'Machines', path: '/images/avatars/avatar_114.webp' },
  { id: 'avatar_115', name: 'Tape Deck Bot', group: 'Machines', path: '/images/avatars/avatar_115.webp' },
  { id: 'avatar_116', name: 'Server Rack', group: 'Machines', path: '/images/avatars/avatar_116.webp' },

  // ---- Vibe Coders ----
  { id: 'avatar_117', name: 'Late Night Coder', group: 'Vibe Coders', path: '/images/avatars/avatar_117.webp' },
  { id: 'avatar_118', name: 'Coffee Dev', group: 'Vibe Coders', path: '/images/avatars/avatar_118.webp' },
  { id: 'avatar_119', name: 'Headphones Dev', group: 'Vibe Coders', path: '/images/avatars/avatar_119.webp' },
  { id: 'avatar_120', name: 'Hacker', group: 'Vibe Coders', path: '/images/avatars/avatar_120.webp' },
  { id: 'avatar_121', name: 'Sleep Deprived', group: 'Vibe Coders', path: '/images/avatars/avatar_121.webp' },
  { id: 'avatar_122', name: 'Cat Owner Dev', group: 'Vibe Coders', path: '/images/avatars/avatar_122.webp' },
  { id: 'avatar_123', name: 'Rubber Ducker', group: 'Vibe Coders', path: '/images/avatars/avatar_123.webp' },
  { id: 'avatar_124', name: 'Keyboard Warrior', group: 'Vibe Coders', path: '/images/avatars/avatar_124.webp' },
  { id: 'avatar_125', name: 'Prompt Wizard', group: 'Vibe Coders', path: '/images/avatars/avatar_125.webp' },
  { id: 'avatar_126', name: 'Terminal Goblin', group: 'Vibe Coders', path: '/images/avatars/avatar_126.webp' },
  { id: 'avatar_127', name: 'Dual Monitor Gremlin', group: 'Vibe Coders', path: '/images/avatars/avatar_127.webp' },
  { id: 'avatar_128', name: 'Whiteboard Architect', group: 'Vibe Coders', path: '/images/avatars/avatar_128.webp' },
  { id: 'avatar_129', name: 'Energy Drink Dev', group: 'Vibe Coders', path: '/images/avatars/avatar_129.webp' },
  { id: 'avatar_130', name: 'Floppy Disk Dev', group: 'Vibe Coders', path: '/images/avatars/avatar_130.webp' },
  { id: 'avatar_131', name: 'Bug Hunter', group: 'Vibe Coders', path: '/images/avatars/avatar_131.webp' },
  { id: 'avatar_132', name: 'Ship It Dev', group: 'Vibe Coders', path: '/images/avatars/avatar_132.webp' },
];

// Default avatar if none selected
export const DEFAULT_AVATAR = AVATARS[0];

// Get avatar by path or ID
export function getAvatarByUrl(url) {
  if (!url) return DEFAULT_AVATAR;
  return AVATARS.find(a => a.path === url || a.id === url) || null;
}
