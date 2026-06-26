# Factory Traceability and Stamped-Frame OCR

Production-minded starter for an iPad operator web app with Azure Vision OCR and SharePoint saving through Power Automate.

## Structure

- `frontend/` - React + Vite + TypeScript operator app.
- `azure-function/` - Node.js Azure Function API for OCR. Azure Vision keys stay here.
- `docs/` - Power Automate schema, SharePoint list plan, and deployment notes.

## Local Setup

```bash
npm install
cp frontend/.env.example frontend/.env
cp azure-function/local.settings.example.json azure-function/local.settings.json
npm run dev
```

The frontend reads editable defaults from `frontend/public/config/app-config.json`. The admin page can export an updated JSON file for replacement in source control or static hosting.

## Updating The Live App Config

Admin changes are first saved in the current browser only. To make a route, field, user, serial rule, target setup, or device default live for everyone:

1. Open Admin Config in the app and press `Save changes`.
2. Press `Export JSON`.
3. Replace `frontend/public/config/app-config.json` with the downloaded `app-config.json`.
4. Commit and push the file to GitHub. GitHub Pages will publish the new default config.

If a device already has old local admin changes cached, open Admin Config and use `Reset local` once. That device will reload the hosted config file again.

Mistake/rework choices are configured per part in `Admin Config -> Serial Rules -> Edit mistake choices`. The Rework Bench uses the serial number to identify the real part and then shows the correct mistake choices for that part.

## Security Notes

- Operators do not use Microsoft login; their 4-digit employee ID is validated by config/API.
- Azure Vision credentials are only read by the Azure Function from app settings.
- The Power Automate URL is a frontend environment variable for this first version. Move save calls behind the Azure Function before wider rollout if that URL needs to be hidden.
