# Astrolabe Website

The website for **Follow My Astrolabe**, an app by Studio New Moon.

Live at **[www.followmyastrolabe.com](https://www.followmyastrolabe.com)**.

## What's here

| Path | URL | Notes |
|---|---|---|
| `index.html` | `/` | The real marketing site — hero, feature sections, pricing, footer. |
| `assets/` | `/assets/` | Screenshots and the Studio New Moon logo marks the homepage embeds. |
| `privacy/index.html` | `/privacy/` | Privacy policy. Copied from the original `astrolabe-privacy` repo. |
| `support/index.html` | `/support/` | Support page. The Support URL the App Store listing requires. |
| `CNAME` | — | Tells GitHub Pages the custom domain is `www.followmyastrolabe.com`. |
| `.nojekyll` | — | Serves the files as-is, skipping Jekyll's build step. |

Plain static HTML with no build step: each page is self-contained, with its
styles inline in a `<style>` block (the homepage is the one exception with an
`assets/` folder, for real screenshots and logo marks). Edit a file, commit,
and GitHub Pages publishes it within a minute or so.

## Hosting

Served by GitHub Pages from the `main` branch. The custom domain is set both in
the repo's Pages settings and in the `CNAME` file; DNS points
`www.followmyastrolabe.com` at GitHub's servers.

## Privacy policy

The policy previously lived on its own at `privacy.followmyastrolabe.com`, out
of the [StudioNewMoon/astrolabe-privacy](https://github.com/StudioNewMoon/astrolabe-privacy)
repo, created before the Studio New Moon organization existed. This repo is now
its home. Anywhere the old URL is still referenced — the App Store listing, in
particular — should be pointed at `https://www.followmyastrolabe.com/privacy/`
before the old site is retired.
