const fs = require('fs');
const files = fs.readdirSync('src/data/characters').filter(f => f.endsWith('.ts'));

for (const f of files) {
  const p = 'src/data/characters/' + f;
  let code = fs.readFileSync(p, 'utf8');
  if(!code.includes('strength:')) continue; // Skip if already done
  code = code.replace(/baseStats:\s*\{[^}]*\}/, (match) => {
    const getVal = (name, def) => {
      const regex = new RegExp(name + ':\\s*(\\d+)');
      const res = match.match(regex);
      return res ? Number(res[1]) : def;
    };
    const hp = getVal('hp', 100);
    const strength = getVal('strength', 50);
    const int = getVal('intelligence', 50);
    const pol = getVal('politics', 50);
    const cha = getVal('charisma', 50);
    const spd = getVal('speed', 10);
    return `baseStats: {
    power: ${strength},
    toughness: ${Math.floor((strength + hp/2)/2)},
    constitution: ${hp},
    agility: ${spd},
    command: ${Math.floor((strength + int)/2)},
    leadership: ${cha},
    intelligence: ${int},
    politics: ${pol},
    charm: ${cha},
  }`;
  });
  fs.writeFileSync(p, code);
}
console.log('Update Complete.');
