const BASE = 'http://localhost:4000';

async function post(path, token, body) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch (e) { return txt; }
}
async function get(path, token) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

(async function(){
  // Login as IT Admin (created by provisioning above)
  const IT_EMAIL = process.env.IT_ADMIN_EMAIL || 'ity2@test.local';
  const IT_PASS = process.env.IT_ADMIN_PASSWORD || 'adminpass';
  const login = await post('/auth/login', '', { email: IT_EMAIL, password: IT_PASS });
  if (!login || !login.token) { console.error('Login failed', login); process.exit(1); }
  const token = login.token;
  console.log('Logged in as IT Admin');

  const modules = ['dashboard','admin','hr','finance','fleet','maintenance','procurement','stations','suppliers','compliance','analytics','reports'];
  const permsFor = (map) => {
    const out = {};
    for (const m of modules) {
      const p = map[m] || {};
      out[m] = { read: !!p.read, write: !!p.write, approve: !!p.approve };
    }
    return out;
  };

  const roleDefs = [
    { name: 'IT Admin', description: 'Full access', permissions: permsFor({ dashboard:{read:true}, admin:{read:true,write:true,approve:true}, hr:{read:true,write:true,approve:true}, finance:{read:true,write:true,approve:true}, fleet:{read:true,write:true,approve:true}, maintenance:{read:true,write:true,approve:true}, procurement:{read:true,write:true,approve:true}, stations:{read:true,write:true,approve:true}, suppliers:{read:true,write:true,approve:true}, compliance:{read:true,write:true,approve:true}, analytics:{read:true}, reports:{read:true} }) },
    { name: 'Managing Director', description: 'Read across, approval rights', permissions: permsFor({ dashboard:{read:true}, admin:{read:true}, hr:{read:true}, finance:{read:true}, compliance:{read:true,approve:true}, analytics:{read:true}, reports:{read:true} }) },
    { name: 'Finance Manager', description: 'Full Finance access', permissions: permsFor({ finance:{read:true,write:true,approve:true}, procurement:{read:true}, analytics:{read:true}, reports:{read:true} }) },
    { name: 'HR Manager', description: 'Full HR access', permissions: permsFor({ hr:{read:true,write:true,approve:true}, dashboard:{read:true} }) },
    { name: 'Fleet Manager', description: 'Full Fleet access', permissions: permsFor({ fleet:{read:true,write:true,approve:true}, maintenance:{read:true} }) },
    { name: 'Maintenance Manager', description: 'Full Maintenance access', permissions: permsFor({ maintenance:{read:true,write:true,approve:true}, fleet:{read:true} }) },
    { name: 'Procurement Manager', description: 'Procurement & Suppliers', permissions: permsFor({ procurement:{read:true,write:true,approve:true}, suppliers:{read:true,write:true} }) },
    { name: 'Station Manager', description: 'Stations scope', permissions: permsFor({ stations:{read:true,write:true} }) },
    { name: 'Compliance & Fraud Manager', description: 'Compliance & Fraud', permissions: permsFor({ compliance:{read:true,write:true,approve:true}, reports:{read:true} }) },
    { name: 'User', description: 'Regular user', permissions: permsFor({ dashboard:{read:true} }) },
  ];

  for (const r of roleDefs) {
    const created = await post('/roles', token, { name: r.name, description: r.description, permissions: r.permissions });
    console.log('Created role', r.name, created.id || created);
  }

  const roles = await get('/roles', token);
  const map = {};
  for (const r of roles) map[r.name] = r.id;
  console.log('Roles map', map);

  const users = [
    { role: 'Managing Director', email:'md@democo.local', name:'Managing Director', pwd:'mdpass' },
    { role: 'Finance Manager', email:'finance@democo.local', name:'Finance Manager', pwd:'finpass' },
    { role: 'HR Manager', email:'hr@democo.local', name:'HR Manager', pwd:'hrpass' },
    { role: 'Fleet Manager', email:'fleet@democo.local', name:'Fleet Manager', pwd:'fleetpass' },
    { role: 'Maintenance Manager', email:'maint@democo.local', name:'Maintenance Manager', pwd:'maintpass' },
    { role: 'Procurement Manager', email:'procure@democo.local', name:'Procurement Manager', pwd:'procurepass' },
    { role: 'Station Manager', email:'station@democo.local', name:'Station Manager', pwd:'stationpass' },
    { role: 'Compliance & Fraud Manager', email:'compliance@democo.local', name:'Compliance Manager', pwd:'complpass' },
    { role: 'User', email:'user@democo.local', name:'Regular User', pwd:'userpass' },
  ];

  for (const u of users) {
    const rid = map[u.role] || map['User'] || 1;
    const created = await post('/users', token, { email: u.email, name: u.name, password: u.pwd, roleId: rid });
    console.log('Created user', u.email, '->', created);
  }

  console.log('Done');
})();
