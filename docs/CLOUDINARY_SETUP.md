# Cloudinary Setup (GreenSports)

This project already supports Cloudinary uploads in `src/services/storageService.js`.

## 1. Create Cloudinary Upload Preset

1. Open Cloudinary Console.
2. Go to Settings -> Upload.
3. Create an unsigned upload preset.
4. Optional: set a folder naming convention and allowed formats.

## 2. Configure App Env

In root `.env`, fill these values:

- `EXPO_PUBLIC_IMAGE_PROVIDER=cloudinary`
- `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=<your-cloud-name>`
- `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<your-unsigned-preset>`
- `EXPO_PUBLIC_ENABLE_STORAGE=false`

## 3. Restart Expo

Run:

```bash
npx expo start --clear
```

## 4. Verify End-to-End

1. Create a product from `Create Item` with an image.
2. Open Shop screen and confirm image renders.
3. Open Product Manager and confirm owner label is visible.

## Ownership Metadata Saved

When a product image is uploaded, the app now stores:

- `imageOwnerUid`
- `imageOwnerName`
- `createdBy`
- `createdByName`

This is used in Shop and Product Manager to show image ownership.

## Troubleshooting

- If upload returns blank URL, check Cloudinary env keys are non-empty.
- If app still uses old env values, fully restart Expo with `--clear`.
- If Cloudinary is selected but not configured, app will fallback to Firebase only when `EXPO_PUBLIC_ENABLE_STORAGE=true`.
