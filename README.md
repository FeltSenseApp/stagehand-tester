# Stagehand Tester

Automated testing infrastructure that runs browser tests when Linear tickets are moved to a testing state. Powered by [Stagehand](https://github.com/browserbase/stagehand) for AI-driven browser automation.

## How It Works

```
Linear Webhook → Express Server → Parse ACs → Stagehand Agent → Local Chrome → Test Results
```

1. Configure a Linear webhook to POST to this server when issues change state
2. When an issue moves to "Ready for Testing" (or similar), the webhook fires
3. Server extracts acceptance criteria from the issue description
4. Stagehand agent logs into your portal and verifies each criterion
5. Results are saved as JSON files in `test-results/`

## Requirements

- **Bun** (v1.0+) — [install Bun](https://bun.sh/docs/installation)
- **Chrome** installed locally (Stagehand uses it for automation)
- **OpenAI API key** (for the AI agent)

### Chrome Installation

**macOS:**
```bash
# Chrome is usually already installed, or:
brew install --cask google-chrome
```

**Ubuntu/Debian:**
```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f
```

**Headless Linux servers:**
You may need to install additional dependencies or use `xvfb`:
```bash
sudo apt-get install xvfb
xvfb-run bun start
```

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# OpenAI API key for the Stagehand agent
OPENAI_API_KEY=sk-your-key-here

# Portal to test (your application)
PORTAL_URL=https://your-app.example.com
PORTAL_USERNAME=test-user
PORTAL_PASSWORD=test-password

# Linear webhook secret
LINEAR_WEBHOOK_SECRET=your-webhook-secret

# Server port
PORT=3000
```

### 3. Start the Server

**Development (with hot reload):**
```bash
bun run dev
```

**Production:**
```bash
bun run build
bun start
```

## Linear Webhook Configuration

1. Go to **Linear Settings → API → Webhooks**
2. Create a new webhook:
   - **URL:** `https://your-server.com/webhooks/linear`
   - **Secret:** Generate a secret and add it to your `.env`
   - **Events:** Select "Issues" → "Issue updated"
3. Save the webhook

### Triggering Tests

Tests are triggered when an issue:
- Has `type: "Issue"` and `action: "update"`
- Is in a state named (case-insensitive):
  - "Ready for Testing"
  - "Ready to Test"
  - "In Testing"
  - "QA"
  - "Testing"
- OR has a label containing "test"

### Acceptance Criteria Format

The agent extracts ACs from the issue description. Supported formats:

**Markdown checkboxes (recommended):**
```markdown
## Acceptance Criteria
- [ ] User can log in with valid credentials
- [ ] Dashboard shows user's name
- [ ] User can log out
```

**Numbered list:**
```markdown
## Acceptance Criteria
1. User can log in with valid credentials
2. Dashboard shows user's name
3. User can log out
```

## Testing Manually

Run a test without a webhook:

```bash
bun run test:manual
```

This uses mock acceptance criteria to verify your Stagehand setup works.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Server info |
| `/webhooks/linear` | POST | Linear webhook receiver |
| `/webhooks/health` | GET | Health check |

## Test Results

Results are saved to `test-results/` as JSON files:

```
test-results/
├── abc123-2024-01-15T10-30-00-000Z.json
├── def456-2024-01-15T11-45-00-000Z.json
└── ...
```

Each file contains:
```json
{
  "issueId": "abc123",
  "issueIdentifier": "ENG-123",
  "issueTitle": "Add login feature",
  "status": "passed",
  "results": [
    {
      "criterion": "User can log in with valid credentials",
      "passed": true,
      "details": "Successfully logged in and verified dashboard loaded"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "duration": 45000
}
```

## Cost

- **Browser sessions:** $0 (runs locally)
- **OpenAI API:** ~$0.01-0.10 per test depending on complexity

## Deployment

### Docker (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Deployment

1. Build the project:
```bash
bun run build
```

2. Set environment variables and run:
```bash
NODE_ENV=production bun run dist/index.js
```

### Environment Variables for Production

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `PORTAL_URL` | URL of app to test | Required |
| `PORTAL_USERNAME` | Login username | Required |
| `PORTAL_PASSWORD` | Login password | Required |
| `LINEAR_WEBHOOK_SECRET` | Linear webhook secret | Required |
| `MAX_CONCURRENT_TESTS` | Max parallel browser sessions | 3 |

### Exposing to the Internet

For Linear webhooks to reach your server, expose it via:

**ngrok (Development):**
```bash
ngrok http 3000
```

**Cloudflare Tunnel:**
```bash
cloudflared tunnel --url http://localhost:3000
```

**Or deploy to:** Railway, Fly.io, Render, DigitalOcean, etc.

## Concurrent Test Execution

The server uses a queue system to manage concurrent test execution:

- **Default:** 3 concurrent browser sessions
- Configure via `MAX_CONCURRENT_TESTS` environment variable
- Tests are queued when capacity is reached
- Queue status visible at `GET /api/queue`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web UI |
| `/api/run-test` | POST | Start a test run |
| `/api/test-status/:id` | GET | Get test status |
| `/api/tests` | GET | List all tests |
| `/api/queue` | GET | Queue status |
| `/webhooks/linear` | POST | Linear webhook |
| `/webhooks/health` | GET | Health check |

## Project Structure

```
stagehand-tester/
├── src/
│   ├── index.ts              # Express server entry
│   ├── routes/
│   │   └── webhooks.ts       # Webhook handler
│   ├── services/
│   │   ├── stagehand.ts      # Agent setup & execution
│   │   ├── linear.ts         # Webhook parsing
│   │   └── storage.ts        # Test result storage
│   └── types/
│       └── index.ts          # TypeScript interfaces
├── test-results/             # JSON test results
├── screenshots/              # Failure screenshots
├── .env                      # Environment variables
└── package.json
```

## Troubleshooting

**"Chrome not found"**
- Ensure Chrome is installed and in your PATH
- On Linux, install `google-chrome-stable`

**"OPENAI_API_KEY is required"**
- Add your OpenAI API key to `.env`

**Tests timing out**
- Increase headless mode tolerance
- Check network connectivity to portal

**Webhook signature invalid**
- Verify `LINEAR_WEBHOOK_SECRET` matches Linear's webhook configuration

## License

MIT
