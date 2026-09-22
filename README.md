# 🔬 TEM / SEM Nanomaterials Image Analysis & Characterization Tool

An intelligent, publication-ready research platform designed for materials scientists, chemists, and microscopists to analyze **Transmission Electron Microscopy (TEM)** and **Scanning Electron Microscopy (SEM)** micrographs.

---

## ✨ Key Features

- **Automated & Manual Particle Characterization**: Measure nanoparticle dimensions, diameter, aspect ratio, agglomeration state, and morphology distributions.
- **Interactive Scale Calibration**: Define custom scale bars in nanometers (nm) or micrometers (µm) with click-and-drag measuring calipers.
- **Comparative Before/After Studies**: Compare pristine (fresh) nanomaterials with post-reaction / post-adsorption micrographs side-by-side.
- **Multi-Engine AI Integration**:
  - **Google Gemini** (Gemini 3.8 Flash, 3.1 Pro Preview, etc.)
  - **OpenAI** (GPT-4o, GPT-4o-mini)
  - **Anthropic Claude** (Claude 3.5 Sonnet, Claude 3.5 Haiku)
  - **OpenRouter** (Multi-model gateway)
  - **Custom OpenAI-Compatible APIs** (Groq, Together AI, vLLM, DeepSeek)
  - **Local Ollama** (100% offline, local GPU/CPU execution with zero data leaving your machine)
- **Automated Literature Cross-Referencing**: Ground your findings against peer-reviewed academic papers with full DOIs and journal citations.
- **Export & Reporting**: Generate publication-grade PDF reports, high-resolution annotated micrographs, and raw measurement CSV/JSON data.
- **AI Materials Science Assistant**: Real-time contextual chat to discuss crystallography, contrast interpretation, and manuscript discussion sections.

---

## 💻 Beginner-Friendly Setup Guide (How to Install & Run)

You don't need advanced programming skills to run this tool on your computer. Follow these steps:

### Step 1: Install Node.js (If you don't have it yet)

Node.js is the free runtime environment needed to run the application.

