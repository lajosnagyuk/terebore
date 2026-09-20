# Terebore

A quiet browser game about throwing colourful, translucent balls into the corner of a room. Bring three or more of the same colour together and watch them disappear in a soft puff.

No timer. No game over. Find your own rhythm.

## Play

Point at the floor or either wall to aim, then click to throw. On a touchscreen, drag to aim and release. Throw strength is chosen automatically.

The fading dots suggest a few possible bounces. They stop near the wooden rail or pile, leaving the outcome to your throw. The ball in your pocket is the next one up.

- **Mouse:** point to aim, click to throw.
- **Touch:** drag to aim, release to throw.
- **Keyboard:** arrow keys to aim, Space to throw, Escape to cancel aiming.
- **Sound:** enable the speaker button for soft collision and match sounds.

Each matched ball earns 10 points, with bonuses for larger groups, wall-assisted matches, and chain reactions. Your personal best is saved in your browser when local storage is available. Reset starts a fresh round without clearing that best score.

## Run locally

Requires Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173).

## Build

```sh
npm run build
npm run preview
```

The production build is written to `dist/` and can be served by a static web host. `npm run preview` serves it locally for inspection.

## Development

```sh
npm test
```

Terebore uses TypeScript, Three.js, and cannon-es. Artwork, textures, and sounds are generated in code. Adaptive render resolution keeps the game lightweight on integrated graphics while the interface stays sharp. A modern browser with WebGL 2 is required; sound is optional, and reduced-motion preferences are respected by interface transitions.

See [Development notes](docs/development.md) for browser checks, performance measurements, and the code layout.
