# LeetCode Tracker

A local, single-user app for keeping track of the LeetCode problems you have solved: what the problem asks, how you solved it, why that approach works, the code, and which patterns and data structures it exercises. Everything is stored on your own machine in a SQLite file.

## Features

- **Add problems** from LeetCode or your own. Paste a LeetCode link and the title is filled in from the URL.
- **Two difficulty ratings**: the official Easy / Medium / Hard label, and your own 1 to 5 rating of how hard it felt.
- **Notes in Markdown**: a summary, how you solved it, and why it works, plus time and space complexity.
- **Code** with syntax highlighting, and several solutions per problem (for example brute force next to optimal).
- **Handwritten notes**: upload PDFs to a problem and open them in a viewer from the problem page.
- **Patterns and data structures** as tags (Sliding Window, Dynamic Programming, Heap, and so on). A starter set is created for you and you can add your own.
- **Dashboard** with filters for difficulty, pattern, data structure, and "needs revisit", text search across titles and notes, and sorting by date, difficulty, your own rating, or time since last review.
- **Review tracking**: a "needs revisit" flag, last reviewed date, and review count.

## Requirements

- Node.js 22 or newer (check with `node -v`). Older versions cannot load the SQLite driver.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The API runs on port 3001 and the database is created on first start.

To run it as a single process instead (no hot reload):

```bash
npm run build
npm start
```

Then open http://localhost:3001.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API and the client with hot reload |
| `npm run build` | Builds the client and compiles the server |
| `npm start` | Serves the built app from the API server |
| `npm test` | Runs the server and client tests |
| `npm run typecheck` | Type-checks both packages |
| `npm run db:generate` | Generates a migration after you change `server/src/db/schema.ts` |

## Where your data lives

- `server/data/tracker.db` is the SQLite database.
- `server/data/uploads/` holds the uploaded PDFs.

The whole `server/data/` folder is ignored by git, so your notes and solutions are never pushed. To back up or move your data, copy that folder. Set the `DATA_DIR` environment variable to keep it somewhere else, and `PORT` to change the API port.

The server only listens on `127.0.0.1` and has no login. It is meant to run on your own machine, not to be hosted.

## Tech stack

- **Client**: React, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, CodeMirror, react-markdown
- **Server**: Node.js, Express, TypeScript, Zod
- **Database**: SQLite through better-sqlite3 and Drizzle ORM

## Project layout

```
client/                 React app
  src/pages/            Dashboard, problem page, add/edit form
  src/components/       Code editor, Markdown, PDF viewer, small UI pieces
  src/lib/leetcode.ts   LeetCode URL to title parsing
  src/api.ts            Typed API client
server/
  src/db/schema.ts      Tables: problems, solutions, tags, problem_tags, attachments
  src/routes/           problems, tags, attachments, stats
  src/api.test.ts       API tests
  drizzle/              SQL migrations, applied automatically on start
```

## API

All routes are under `/api`.

| Route | Purpose |
| --- | --- |
| `GET /problems` | List problems. Query: `difficulty`, `tags` (ids, all must match), `revisit`, `search`, `sort` |
| `POST /problems` | Create a problem with its tags and solutions |
| `GET /problems/:id` | One problem with tags, solutions, and attachments |
| `PATCH /problems/:id` | Update any subset of fields |
| `DELETE /problems/:id` | Delete a problem, its solutions, and its PDFs |
| `POST /problems/:id/review` | Record a review |
| `POST /problems/:id/attachments` | Upload a PDF (multipart field `file`, up to 50 MB) |
| `GET /attachments/:id/file` | View a PDF |
| `DELETE /attachments/:id` | Remove a PDF |
| `GET /tags`, `POST /tags`, `DELETE /tags/:id` | Manage tags |
| `GET /stats` | Counts for the dashboard |

## License

MIT, see [LICENSE](LICENSE).
