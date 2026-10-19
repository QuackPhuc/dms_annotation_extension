#!/bin/bash
set -euo pipefail

host_name="ai.nota.labeling_updater"
install_root="$HOME/Library/Application Support/NOTA/LabelingUpdater"
browser_roots=(
  "$HOME/Library/Application Support/Google/Chrome"
  "$HOME/Library/Application Support/Google/Chrome Beta"
  "$HOME/Library/Application Support/Google/Chrome Canary"
  "$HOME/Library/Application Support/Chromium"
  "$HOME/Library/Application Support/Microsoft Edge"
  "$HOME/Library/Application Support/BraveSoftware/Brave-Browser"
)

for browser_root in "${browser_roots[@]}"; do
  manifest="$browser_root/NativeMessagingHosts/$host_name.json"
  [[ -f "$manifest" ]] && /bin/rm -f "$manifest"
done

expected="$HOME/Library/Application Support/NOTA/LabelingUpdater"
if [[ -d "$install_root" && "$install_root" == "$expected" ]]; then /bin/rm -rf "$install_root"; fi
printf 'NOTA Updater da duoc go khoi macOS.\n'
printf 'Nhan Enter de dong cua so nay...'
read -r _
