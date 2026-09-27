# Surge inference API

## Running the full project

Run the backend API and frontend in separate PowerShell terminals. In the commands below, replace `C:\Shanay\SIH26\saaaya` with the folder where the repository was cloned.

### First time after cloning

**Terminal 1 — backend API**

```powershell
cd C:\Shanay\SIH26\saaaya\microservice
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
python train_model.py
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend**

```powershell
cd C:\Shanay\SIH26\saaaya\frontend
npm install
npm run dev
```

Open the local URL printed by Vite in the frontend terminal (usually `http://localhost:5173`). Keep both terminals running while using the app. The training command rebuilds the CatBoost model from the prototype dataset; it is needed for initial setup or after changing the training data or training script.

### a) The project is running and UI changes were made

Save the frontend files. Vite normally refreshes the browser automatically; refresh it manually if it does not.

If backend files changed, Uvicorn's `--reload` option normally restarts the API automatically. If it did not, press **Ctrl+C** in the backend terminal and run:

```powershell
uvicorn main:app --reload --port 8000
```

### b) Starting again after restarting the laptop

Open two PowerShell terminals. Dependencies and the trained model are already installed/generated, so you normally do not need to reinstall or retrain.

**Terminal 1 — backend API**

```powershell
cd C:\Shanay\SIH26\saaaya\microservice
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend**

```powershell
cd C:\Shanay\SIH26\saaaya\frontend
npm run dev
```

Open the URL printed by Vite. If this is a fresh clone in another folder, update the `cd` paths to that clone's location.

From this directory, install dependencies and train the evidence-calibrated prototype surrogate:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
python train_model.py
uvicorn main:app --reload --port 8000
```

The endpoint is `GET http://localhost:8000/predict_surge?date=YYYY-MM-DD&ward_id=1`. It uses the exact ward-day weather measurements in the frontend's generated historical prototype dataset, ensuring training/inference feature consistency. Dates outside that dataset return 404 instead of an invented prediction. No weather API key is needed.

The response also aligns the surge estimate with the frontend heatmap's operational ward-risk band. It reproduces the heatmap's current ward offset and score thresholds, then adds a disclosed 0/1/2/3/4 percentage-point adjustment for Low/Moderate/High/Very High/Extreme risk. The response includes `temperature_surge_baseline_pct`, `heatmap_risk_score`, `heatmap_risk_level`, and `risk_band_adjustment_pct` so the components are auditable. This is a prototype presentation alignment rule, not a learned clinical risk effect.

**Scientific scope:** No observed hospital-admission labels are present. CatBoost approximates a transparent proxy target derived from the project metadata's external, non-Pune-specific 1.3% per °C association and 29.79 °C reference. Applying that daily-mean association to 10:00–16:00 daytime mean temperature is an unvalidated modeling assumption. Metrics describe only proxy approximation, not clinical accuracy. Population is used only to estimate absolute baseline and incremental daily demand; the percentage uplift is not population-scaled. Real Pune ward-day admission data is needed for supervised hospital-demand validation.