1. Go to [https://nodejs.org/](https://nodejs.org/).
2. Download the **LTS (Long Term Support)** version for your operating system (Windows, Mac, or Linux).
3. Run the installer and click **Next** through the setup (keep all default checkboxes checked).
4. Verify the installation:
   - On **Windows**: Open *Command Prompt* or *PowerShell*.
   - On **Mac/Linux**: Open *Terminal*.
   - Type:
     ```bash
     node -v
     npm -v
     ```
   - If you see version numbers (e.g., `v20.x.x` or `v22.x.x`), you are ready!

---

### Step 2: Download the Project

#### Option A: Download as a ZIP (Easiest)
1. Download this project as a `.zip` file from the platform or repository.
2. Extract (unzip) the folder to an easy-to-find location (e.g., your *Desktop* or *Documents* folder).

#### Option B: Clone with Git
If you have Git installed, open your terminal and run:
```bash
git clone https://github.com/radjanada/TEM-SEM-analyzer.git
cd TEM-SEM-analyzer
```

---

### Step 3: Open the Terminal in the Project Folder

1. Open your terminal or command prompt:
   - **Windows**: Open the extracted folder, click in the address bar at the top, type `cmd`, and press **Enter**.
   - **Mac**: Right-click the extracted folder in Finder and select **New Terminal at Folder** (or open Terminal and type `cd ` followed by dragging the folder into the terminal window).

---

### Step 4: Install Dependencies

Run the following command to download all necessary libraries:

```bash
npm install
```

*(This takes about 30–60 seconds depending on your internet connection.)*

---

### Step 5: Start the Application

Run:

```bash
npm run dev
```

You will see an output like:
```text
  VITE v6.x.x  ready in 250 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

Now, open your web browser (Chrome, Edge, Firefox, or Safari) and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)** (or the URL displayed in your terminal).

---

## ⚙️ Configuring AI Engines & API Keys

You have two convenient ways to configure AI models:

### 1. In-App Settings (Easiest — No Code Required)
1. Once the application is open in your browser, click the **Engine / Settings** badge in the top-right corner.
2. Select your preferred provider:
   - **Google Gemini**: Paste your free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
   - **OpenAI**: Enter your OpenAI API key (`sk-proj-...`).
   - **Anthropic Claude**: Enter your Claude API key (`sk-ant-...`).
   - **OpenRouter**: Enter your OpenRouter key.
   - **Local Ollama**: Select this to run completely offline without an API key!
3. Click **Apply Engine & Keys**. Your settings are securely saved in your browser's local storage.

### 2. Environment Variable File (`.env`) (Optional)
If you want to pre-load a default Gemini API key for all sessions:
1. In the project root folder, create a file named `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
2. Restart the app (`Ctrl + C` in the terminal, then `npm run dev`).

---

## 🔒 100% Offline Mode with Local Ollama (Zero Cloud Privacy)

If your micrographs contain proprietary or confidential materials data and you cannot send them to the cloud:

1. Install **Ollama** from [https://ollama.com/](https://ollama.com/).
2. Open your computer's terminal and download a vision-capable open-weight model:
   ```bash
   ollama run llama3.2-vision
   ```
   *(Or `ollama run minicpm-v` or `ollama run llava`)*
3. Enable cross-origin requests for browser access:
   - **Windows** (Command Prompt):
     ```cmd
     set OLLAMA_ORIGINS=*
     ollama serve
     ```
   - **Mac / Linux** (Terminal):
     ```bash
     OLLAMA_ORIGINS="*" ollama serve
     ```
4. In the app's top-right settings, select **Local Ollama**, click **Scan Models**, select your installed vision model, and save. All analysis will run locally on your GPU/CPU!

---

## 📖 How to Analyze Micrographs (Step-by-Step)

1. **Upload an Image**: Drag-and-drop a `.jpg`, `.png`, or `.tif` TEM/SEM micrograph into the upload zone.
2. **Metadata Auto-Fill**: Click **Auto-Detect Metadata**; the AI reads detector stamps, voltage, and magnification directly from the micrograph.
3. **Calibrate Scale Bar**:
   - Click the **Calibrate Scale** button.
   - Click and drag along the scale bar printed on your image.
   - Enter the scale length and units (e.g., `50 nm`).
4. **Take Measurements**:
   - Use the caliper tool to click across particle diameters or lattice fringes.
   - The interactive table calculates mean size, standard deviation, and particle count.
5. **Run AI Characterization**:
   - Choose whether this is a **Single Image**, a **Pristine (Before)** sample, or an **After-reaction** sample.
   - Click **Run Full AI Characterization**.
6. **Generate Synthesis & Literature Review**:
   - Review automatically searched peer-reviewed literature related to your material.
   - Read the structured scientific synthesis (Morphology, Size Distribution, Crystalline Facets, Agglomeration Mechanism).
7. **Export**:
   - Download the annotated image with your drawn measurements.
   - Export a complete **PDF Technical Report** or copy the discussion text for your journal publication.

---

## 🛠️ Build for Production / Deployment

To build a standalone production bundle:

```bash
npm run build
```

This compiles static files into the `dist/` directory, which can be deployed to any web server (Vercel, Netlify, Cloud Run, AWS S3, or Nginx).

To preview the production build locally:
```bash
npm run preview
```

---

## ❓ Troubleshooting & FAQs

- **Q: It says `npm: command not found` or `node is not recognized`**
  - **A**: Node.js is not installed or your terminal was not restarted after installing Node.js. Download and run the installer from [nodejs.org](https://nodejs.org/) and reopen your terminal.
- **Q: Port 3000 is already in use**
  - **A**: Vite will automatically select the next available port (e.g., `3001`). Look at the terminal output for the active URL.
- **Q: "Requested entity was not found (404)" on Gemini**
  - **A**: Ensure your Gemini model is set to `gemini-3.8-flash` in Settings, and verify your API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
- **Q: Can I use this completely without an internet connection?**
  - **A**: Yes! Using the **Local Ollama** engine option, image processing and vision LLM inferences run 100% on your local hardware.

---

## 📄 License & Citation

Distributed for academic, laboratory, and scientific research. If you use this tool in published work, please credit the automated measurement calibration and computer-assisted characterization workflow in your methodology section.
