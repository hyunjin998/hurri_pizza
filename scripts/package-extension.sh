#!/usr/bin/env bash
#
# 크롬 확장 배포용 zip 만들기
#   1) 확장 빌드 (타입체크 + vite build -> dist-extension/)
#   2) 기존 dist-extension.zip 이 있으면 dist-extension_MMDD.zip 으로 이름 변경 (백업)
#   3) 새 dist-extension.zip 생성
#
# 사용: pnpm package:extension
# 같은 날 여러 번 실행하면 dist-extension_MMDD_2.zip, _3.zip ... 으로 백업이 쌓인다.
set -euo pipefail

cd "$(dirname "$0")/.."

# 빌드가 실패하면 기존 zip을 건드리지 않도록 빌드를 먼저 한다.
pnpm build:extension

if [ -f dist-extension.zip ]; then
  today="$(date +%m%d)"
  backup="dist-extension_${today}.zip"
  n=2

  while [ -e "$backup" ]; do
    backup="dist-extension_${today}_${n}.zip"
    n=$((n + 1))
  done

  mv dist-extension.zip "$backup"
  echo "기존 zip 백업: $backup"
fi

zip -rq dist-extension.zip dist-extension -x "*.DS_Store"

echo "생성 완료: dist-extension.zip"
unzip -p dist-extension.zip dist-extension/manifest.json | grep '"version"'
