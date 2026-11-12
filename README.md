# Awesome iOS Shortcuts and Userscripts

Guides, iCloud links, and ready-to-install files for iPhone and iPad.

* **Shortcuts** live in the Apple Shortcuts app. No coding. Those guides are being added.
* **Userscripts** run in Safari through the free [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) extension. They can change a page after it loads, which a Shortcut cannot do.

---

## Userscripts

### Desktop Layout

Sites that ignore Safari's **Request Desktop Website** stay in a mobile layout because that switch only changes the User-Agent. The page width stays the width of the phone, and responsive sites pick their layout from the width.

Desktop Layout does the missing part. One tap lays the page out at a desktop width and scales it to the iPhone screen. The site is remembered, so the next visit opens the same way. Tap again for the mobile layout.

* One tap switches the current site between mobile and desktop
* The choice is remembered per site, and the list can be edited or cleared from the ••• panel
* Page width is 1024, 1280, or 1440
* The PC button stays a normal thumb size on iPhone 14 Pro Max after the page scales down
* Button corner: top left, top right, bottom left, or bottom right

An Apple Shortcut cannot do this. Shortcuts has no action that changes a page's layout width.

#### Install on iPhone

1. Install [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) by Justin Wasack. It is free and open source.
2. Turn the extension on: **Settings → Safari → Extensions → Userscripts**. Allow websites. Per-site prompts are fine too. For the button to show up everywhere, allow all websites.
3. Open this link in Safari (the address has to end in `.user.js`):

   https://raw.githubusercontent.com/reloru/reloru-awesome-ios-shortcuts/main/userscripts/desktop-layout.user.js

4. Tap **aA** on the left of the address bar, then **Userscripts**, then **Install**.
5. Open a site that stayed in its mobile layout. Tap **PC**. The page reloads at desktop width and that hostname is saved.
6. Tap **…** under PC to change the width, move the button, or remove a saved site.

#### Use it with Request Desktop Website

| What you turned on | What actually changes |
| --- | --- |
| Safari → Request Desktop Website | The User-Agent sent with the request |
| Desktop Layout (this script) | The page width the site uses to pick a layout, plus the User-Agent that the page's own JavaScript can read |

Use the script alone when the site is responsive and simply stays in the phone layout. If the server sends a completely different mobile page, or it stops you with "open this on a computer," turn on **Request Desktop Website** as well, then tap **PC**.

#### Limits

* Rules are stored on this device by the extension. There is no account and no ads.
* The script does not change the User-Agent on the network request. Safari's own switch is the one that does that.
* On a site with a very strict Content-Security-Policy, the width change still runs. The extra in-page User-Agent spoof can be blocked there. The width is the part those sites are checking.
* The button is injected into the page. Move it from the ••• panel if it covers a control.

Source: [userscripts/desktop-layout.user.js](userscripts/desktop-layout.user.js)

New userscripts in this repo belong in `userscripts/` and use the `.user.js` name so Safari can install them directly.

---

## Shortcuts

Guides here will be normal Shortcuts you install from an iCloud link. Nothing to compile.

Planned sets:

* **Productivity:** routines and everyday tasks
* **System utilities:** iOS features reached through automations
* **Media:** short photo, video, and text recipes

Each guide will say which iOS version it expects and will include the iCloud link plus the steps to allow the permissions it asks for.

---

## License

[MIT](LICENSE). Use, share, and adapt the guides and scripts.
