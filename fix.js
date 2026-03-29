const fs = require('fs');
const files = fs.readdirSync('src/data/characters').filter(f => f.endsWith('.ts')).map(f => 'src/data/characters/' + f);
files.push('src/components/SortieModal.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/(power:\s*\d+,[\s\S]*?)(toughness:)/g, '$1dexterity: 50,\n    magic: 50,\n    $2');
  content = content.replace(/baseStats: \{ power: 0, toughness: 0, constitution: 0, agility: 0, command: 0, leadership: 0, intelligence: 0, politics: 0, charm: 0 \}/g, 'baseStats: { power: 0, agility: 0, dexterity: 0, constitution: 0, magic: 0, toughness: 0, command: 0, leadership: 0, intelligence: 0, politics: 0, charm: 0 }');
  fs.writeFileSync(file, content);
});
