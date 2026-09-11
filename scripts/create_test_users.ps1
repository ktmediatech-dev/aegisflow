# Create tenant roles and test users using the IT Admin account
$admin = Invoke-RestMethod -Uri http://localhost:4000/auth/login -Method Post -Body (ConvertTo-Json @{ email='ity@democo.local'; password='adminpass' }) -ContentType 'application/json'
$token = $admin.token
$hdr = @{ Authorization = "Bearer $token" }

$modules = @('dashboard','admin','hr','finance','fleet','maintenance','procurement','stations','suppliers','compliance','analytics','reports')

function perms($map) {
  $o = @{}
  foreach ($m in $modules) {
    if ($map.ContainsKey($m)) {
      $p = $map[$m]
      $o[$m] = @{ read = [bool]$p.read; write = [bool]$p.write; approve = [bool]$p.approve }
    } else {
      $o[$m] = @{ read = $false; write = $false; approve = $false }
    }
  }
  return $o
}

$roleDefs = @()
$roleDefs += @{ name='IT Admin'; description='Full access to all modules'; permissions=(perms @{ dashboard=@{read=$true}; admin=@{read=$true;write=$true;approve=$true}; hr=@{read=$true;write=$true;approve=$true}; finance=@{read=$true;write=$true;approve=$true}; fleet=@{read=$true;write=$true;approve=$true}; maintenance=@{read=$true;write=$true;approve=$true}; procurement=@{read=$true;write=$true;approve=$true}; stations=@{read=$true;write=$true;approve=$true}; suppliers=@{read=$true;write=$true;approve=$true}; compliance=@{read=$true;write=$true;approve=$true}; analytics=@{read=$true}; reports=@{read=$true} }) }
$roleDefs += @{ name='Managing Director'; description='Read across, approval rights'; permissions=(perms @{ dashboard=@{read=$true}; admin=@{read=$true}; hr=@{read=$true}; finance=@{read=$true}; compliance=@{read=$true;write=$false;approve=$true}; analytics=@{read=$true}; reports=@{read=$true} }) }
$roleDefs += @{ name='Finance Manager'; description='Full Finance access'; permissions=(perms @{ finance=@{read=$true;write=$true;approve=$true}; procurement=@{read=$true}; analytics=@{read=$true}; reports=@{read=$true} }) }
$roleDefs += @{ name='HR Manager'; description='Full HR access'; permissions=(perms @{ hr=@{read=$true;write=$true;approve=$true}; dashboard=@{read=$true} }) }
$roleDefs += @{ name='Fleet Manager'; description='Full Fleet access'; permissions=(perms @{ fleet=@{read=$true;write=$true;approve=$true}; maintenance=@{read=$true} }) }
$roleDefs += @{ name='Maintenance Manager'; description='Full Maintenance access'; permissions=(perms @{ maintenance=@{read=$true;write=$true;approve=$true}; fleet=@{read=$true} }) }
$roleDefs += @{ name='Procurement Manager'; description='Procurement & Suppliers'; permissions=(perms @{ procurement=@{read=$true;write=$true;approve=$true}; suppliers=@{read=$true;write=$true} }) }
$roleDefs += @{ name='Station Manager'; description='Stations scope'; permissions=(perms @{ stations=@{read=$true;write=$true} }) }
$roleDefs += @{ name='Compliance & Fraud Manager'; description='Compliance & Fraud'; permissions=(perms @{ compliance=@{read=$true;write=$true;approve=$true}; reports=@{read=$true} }) }
$roleDefs += @{ name='User'; description='Regular user'; permissions=(perms @{ dashboard=@{read=$true} }) }

foreach ($rd in $roleDefs) {
  $body = @{ name = $rd.name; description = $rd.description; permissions = $rd.permissions } | ConvertTo-Json -Depth 10
  Invoke-RestMethod -Uri http://localhost:4000/roles -Method Post -Headers $hdr -Body $body -ContentType 'application/json'
  Write-Output "Created role: $($rd.name)"
}

# fetch roles and create users mapping
$roles = Invoke-RestMethod -Uri http://localhost:4000/roles -Method Get -Headers $hdr
$map = @{}
foreach ($r in $roles) { $map[$r.name] = $r.id }

$users = @(
  @{ role='Managing Director'; email='md@democo.local'; name='Managing Director'; pwd='mdpass' },
  @{ role='Finance Manager'; email='finance@democo.local'; name='Finance Manager'; pwd='finpass' },
  @{ role='HR Manager'; email='hr@democo.local'; name='HR Manager'; pwd='hrpass' },
  @{ role='Fleet Manager'; email='fleet@democo.local'; name='Fleet Manager'; pwd='fleetpass' },
  @{ role='Maintenance Manager'; email='maint@democo.local'; name='Maintenance Manager'; pwd='maintpass' },
  @{ role='Procurement Manager'; email='procure@democo.local'; name='Procurement Manager'; pwd='procurepass' },
  @{ role='Station Manager'; email='station@democo.local'; name='Station Manager'; pwd='stationpass' },
  @{ role='Compliance & Fraud Manager'; email='compliance@democo.local'; name='Compliance Manager'; pwd='complpass' },
  @{ role='User'; email='user@democo.local'; name='Regular User'; pwd='userpass' }
)

foreach ($u in $users) {
  $rid = $null
  if ($map.ContainsKey($u.role)) { $rid = $map[$u.role] }
  if (-not $rid -and $map.ContainsKey('User')) { $rid = $map['User'] }
  if (-not $rid) { Write-Warning "No role found for $($u.role), skipping user creation"; continue }
  $body = @{ email = $u.email; name = $u.name; password = $u.pwd; roleId = $rid } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Uri http://localhost:4000/users -Method Post -Headers $hdr -Body $body -ContentType 'application/json'
  Write-Output "Created user $($u.email) as $($u.role) (roleId $rid)"
}
