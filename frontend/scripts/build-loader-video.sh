#!/bin/sh
# Grade a short stretch of the Pexels hooded-hacker clip and burn in a
# classroom terminal. Source (not committed):
#   https://www.pexels.com/video/a-man-encoding-on-a-computer-5378004/
#   https://videos.pexels.com/video-files/5378004/5378004-hd_1280_720_25fps.mp4
# License: https://www.pexels.com/license/
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
SRC="${1:-/tmp/stock/encode-720.mp4}"
OUT="$ROOT/public/assets/boot"
FONT_MED="/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Medium.ttf"
FONT_BOLD="/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf"
mkdir -p "$OUT"

# 3.8s from the typing stretch. Text is fictional and names no target.
FILTER="
scale=1280:720:flags=lanczos,
eq=contrast=1.18:brightness=-0.06:saturation=1.2:gamma=0.94,
colorbalance=rs=-0.06:gs=0.1:bs=-0.08:rm=-0.03:gm=0.06:bm=-0.04,
vignette=PI/4,
drawbox=x=40:y=ih-292:w=iw-80:h=236:color=0x04140C@0.8:t=fill,
drawbox=x=40:y=ih-292:w=iw-80:h=4:color=0x88CC00@1:t=fill,
drawtext=fontfile=${FONT_MED}:text='\$ bootcamp --cohort 2026':fontsize=28:fontcolor=0xF4FFE8:x=64:y=h-268:enable='gte(t,0.15)',
drawtext=fontfile=${FONT_MED}:text='  [####......] welcome desk':fontsize=28:fontcolor=0x9BE36A:x=64:y=h-226:enable='gte(t,0.85)',
drawtext=fontfile=${FONT_MED}:text='  [#######...] syllabus':fontsize=28:fontcolor=0x9BE36A:x=64:y=h-184:enable='gte(t,1.55)',
drawtext=fontfile=${FONT_MED}:text='  [##########] seat in Accra':fontsize=28:fontcolor=0x9BE36A:x=64:y=h-142:enable='gte(t,2.15)',
drawtext=fontfile=${FONT_BOLD}:text='ACCESS GRANTED':fontsize=42:fontcolor=0xF7FFF0:x=64:y=h-96:enable='gte(t,2.7)',
drawtext=fontfile=${FONT_MED}:text='welcome to MN Bootcamp 2026':fontsize=26:fontcolor=0x88CC00:x=64:y=h-48:enable='gte(t,3.15)'
"

ffmpeg -y -ss 0.4 -t 3.8 -i "$SRC" -vf "$FILTER" -an \
  -c:v libx264 -pix_fmt yuv420p -profile:v high -movflags +faststart -preset slow -crf 21 \
  "$OUT/loader.mp4"
ffmpeg -y -i "$OUT/loader.mp4" -an -c:v libvpx-vp9 -pix_fmt yuv420p -b:v 0 -crf 34 -row-mt 1 -deadline good \
  "$OUT/loader.webm"
ffmpeg -y -sseof -0.08 -i "$OUT/loader.mp4" -frames:v 1 -q:v 4 "$OUT/loader-poster.jpg"
ffmpeg -y -ss 0 -i "$OUT/loader.mp4" -frames:v 1 -q:v 5 "$OUT/loader-start.jpg"
ls -lh "$OUT/loader.mp4" "$OUT/loader.webm" "$OUT/loader-poster.jpg" "$OUT/loader-start.jpg"
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT/loader.mp4"
