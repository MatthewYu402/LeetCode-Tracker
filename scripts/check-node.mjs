// Runs before `npm run dev` and `npm start`. The SQLite driver's prebuilt binary
// needs Node 22 or newer; on older versions it crashes without printing anything,
// so stop here with a clear message instead.
const REQUIRED_MAJOR = 22
const major = Number(process.versions.node.split('.')[0])

if (major < REQUIRED_MAJOR) {
  console.error(
    [
      '',
      `LeetCode Tracker needs Node.js ${REQUIRED_MAJOR} or newer. You are running ${process.version}.`,
      '',
      'Install a newer version, then run `npm install` again:',
      '  nvm:      nvm install 22 && nvm use 22',
      '  Homebrew: brew install node@22',
      '  Download: https://nodejs.org/en/download',
      '',
    ].join('\n'),
  )
  process.exit(1)
}
