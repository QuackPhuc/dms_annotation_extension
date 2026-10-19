#!/bin/bash
set -euo pipefail

host_name="ai.nota.labeling_updater"
release_api="https://api.github.com/repos/tanmainhat0502/dms_annotation_extension/releases/latest"
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
extension_root="$script_dir"
source_host="$extension_root/updater/NOTAUpdater-macos"
finder_script="$extension_root/updater/Find-NOTA-Extension.js"
install_root="$HOME/Library/Application Support/NOTA/LabelingUpdater"
installed_host="$install_root/NOTAUpdater-macos"
config_path="$install_root/config.json"
host_manifest="$install_root/$host_name.json"

pause_terminal() {
  printf '\nNhan Enter de dong cua so nay...'
  read -r _
}

fail() {
  printf '\nCai dat that bai: %s\n' "$1" >&2
  pause_terminal
  exit 1
}

[[ -f "$extension_root/manifest.json" ]] || fail "Khong tim thay manifest.json trong $extension_root"
[[ -x "$source_host" ]] || fail "Goi nay chua co NOTAUpdater-macos. Hay tai dung file ZIP trong GitHub Release moi nhat."
[[ -f "$finder_script" ]] || fail "Thieu Find-NOTA-Extension.js"

extension_ids=()
if [[ "${1:-}" =~ ^[a-p]{32}$ ]]; then extension_ids+=("$1"); fi

browser_roots=(
  "$HOME/Library/Application Support/Google/Chrome"
  "$HOME/Library/Application Support/Google/Chrome Beta"
  "$HOME/Library/Application Support/Google/Chrome Canary"
  "$HOME/Library/Application Support/Chromium"
  "$HOME/Library/Application Support/Microsoft Edge"
  "$HOME/Library/Application Support/BraveSoftware/Brave-Browser"
)

preference_files=()
for browser_root in "${browser_roots[@]}"; do
  [[ -d "$browser_root" ]] || continue
  while IFS= read -r preference_file; do
    preference_files+=("$preference_file")
  done < <(/usr/bin/find "$browser_root" -maxdepth 2 -type f \( -name "Secure Preferences" -o -name "Preferences" \) 2>/dev/null)
done

if [[ ${#preference_files[@]} -gt 0 ]]; then
  while IFS= read -r extension_id; do
    [[ "$extension_id" =~ ^[a-p]{32}$ ]] || continue
    duplicate=false
    for existing in "${extension_ids[@]}"; do [[ "$existing" == "$extension_id" ]] && duplicate=true; done
    [[ "$duplicate" == false ]] && extension_ids+=("$extension_id")
  done < <(/usr/bin/osascript -l JavaScript "$finder_script" "$extension_root" "${preference_files[@]}" 2>/dev/null || true)
fi

if [[ ${#extension_ids[@]} -eq 0 ]]; then
  printf 'Khong tu tim thay Extension ID. Mo chrome://extensions, bat Developer mode va copy ID cua NOTA Labeling Organizer.\n'
  printf 'Nhap Extension ID: '
  read -r manual_id
  [[ "$manual_id" =~ ^[a-p]{32}$ ]] || fail "Extension ID khong hop le."
  extension_ids+=("$manual_id")
fi

origins_json="["
separator=""
for extension_id in "${extension_ids[@]}"; do
  origins_json+="$separator\"chrome-extension://$extension_id/\""
  separator=","
done
origins_json+="]"

/bin/mkdir -p "$install_root"
/bin/cp -f "$source_host" "$installed_host"
/bin/chmod 755 "$installed_host"
/usr/bin/xattr -d com.apple.quarantine "$installed_host" 2>/dev/null || true

/bin/rm -f "$config_path" "$host_manifest"
/usr/bin/plutil -create json "$config_path"
/usr/bin/plutil -insert extensionPath -string "$extension_root" "$config_path"
/usr/bin/plutil -insert allowedOrigins -json "$origins_json" "$config_path"
/usr/bin/plutil -insert releaseApi -string "$release_api" "$config_path"

/usr/bin/plutil -create json "$host_manifest"
/usr/bin/plutil -insert name -string "$host_name" "$host_manifest"
/usr/bin/plutil -insert description -string "One-click updater for NOTA Labeling Organizer" "$host_manifest"
/usr/bin/plutil -insert path -string "$installed_host" "$host_manifest"
/usr/bin/plutil -insert type -string "stdio" "$host_manifest"
/usr/bin/plutil -insert allowed_origins -json "$origins_json" "$host_manifest"

installed_manifests=0
for browser_root in "${browser_roots[@]}"; do
  [[ -d "$browser_root" ]] || continue
  native_dir="$browser_root/NativeMessagingHosts"
  /bin/mkdir -p "$native_dir"
  /bin/cp -f "$host_manifest" "$native_dir/$host_name.json"
  installed_manifests=$((installed_manifests + 1))
done
if [[ $installed_manifests -eq 0 ]]; then
  native_dir="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  /bin/mkdir -p "$native_dir"
  /bin/cp -f "$host_manifest" "$native_dir/$host_name.json"
fi

printf '\nDa cai NOTA Updater cho macOS.\n'
printf 'Extension: %s\n' "$extension_root"
printf 'Extension ID: %s\n' "${extension_ids[*]}"
printf 'Dong popup, mo lai va bam Kiem tra update.\n'
pause_terminal
