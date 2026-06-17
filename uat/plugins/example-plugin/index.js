/**
 * Example plugin: export register(api) to extend the host.
 */

export function register(api) {
  if (api?.registerCommand) {
    api.registerCommand('hello', () => console.log('Hello from example-plugin'));
  }
}

export default { register };
