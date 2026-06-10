# Uruchom na KAŻDYM innym PC w LAN (PowerShell jako Administrator).
# Mapuje ontime.mikran → IP serwera z aplikacją.
param(
  [string]$ServerIp = "192.168.0.140",
  [string]$Hostname = "ontime.mikran"
)

$hostsPath = "$env:Windir\System32\drivers\etc\hosts"
$line = "$ServerIp`t$Hostname"
$pattern = [regex]::Escape($Hostname)

if (Select-String -Path $hostsPath -Pattern $pattern -Quiet) {
  Write-Host "Hosts: wpis dla $Hostname już istnieje — sprawdź, czy wskazuje $ServerIp"
  Select-String -Path $hostsPath -Pattern $Hostname
} else {
  Add-Content -Path $hostsPath -Value "`n$line"
  Write-Host "Dodano: $line"
}

Write-Host ""
Write-Host "Test: ping $Hostname"
Write-Host "Aplikacja: http://${Hostname}:3000/login"
Write-Host "Albo po IP: http://${ServerIp}:3000/login"
