# Mathematics showreel

A 20-second motion study for Francis Dey. Hacking-field backdrop (terminal rain, scanlines, glitch) with the bootcamp’s black-hat mark, then a run of mathematics: Lissajous figures, a rhodonea, Fourier epicycles tracing a star, sine-wave superposition, a golden-ratio spiral beside a prime spiral, a Mandelbrot zoom with a Julia inset, a rotating torus and icosahedron, and Euler’s identity. The closing card is a showreel title in the bootcamp palette.

Picture is 1920×1080, 30 fps, 600 frames (20.0 seconds). The score is synthesised in the script (kick, hat, bass, arp, pad). It is not a recording of someone else’s music.

## Render

From the repository root, with Python 3, [FFmpeg](https://ffmpeg.org), and these packages: `numpy`, `pillow`, `cairosvg`, `fonttools`.

```bash
pip install numpy pillow cairosvg fonttools
cd showreel
python3 render.py
```

The script reads the community logo from `frontend/public/assets/logo/` and Space Grotesk from `frontend/public/assets/fonts/`. It writes:

`showreel/francis-dey-mathematics-showreel.mp4`

A temporary cache (the instanced font, hat raster, and WAV) is kept in `/tmp/showreel-cache` and is not part of the project.

## What you should see

| Time | Card |
| --- | --- |
| 0.0–2.0 | Title. FRANCIS DEY / MATHEMATICS |
| 2.0–4.5 | Terminal rain, glitch, the black hat |
| 4.5–6.5 | Lissajous curve and a rhodonea |
| 6.5–9.0 | Fourier epicycles drawing a star |
| 9.0–11.0 | Two sines and their sum |
| 11.0–13.0 | Golden spiral and Ulam prime spiral |
| 13.0–15.5 | Mandelbrot zoom, Julia inset |
| 15.5–17.5 | Torus and icosahedron |
| 17.5–18.5 | Euler’s identity |
| 18.5–20.0 | Showreel card. Francis Dey, the hat mark, the site palette |
