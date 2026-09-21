# Terebore

A quiet browser game about throwing colourful, translucent balls into the corner of a room. Bring three or more of the same colour together and watch them disappear in a soft puff.

No timer. No game over. Find your own rhythm.

## Play

Point at the floor or either wall to aim, then click to throw. On a touchscreen, drag to aim above your finger and release. A small ring keeps the target visible. Throw strength is chosen automatically.

The fading dots suggest a few possible bounces. They stop near the wooden rail or pile, leaving the outcome to your throw. The ball in your pocket is the next one up.

- **Mouse:** point to aim, click to throw.
- **Touch:** drag to aim, release to throw.
- **Keyboard:** arrow keys to aim, Space to throw, Escape to cancel aiming.
- **Sound:** enable the speaker button for soft collision and match sounds.

Each matched ball earns 10 points, with bonuses for larger groups, wall-assisted matches, and chain reactions. Clearing the inside triangle earns 25 extra points; balls outside the rail do not count against it. Your personal best is saved in your browser when local storage is available. Reset starts a fresh round without clearing that best score.

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

## Cloudflare deployment

For **Workers Builds** (a project with a deploy command), use:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: the repository root

The checked-in `wrangler.jsonc` serves the built `dist/` directory as static assets. No Worker script or Cloudflare Vite plugin is needed. Wrangler is pinned in the development dependencies. For a manual deployment after Cloudflare authentication, run `npm run deploy`.

For **Cloudflare Pages** Git integration, use `npm run build` as the build command and `dist` as the build output directory. Pages uploads that directory automatically; it does not need a Workers deploy command.

See [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/) and [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## Development

```sh
npx playwright install chromium
npm run check
```

Run `npm test` for the faster unit suite alone.

Terebore uses TypeScript, Three.js, and cannon-es. Artwork, textures, and sounds are generated in code. Adaptive render resolution keeps the game lightweight on integrated graphics while the interface stays sharp. A modern browser with WebGL 2 is required; sound is optional, and reduced-motion preferences are respected by interface transitions.

See [Development notes](docs/development.md) for browser checks, performance measurements, and the code layout.
