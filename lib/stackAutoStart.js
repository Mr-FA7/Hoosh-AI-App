/**
 * Optional auto stack-up when hoosh.dev.yaml has autoUp: true.
 */
const { readDevProfile } = require('./hooshDevProfile');
const { upWithHealth, resolveComposeFile } = require('./stackRunner');

async function maybeAutoStartStack(projectRoot) {
  if (!projectRoot) return { skipped: true, reason: 'no project' };
  const { profile } = await readDevProfile(projectRoot);
  if (!profile?.autoUp) return { skipped: true, reason: 'autoUp disabled' };

  const composeFile = profile.compose || resolveComposeFile(projectRoot);
  if (!composeFile) return { skipped: true, reason: 'no compose file' };

  const result = await upWithHealth(projectRoot, {
    composeFile,
    build: true,
    services: profile.services?.length ? profile.services : undefined,
    waitHealthy: profile.waitHealthy
  });
  return { skipped: false, autoUp: true, ...result };
}

module.exports = { maybeAutoStartStack };
