# SJ mascot assets — 2026-09-21

The user supplied the canonical Shiba artwork and explicitly requested replacing the old character and adapting it elsewhere. The original file is preserved without modification. Do not restore the former vector placeholder or generate an unrelated mascot.

## Files and use

| Master | Source | Production asset | Use |
|---|---|---|---|
| [sj-camera-original.png](sj-camera-original.png) | User-supplied original, 1254×1254 | [sj-camera.webp](sj-camera.webp), 512×512 | Start screen, capture helper |
| [sj-history.png](sj-history.png) | Built-in image_gen, real transparent alpha, 1254×1254 | [sj-history.webp](sj-history.webp), 512×512 | Empty history, offline notice |
| [sj-icon-master.png](sj-icon-master.png) | Built-in image_gen, 1254×1254 | [sj-icon.webp](sj-icon.webp), 256×256 | Header brand mark |

App/browser icon sizes from the approved icon artwork: `/icon-sj-32.png`, `/icon-sj-180.png`, `/icon-sj-192.png`, `/icon-sj-512.png`. The files use new URLs and service-worker cache v3 so the former icon does not remain the cached asset. The updated worker activates after its public assets are cached; private receipt data is never cached or removed by this update. Installed OS launchers may update their cached icon only after reopening/reinstalling the PWA.

`npx tsx scripts/assets.ts` only resizes and encodes the existing artwork for delivery. It never regenerates or changes character identity. Keep the original masters. Development mode does not cache Next.js chunks through the service worker, so the character layout is not mixed with stale CSS during local review.

## Generation method

Built-in `image_gen` with the user's PNG as the explicit reference for both variants; no CLI/API-key fallback. The supplied file was `ChatGPT Image 2026년 9월 21일 오전 11_18_00.png`. The original is preserved here as sj-camera-original.png.

## Final prompts

### History variant

Use case: identity-preserve. Asset type: transparent illustration for the empty receipt-history screen in SJ Receipt Camera. Input image 1 is the exact character identity and illustration style reference. Create one new pose of THIS SAME cute warm golden brown Shiba mascot, with the same large round head, thick dark brown outlines, cream cheeks/muzzle/chest/paws, pink blush, soft shaded children's illustration finish, one eye winking and one shiny dark brown eye, happy open mouth. Seat the same mascot facing forward, holding a small sky-blue folder with one blank white receipt peeking out, instead of holding the camera. Preserve recognizability, ear shapes, proportions, color palette, gentle expression and quality of the reference. No new characters, no background scene, no typography, no letters, no logos, no watermark. Full body including fluffy curled tail and pink paw pads, centered, enough clear padding around silhouette. Genuine transparent background with alpha, not a checkered illustration, no white/blue rectangular background. Production-quality single isolated UI mascot, square image.

### App icon variant

Use case: identity-preserve. Asset type: square app icon for SJ Receipt Camera. Input image 1 is the exact identity and art style reference. Make a tight head-and-small-camera app-icon portrait of THIS SAME golden brown Shiba: identical winking left eye, shiny dark right eye, cream eyebrows/muzzle, pink blush, open smiling mouth, thick warm dark brown outlines and soft illustrated shading. Show both ears fully, cute face large and centered, with the top of the same sky-blue camera and lens visible beneath its paws. No floating receipt, no letters, no SJ text, no sparkles, no border, no rounded outer clipping, no extra objects, no watermark. Fill the square edge-to-edge with a very pale sky-blue solid background #EAF7FE. All meaningful character content must fit safely inside the central 78% of the square, with plain background in the outer corners for Android adaptive clipping. Keep distinctive appearance from reference, not a generic dog. Intended to read clearly at 48px; simplified only enough for legibility, preserve face. One square icon.
